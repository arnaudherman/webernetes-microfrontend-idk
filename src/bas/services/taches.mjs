// @ts-check
import { ETUDE } from "../donnees/etude.mjs";
import { PORTS } from "./adresses.mjs";
import { journaliser, servir } from "./socle-service.mjs";

/**
 * Service `taches` — la source de vérité du jeu de données.
 *
 * Il ne dépend de personne. Deux consommateurs le lisent : `charges`, qui agrège, et
 * la passerelle, qui a besoin de la liste brute. En mode « appels directs », le
 * navigateur s'ajoute à la liste.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LES DEUX PANNES QU'IL SAIT JOUER, ET POURQUOI ELLES SONT ICI
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `contratRompu` — répond 500. Panne d'un amont ESSENTIEL : sans la liste des
 * tâches, il n'y a rien à composer. C'est la branche 503 de la passerelle.
 *
 * `formeRompue` — répond 200 avec `etat` là où le contrat dit `statut`. C'est
 * l'essai 4, que l'essai 5 rejoue une couche plus haut : le nom de la ressource n'a
 * pas bougé, le code d'état est bon, la charge utile ment. Trois consommateurs la
 * reçoivent sans broncher — `charges` produit un agrégat faux, `mf-tableau` affiche
 * neuf sur neuf. Un seul la refuse : la passerelle, parce que quelqu'un y a écrit la
 * forme attendue.
 *
 * Ces deux drapeaux sont un état d'instance, basculé par un appel HTTP. Le processus
 * ne redémarre pas : c'est bien la même instance, vivante, qui se met à mentir.
 */

let contratRompu = false;
let formeRompue = false;

/**
 * Renomme `statut` en `etat`. Rien d'autre ne change : ni le nom, ni le reste.
 *
 * @param {readonly import("../donnees/etude.mjs").Tache[]} taches
 */
function deformer(taches) {
  return taches.map(({ statut, ...reste }) => ({ ...reste, etat: statut }));
}

servir({
  nom: "taches",
  port: PORTS.taches,
  router({ chemin }) {
    switch (chemin) {
      case "/sante":
        // Ne dépend JAMAIS de l'état applicatif : un service qui se déclare mort
        // parce qu'il répond 500 sortirait de la vue des processus, et l'essai 2
        // perdrait ce qu'il doit montrer — une panne qualifiée par un code d'état,
        // pas par une disparition.
        return { status: 200, corps: { service: "taches", vivant: true } };

      case "/etat":
        return { status: 200, corps: { contratRompu, formeRompue } };

      case "/contrat-rompu":
      case "/contrat-retabli":
        contratRompu = chemin === "/contrat-rompu";
        journaliser({
          service: "taches",
          nature: "note",
          niveau: contratRompu ? "attention" : "normal",
          message: contratRompu
            ? "contrat serveur rompu : je répondrai 500 sur /taches"
            : "contrat serveur rétabli",
        });
        return { status: 200, corps: { contratRompu } };

      case "/forme-rompue":
      case "/forme-retablie":
        formeRompue = chemin === "/forme-rompue";
        journaliser({
          service: "taches",
          nature: "note",
          niveau: formeRompue ? "attention" : "normal",
          message: formeRompue
            ? "forme rompue : je servirai « etat » au lieu de « statut », en 200"
            : "forme rétablie",
        });
        return { status: 200, corps: { formeRompue } };

      case "/taches": {
        if (contratRompu) {
          return {
            status: 500,
            corps: {
              erreur: "contrat serveur rompu",
              service: "taches",
              detail: "le service ne peut plus produire la liste demandée",
            },
          };
        }

        return {
          status: 200,
          corps: {
            servi_par: "taches",
            taches: formeRompue ? deformer(ETUDE) : ETUDE,
          },
        };
      }

      default:
        return { status: 404, corps: { erreur: "chemin inconnu", chemin } };
    }
  },
});

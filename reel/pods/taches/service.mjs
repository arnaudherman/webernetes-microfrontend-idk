// @ts-check
import { ETUDE } from "./donnees.mjs";
import { PORTS } from "../_socle/adresses.mjs";
import { servir } from "../_socle/socle-service.mjs";

/**
 * Service `taches` — la source de vérité du jeu de données.
 *
 * Il ne dépend de personne. Deux consommateurs le lisent : `charges`, qui agrège, et
 * la passerelle, qui a besoin de la liste brute. En mode « appels directs », le
 * navigateur s'ajoute à la liste.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE FICHIER EST LE POD RÉEL
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Lancé seul (`node service.mjs`), il ne sert que `/sante` et `/taches`. Aucune
 * route ne permet de casser le contrat serveur ni la forme de la charge utile — ces
 * deux pannes n'existent nulle part dans ce module, à aucune profondeur. Elles sont
 * injectées par `demo/hooks/taches.mjs`, qui compose `creerRouteurReel` ci-dessous
 * avec ses propres routes et son propre état, sans que ce fichier ait besoin d'en
 * savoir quoi que ce soit.
 */

/**
 * Renomme `statut` en `etat`. Rien d'autre ne change : ni le nom, ni le reste.
 *
 * Exportée pour que la démo (qui possède le drapeau `formeRompue`) puisse
 * l'appliquer sans dupliquer la règle de déformation.
 *
 * @param {readonly import("./donnees.mjs").Tache[]} taches
 */
export function deformer(taches) {
  return taches.map(({ statut, ...reste }) => ({ ...reste, etat: statut }));
}

/** @typedef {{ contratRompu: boolean, formeRompue: boolean }} EtatDemo */

/**
 * Construit le routeur réel.
 *
 * `lireEtatDemo` est le seul point d'extension : en production, rien ne le fournit,
 * et les deux drapeaux restent figés à `false` pour toujours.
 *
 * @param {() => EtatDemo} [lireEtatDemo]
 */
export function creerRouteurReel(lireEtatDemo = () => ({ contratRompu: false, formeRompue: false })) {
  /** @param {import("../_socle/socle-service.mjs").Requete} requete */
  return function router({ chemin }) {
    switch (chemin) {
      case "/sante":
        // Ne dépend JAMAIS de l'état applicatif : un service qui se déclare mort
        // parce qu'il répond 500 sortirait de la vue des processus, et l'essai 2
        // perdrait ce qu'il doit montrer — une panne qualifiée par un code d'état,
        // pas par une disparition.
        return { status: 200, corps: { service: "taches", vivant: true } };

      case "/taches": {
        const { contratRompu, formeRompue } = lireEtatDemo();

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
  };
}

// Lancé directement (node reel/pods/taches/service.mjs) : vrai pod, zéro route de
// démo. Importé par demo/hooks/taches.mjs, ce bloc ne s'exécute pas.
if (import.meta.url === `file://${process.argv[1]}`) {
  servir({ nom: "taches", port: PORTS.taches, router: creerRouteurReel() });
}

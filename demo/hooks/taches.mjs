// @ts-check
import { PORTS } from "../../reel/pods/_socle/adresses.mjs";
import { journaliser, servir } from "../../reel/pods/_socle/socle-service.mjs";
import { creerRouteurReel } from "../../reel/pods/taches/service.mjs";

/**
 * Surcouche de démonstration pour `taches`.
 *
 * Compose le routeur réel (`reel/pods/taches/service.mjs`) avec deux drapeaux
 * d'état et cinq routes qui n'existeraient dans aucun vrai pod : elles permettent à
 * la console (`demo/console.mjs`) de casser puis rétablir le contrat serveur
 * (essai 2) et la forme de la charge utile (essai 4), sur demande de la barre
 * d'essais.
 *
 * `contratRompu` — répond 500. Panne d'un amont ESSENTIEL : sans la liste des
 * tâches, il n'y a rien à composer. C'est la branche 503 de la passerelle.
 *
 * `formeRompue` — répond 200 avec `etat` là où le contrat dit `statut`. C'est
 * l'essai 4, que l'essai 5 rejoue une couche plus haut.
 *
 * Ces deux drapeaux sont un état d'instance, basculé par un appel HTTP. Le processus
 * ne redémarre pas : c'est bien la même instance, vivante, qui se met à mentir.
 *
 * La démo POSSÈDE l'écriture de cet état ; le routeur réel n'en reçoit qu'une
 * lecture, via le getter passé à `creerRouteurReel`. C'est ce qui garantit que
 * `reel/pods/taches/service.mjs` reste, seul, exactement ce qui tournerait en
 * production — cette composition-ci est le seul endroit du dépôt qui connaît les
 * deux à la fois, et la flèche de dépendance ne va que dans un sens : démo → réel.
 */

let contratRompu = false;
let formeRompue = false;

const routeurReel = creerRouteurReel(() => ({ contratRompu, formeRompue }));

servir({
  nom: "taches",
  port: PORTS.taches,
  router(requete) {
    switch (requete.chemin) {
      case "/etat":
        return { status: 200, corps: { contratRompu, formeRompue } };

      case "/contrat-rompu":
      case "/contrat-retabli":
        contratRompu = requete.chemin === "/contrat-rompu";
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
        formeRompue = requete.chemin === "/forme-rompue";
        journaliser({
          service: "taches",
          nature: "note",
          niveau: formeRompue ? "attention" : "normal",
          message: formeRompue
            ? "forme rompue : je servirai « etat » au lieu de « statut », en 200"
            : "forme rétablie",
        });
        return { status: 200, corps: { formeRompue } };

      // /taches, /sante, et tout le reste : délégués au pod réel.
      default:
        return routeurReel(requete);
    }
  },
});

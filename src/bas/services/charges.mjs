// @ts-check
import { origine, PORTS } from "./adresses.mjs";
import { appeler, journaliser, servir } from "./socle-service.mjs";

/**
 * Service `charges` — agrège la charge par responsable.
 *
 * Il appelle `taches` PAR LE RÉSEAU. C'est le second saut, et c'est lui qui rend
 * l'identifiant de corrélation démontrable : `taches` reçoit deux requêtes portant
 * le même identifiant, l'une venue de la passerelle, l'autre venue d'ici.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IL NE VALIDE RIEN, ET C'EST DÉLIBÉRÉ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Quand `taches` sert `etat` au lieu de `statut`, ce service ne s'en aperçoit pas.
 * Il lit `tache.statut`, obtient `undefined`, et publie un agrégat dont la
 * répartition par statut est fausse — sans exception, sans avertissement, en 200.
 *
 * C'est exactement le comportement de `mf-tableau` au-dessus de la frontière. Le
 * point n'est donc pas « le réseau vérifie » : le réseau ne vérifie rien du tout.
 * Le point est qu'UN intermédiaire vérifie, parce que quelqu'un l'a écrit dans la
 * passerelle. Mettre la même vérification ici l'affaiblirait en la banalisant, et
 * ferait croire que la conformité vient du protocole.
 */

/**
 * Budget volontairement PLUS COURT que celui de la passerelle (800 ms).
 *
 * Seul l'ORDRE compte ici, pas la valeur : si `taches` se fige, ce service doit
 * renoncer avant que la passerelle ne renonce sur lui. Sinon la panne se propage en
 * « charges ne répond plus » et le journal désigne le mauvais coupable — un
 * intermédiaire qui attribue mal une panne est pire qu'un intermédiaire absent.
 *
 * Sur la provenance du nombre lui-même, voir `passerelle.mjs` : il est calibré sur ce
 * qui se voit en salle, pas sur la latence mesurée de l'amont, qui est de l'ordre du
 * dixième de milliseconde.
 */
const BUDGET_AMONT_MS = 600;

const URL_TACHES = `${origine("taches")}/taches`;

const STATUTS = ["a-faire", "en-cours", "termine"];

/**
 * @typedef {{ nbTaches: number, chargeJours: number }} Cumul
 * @typedef {{ responsable: string, nbTaches: number, chargeJours: number,
 *             parStatut: Record<string, Cumul> }} ChargeResponsable
 *
 * Ce que ce service attend de son amont. Volontairement minimal, et déclaré ici :
 * il ne partage aucun type avec `taches`, pas plus qu'un fragment n'en partage avec
 * un autre au-dessus de la frontière.
 *
 * @typedef {{ statut?: string, responsable: string, chargeJours: number }} TacheAmont
 */

function cumulVide() {
  return { nbTaches: 0, chargeJours: 0 };
}

/** @param {readonly TacheAmont[]} taches */
function agreger(taches) {
  /** @type {Map<string, ChargeResponsable>} */
  const parResponsable = new Map();

  for (const tache of taches) {
    let ligne = parResponsable.get(tache.responsable);
    if (!ligne) {
      ligne = {
        responsable: tache.responsable,
        nbTaches: 0,
        chargeJours: 0,
        parStatut: Object.fromEntries(STATUTS.map((statut) => [statut, cumulVide()])),
      };
      parResponsable.set(tache.responsable, ligne);
    }

    ligne.nbTaches += 1;
    ligne.chargeJours += tache.chargeJours;

    // `String(undefined)` donne la chaîne « undefined », et c'est exactement ce que
    // JavaScript aurait fait tout seul. On l'écrit plutôt que de le subir : quand
    // `taches` sert « etat », l'agrégat gagne une catégorie nommée « undefined » qui
    // contient tout, et personne ne s'en plaint. Le typecheck a désigné cette ligne ;
    // il ne pouvait pas désigner l'équivalent dans `mf-tableau`, qui reçoit sa charge
    // utile d'un bus non typé.
    const cumul = (ligne.parStatut[String(tache.statut)] ??= cumulVide());
    cumul.nbTaches += 1;
    cumul.chargeJours += tache.chargeJours;
  }

  return [...parResponsable.values()].sort((a, b) => b.chargeJours - a.chargeJours);
}

servir({
  nom: "charges",
  port: PORTS.charges,
  async router({ chemin, id }) {
    switch (chemin) {
      case "/sante":
        return { status: 200, corps: { service: "charges", vivant: true } };

      case "/charges": {
        const amont = await appeler(URL_TACHES, { id, appelant: "charges", budgetMs: BUDGET_AMONT_MS });

        if (!amont.ok) {
          journaliser({
            service: "charges",
            nature: "note",
            niveau: "attention",
            id,
            message: `amont taches indisponible : ${amont.cause}`,
          });
          return {
            status: 502,
            corps: { erreur: "amont indisponible", amont: "taches", cause: amont.cause, id },
          };
        }

        // `tache.statut` peut être `undefined` — c'est le cas quand `taches` sert
        // « etat » à la place. Rien ici ne le remarque, et c'est le sujet : voir
        // l'en-tête de ce fichier.
        const charge = /** @type {{ taches?: readonly TacheAmont[] }} */ (amont.corps);

        return {
          status: 200,
          corps: {
            agrege_par: "charges",
            charges: agreger(charge.taches ?? []),
          },
        };
      }

      default:
        return { status: 404, corps: { erreur: "chemin inconnu", chemin } };
    }
  },
});

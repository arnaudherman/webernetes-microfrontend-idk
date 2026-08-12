/**
 * Socle partagé — version 1.0.
 *
 * Publié par « l'équipe socle » sous une URL immuable et versionnée. Les fragments
 * ne l'embarquent pas : ils l'importent par le spécificateur nu `@socle/bus`, que la
 * carte d'import du document résout à l'exécution.
 *
 * Les deux lignes de recensement ci-dessous sont de l'INSTRUMENTATION, pas du socle.
 * Elles servent à prouver, à l'écran, combien d'exemplaires de ce module ont été
 * chargés. C'est le seul moyen de rendre visible ce que la sémantique des modules ES
 * fait silencieusement.
 */

import { valider, VERSION_CONTRATS } from "./contrats.js";

export const VERSION = "1.0";
export const identifiant = `socle@${VERSION}#${Math.random().toString(36).slice(2, 7)}`;

globalThis.__instancesSocle ??= [];
globalThis.__instancesSocle.push({ version: VERSION, identifiant, url: import.meta.url });

const abonnements = new Map();

export function abonner(evenement, idAbonne, gestionnaire) {
  let pour = abonnements.get(evenement);
  if (!pour) {
    pour = new Map();
    abonnements.set(evenement, pour);
  }
  pour.set(idAbonne, gestionnaire);
  tracer({ type: "abonnement", evenement, idAbonne });
  return () => pour.delete(idAbonne);
}

export function publier(evenement, charge, source) {
  const destinataires = [...(abonnements.get(evenement)?.entries() ?? [])];

  // Vérification de forme AVANT remise. Une charge utile qui ne respecte pas le
  // contrat n'est remise à personne : mieux vaut un message refusé qu'un abonné
  // qui affiche un chiffre faux en se croyant juste.
  const verdict = valider(evenement, charge);

  if (!verdict.valide) {
    tracer({
      type: "refus",
      evenement,
      source,
      abonnes: [],
      charge,
      ecarts: verdict.ecarts,
      versionContrats: VERSION_CONTRATS,
    });
    // Le producteur n'apprend rien de plus qu'un zéro. Pour qu'il sache que sa
    // charge a été REFUSÉE et non simplement inécoutée, il faudrait changer la
    // signature de publier() — donc coordonner toutes les équipes qui l'appellent.
    // La vérification a un coût, et il ne s'arrête pas au validateur.
    return 0;
  }

  tracer({
    type: "publication",
    evenement,
    source,
    abonnes: destinataires.map(([identifiantAbonne]) => identifiantAbonne),
    charge,
    contractualise: verdict.contractualise,
  });

  for (const [, gestionnaire] of destinataires) gestionnaire(structuredClone(charge));
  return destinataires.length;
}

/** Instrumentation : une trace lisible par le shell, quelle que soit l'instance. */
function tracer(detail) {
  globalThis.dispatchEvent(
    new CustomEvent("socle:trace", {
      detail: { ...detail, socle: { version: VERSION, identifiant } },
    }),
  );
}

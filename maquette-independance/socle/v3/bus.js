import { valider, VERSION_CONTRATS } from "./contrats.js";

/**
 * Socle partagé — version 3.0. RUPTURE VOLONTAIRE.
 *
 * En 1.0 et 2.0, `publier()` rendait un entier : le nombre d'abonnés atteints. Un zéro
 * y voulait dire trois choses différentes — personne n'écoutait, la charge a été
 * refusée par le contrat, ou l'événement n'existe pas. Le producteur ne pouvait pas
 * les distinguer.
 *
 * La 3.0 rend un VERDICT explicite :
 *
 *   { remis: boolean, abonnes: string[], refuse: false | "contrat", ecarts: string[] }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CETTE RUPTURE COÛTE, ET QU'IL FAUT DIRE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Un socle publié est immuable au même titre que les fragments. On ne corrige donc pas
 * la 1.0 en place : on publie une 3.0, et chaque équipe migre.
 *
 * Mais la facture est plus petite qu'il n'y paraît, et c'est mesurable : SEULES les
 * équipes qui exploitaient la valeur de retour doivent être reconstruites. Celles qui
 * ne faisaient qu'appeler `publier()` ou `abonner()` ne changent pas une ligne.
 *
 * Dans cette maquette : mf-filtres doit migrer, mf-tableau non.
 */

export const VERSION = "3.0";
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

/**
 * @returns {{remis: boolean, abonnes: string[], refuse: false|"contrat", ecarts: string[]}}
 */
export function publier(evenement, charge, source) {
  const destinataires = [...(abonnements.get(evenement)?.entries() ?? [])];
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
    return { remis: false, abonnes: [], refuse: "contrat", ecarts: verdict.ecarts };
  }

  const abonnes = destinataires.map(([identifiantAbonne]) => identifiantAbonne);

  tracer({
    type: "publication",
    evenement,
    source,
    abonnes,
    charge,
    contractualise: verdict.contractualise,
  });

  for (const [, gestionnaire] of destinataires) gestionnaire(structuredClone(charge));

  // `remis` est faux quand personne n'écoute : le producteur distingue enfin
  // « refusé » de « personne n'écoute », ce que l'entier confondait.
  return { remis: abonnes.length > 0, abonnes, refuse: false, ecarts: [] };
}

function tracer(detail) {
  globalThis.dispatchEvent(
    new CustomEvent("socle:trace", {
      detail: { ...detail, socle: { version: VERSION, identifiant } },
    }),
  );
}

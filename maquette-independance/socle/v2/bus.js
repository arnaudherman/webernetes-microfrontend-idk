/**
 * Socle partagé — version 2.0.
 *
 * Strictement la même API que la 1.0. Une seule chose change : le numéro de version.
 * C'est délibéré — la démonstration de coexistence ne porte pas sur une
 * incompatibilité d'API, mais sur le fait que deux URL distinctes produisent deux
 * INSTANCES distinctes, donc deux états distincts, même quand le code est identique.
 *
 * Il n'y a pas de faute d'implémentation à trouver dans ce fichier. C'est le propos.
 */

import { valider, VERSION_CONTRATS } from "./contrats.js";

export const VERSION = "2.0";
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

function tracer(detail) {
  globalThis.dispatchEvent(
    new CustomEvent("socle:trace", {
      detail: { ...detail, socle: { version: VERSION, identifiant } },
    }),
  );
}

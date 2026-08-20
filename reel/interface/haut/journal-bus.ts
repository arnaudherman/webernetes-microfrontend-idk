import type { Trace } from "./bus";

/**
 * Journal du bus.
 *
 * Il consigne ce que le bus sait, et le bus ne sait pas grand-chose : quel événement,
 * émis par qui, remis à combien d'abonnés, avec quelle charge utile. Il n'y a ni code
 * d'état, ni durée, ni chaîne d'acheminement, ni réessai — non par paresse, mais
 * parce que rien de tout cela n'existe.
 *
 * Ce journal n'est jamais fusionné avec le journal collecté de la moitié basse.
 *
 * Une ligne « 0 abonné » n'est pas peinte en rouge par qui la consomme. Ce n'est pas
 * une erreur : c'est un fait, et personne dans le système ne le considère comme
 * anormal. Lui donner l'apparence d'une alerte serait prêter au bus une vigilance
 * qu'il n'a pas.
 *
 * Ce fichier ne fait qu'enregistrer et exposer : l'instrumentation est une capacité
 * réelle d'un bus, indépendante de toute salle. Le rendu de ce journal à l'écran vit
 * dans `demo/frontend/haut/rendu-journal-bus.ts`, qui consomme `observerJournalBus`
 * sans que ce module-ci ait besoin de savoir qu'un écran existe.
 */

export interface LigneBus {
  readonly cle: string;
  readonly horodatage: number;
  readonly evenement: string;
  readonly source: string;
  readonly abonnes: readonly string[];
  readonly charge: string;
}

/** Plafond partagé avec le rendu : au-delà, les plus anciennes lignes sont perdues. */
export const PLAFOND = 300;
const LONGUEUR_CHARGE = 150;

const lignes: LigneBus[] = [];
const observateurs = new Set<(lignes: readonly LigneBus[]) => void>();

let compteurCle = 0;
let publies = 0;
let perdus = 0;

export function journalBus(): readonly LigneBus[] {
  return lignes;
}

/** Messages publiés depuis le chargement de la page. */
export function messagesPublies(): number {
  return publies;
}

/** Messages partis vers zéro abonné. Aucun d'eux n'a produit le moindre signal. */
export function messagesPerdus(): number {
  return perdus;
}

export function observerJournalBus(
  observateur: (lignes: readonly LigneBus[]) => void,
): () => void {
  observateurs.add(observateur);
  observateur(lignes);
  return () => observateurs.delete(observateur);
}

function serialiser(charge: unknown): string {
  let texte: string;
  try {
    texte = JSON.stringify(charge) ?? String(charge);
  } catch {
    return "[charge non sérialisable]";
  }
  if (texte.length <= LONGUEUR_CHARGE) return texte;
  return `${texte.slice(0, LONGUEUR_CHARGE)}… (${texte.length} caractères)`;
}

/** Le traceur remis au bus par le shell. */
export function tracer(trace: Trace): void {
  compteurCle += 1;
  publies += 1;
  if (trace.abonnes.length === 0) perdus += 1;

  lignes.push({
    cle: `b${compteurCle}`,
    horodatage: trace.horodatage,
    evenement: trace.evenement,
    source: trace.source,
    abonnes: trace.abonnes,
    charge: serialiser(trace.charge),
  });

  if (lignes.length > PLAFOND) lignes.splice(0, lignes.length - PLAFOND);
  for (const observateur of observateurs) observateur(lignes);
}

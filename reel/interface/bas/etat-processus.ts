/**
 * Vue vivante des trois services.
 *
 * La console n'y figure pas : elle est l'établi, pas un composant, et l'écran
 * l'affiche à part sous une étiquette qui le dit.
 *
 * Cette vue repose sur une distinction que rien, ici, ne peut deviner tout seul :
 *
 *   vivant  — le processus existe. La console le sait parce qu'elle en est le parent,
 *             pas parce qu'elle l'a interrogé.
 *   repond  — il répond aux sondes. C'est une autre question, et la réponse peut
 *             différer : un processus figé par SIGSTOP est vivant et muet.
 *
 * Tout l'essai 3 tient dans cet écart. Un système qui ne distingue pas « mort » de
 * « vivant mais muet » traite les deux pannes de la même façon, alors qu'elles
 * n'appellent ni le même diagnostic ni la même décision de dégradation.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HISTORIQUE : CE QUE CETTE VUE A PERDU EN DEVENANT RÉELLE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La version simulée montrait une grille d'unités de calcul recréées automatiquement
 * après suppression. Rien ne recrée un processus mort ici : la moitié basse n'a plus
 * de contrôleur ni de planificateur, et il n'y a donc plus de reprise automatique à
 * montrer. C'est le prix des vrais processus, il se paie une fois, et il s'échange
 * contre des pannes qu'on ne peut plus accuser d'être simulées.
 */

export type Presentation = "absent" | "actif" | "fige" | "muet";

export interface EtatProcessus {
  readonly nom: string;
  readonly port: number;
  readonly pid?: number;
  readonly vivant: boolean;
  readonly repond: boolean;
  readonly fige: boolean;
  readonly depuisMs?: number;
  readonly requetes: number;
  readonly dernierStatus?: number;
}

const processus = new Map<string, EtatProcessus>();
const observateurs = new Set<(processus: readonly EtatProcessus[]) => void>();
const observateursTrafic = new Set<(nom: string, status: number | undefined) => void>();

function liste(): readonly EtatProcessus[] {
  return [...processus.values()];
}

export function observerProcessus(
  observateur: (processus: readonly EtatProcessus[]) => void,
): () => void {
  observateurs.add(observateur);
  observateur(liste());
  return () => observateurs.delete(observateur);
}

/** Fait clignoter la carte du processus qui vient de répondre. */
export function observerTrafic(
  observateur: (nom: string, status: number | undefined) => void,
): () => void {
  observateursTrafic.add(observateur);
  return () => observateursTrafic.delete(observateur);
}

export function processusActifs(): readonly EtatProcessus[] {
  return liste();
}

export function presentation(etat: EtatProcessus): Presentation {
  if (!etat.vivant) return "absent";
  if (etat.fige) return "fige";
  if (!etat.repond) return "muet";
  return "actif";
}

/** Instantané complet envoyé par la console à chaque changement. */
export function accepterProcessus(instantane: readonly EtatProcessus[]): void {
  processus.clear();
  for (const etat of instantane) processus.set(etat.nom, etat);
  const gele = liste();
  for (const observateur of observateurs) observateur(gele);
}

export function signalerTrafic(nom: string, status: number | undefined): void {
  for (const observateur of observateursTrafic) observateur(nom, status);
}

export function viderEtatProcessus(): void {
  processus.clear();
  for (const observateur of observateurs) observateur(liste());
}

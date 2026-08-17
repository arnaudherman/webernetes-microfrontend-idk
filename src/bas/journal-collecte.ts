/**
 * Le journal collecté.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE JOURNAL N'EST PLUS UNE OBSERVATION, C'EST UN RAPPORT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Dans la version simulée, ce journal ÉTAIT l'événement : la page écoutait le
 * trafic dans son propre fil d'exécution, et ce qu'elle affichait ne pouvait pas
 * diverger de ce qui se produisait. Les services tournent maintenant dans quatre
 * processus. La page ne voit plus rien : on lui raconte.
 *
 * Ce qu'on y perd est réel et doit être dit à l'écran plutôt que masqué :
 *
 *   - le journal peut être en retard, tronqué au plafond, ou incomplet si le flux
 *     s'est rompu quelques secondes ;
 *   - il ne montre que ce que les processus ont bien voulu écrire ;
 *   - il dépend d'un canal, et ce canal est lui-même une dépendance réseau qui
 *     peut tomber — auquel cas la page l'annonce au lieu de se taire.
 *
 * Ce qu'on y gagne est le pendant exact : la moitié basse est désormais observée
 * comme on observe un système réel, c'est-à-dire par le récit qu'il fait de
 * lui-même. Au-dessus de la frontière on VOIT ; en dessous on est INFORMÉ. Les deux
 * moitiés perdent quelque chose de symétrique, et c'est plus juste que la version
 * précédente où le bas était magiquement transparent.
 *
 * Chaque ligne porte son origine — rapportée par un service, ou constatée par la
 * console. Voir `services/console.mjs` : sans cette distinction, on pourrait
 * soupçonner le journal de raconter ce que la console a décidé plutôt que ce qui
 * s'est produit.
 */

export type OrigineLigne = "service" | "console";
export type NatureLigne = "requete" | "note" | "commande" | "systeme";

export interface LigneCollectee {
  readonly cle: string;
  readonly origine: OrigineLigne;
  readonly service?: string;
  readonly horodatage: number;
  readonly nature: NatureLigne;
  readonly methode?: string;
  readonly chemin?: string;
  readonly status?: number;
  readonly dureeMs?: number;
  readonly id?: string;
  readonly de?: string;
  readonly message?: string;
  readonly niveau?: "normal" | "attention";
}

const PLAFOND = 300;

const lignes: LigneCollectee[] = [];
const vues = new Set<string>();
const observateurs = new Set<(lignes: readonly LigneCollectee[]) => void>();

let compteur5xx = 0;

export function journalCollecte(): readonly LigneCollectee[] {
  return lignes;
}

export function codes5xxRecus(): number {
  return compteur5xx;
}

export function observerJournalCollecte(
  observateur: (lignes: readonly LigneCollectee[]) => void,
): () => void {
  observateurs.add(observateur);
  observateur(lignes);
  return () => observateurs.delete(observateur);
}

/**
 * Accepte une ligne venue de la console.
 *
 * La console rejoue son tampon à chaque connexion : après une rupture du flux, les
 * mêmes lignes reviennent. On les écarte sur leur clé, qui est attribuée par la
 * console et ne se répète pas dans une session. Sans ce filtre, une reconnexion
 * doublerait l'histoire — et un journal qui invente des événements est pire qu'un
 * journal absent.
 */
export function accepterLigne(ligne: LigneCollectee): void {
  if (vues.has(ligne.cle)) return;
  vues.add(ligne.cle);

  lignes.push(ligne);
  if (ligne.status !== undefined && ligne.status >= 500) compteur5xx += 1;
  if (lignes.length > PLAFOND) lignes.splice(0, lignes.length - PLAFOND);

  for (const observateur of observateurs) observateur(lignes);
}

export function viderJournalCollecte(): void {
  lignes.length = 0;
  vues.clear();
  compteur5xx = 0;
  for (const observateur of observateurs) observateur(lignes);
}

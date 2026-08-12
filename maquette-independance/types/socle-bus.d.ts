/**
 * Déclaration de types du socle partagé.
 *
 * `@socle/bus` n'est pas un paquet npm : c'est un spécificateur nu résolu à l'exécution
 * par la carte d'import du document. TypeScript n'a donc aucun moyen de le trouver, et
 * les cinq fragments compilaient jusqu'ici sans aucune vérification.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUI EST TYPÉ ICI, ET CE QUI NE L'EST PAS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * L'API du socle est typée : les signatures de `abonner` et `publier`, la forme du
 * verdict. C'est utile et sans effet de bord — un fragment qui appellerait `publier`
 * avec deux arguments ne compile plus.
 *
 * Les CHARGES UTILES restent `unknown`. C'est délibéré et c'est tout le propos de
 * l'étude : la forme de ce qui transite entre deux équipes n'est vérifiée par aucun
 * compilateur, seulement par le validateur du socle, à l'exécution. Typer ici la forme
 * de `filtre:change` reviendrait à supposer résolu le problème qu'on démontre.
 *
 * Ce fichier décrit un contrat que rien ne confronte au code réel du socle : il est
 * écrit à la main, à côté d'un module servi en JavaScript nu. C'est un contrat de plus,
 * tenu par quelqu'un — exactement ce que l'étude conclut.
 */
declare module "@socle/bus" {
  /** Numéro de version du socle effectivement chargé. */
  export const VERSION: string;

  /** Identifiant unique de CETTE instance de module. Deux URL, deux identifiants. */
  export const identifiant: string;

  export type Desabonnement = () => void;

  /**
   * Verdict rendu par `publier` depuis le socle 3.0.
   *
   * Avant la 3.0, `publier` rendait un entier, et un zéro y voulait dire trois choses
   * différentes : refusé par le contrat, personne n'écoutait, ou événement inconnu.
   */
  export interface Verdict {
    /** Vrai si au moins un abonné a reçu la charge. */
    readonly remis: boolean;
    /** Identifiants des abonnés atteints. */
    readonly abonnes: readonly string[];
    /** `"contrat"` si la charge a été refusée avant remise, `false` sinon. */
    readonly refuse: false | "contrat";
    /** Écarts relevés par le validateur, vide si la charge est conforme. */
    readonly ecarts: readonly string[];
  }

  /**
   * La charge remise est `unknown` : c'est à l'abonné de déclarer ce qu'il attend, et
   * rien ne garantit que l'émetteur soit d'accord. Voir l'en-tête de ce fichier.
   */
  export function abonner(
    evenement: string,
    idAbonne: string,
    gestionnaire: (charge: unknown) => void,
  ): Desabonnement;

  export function publier(evenement: string, charge: unknown, source: string): Verdict;
}

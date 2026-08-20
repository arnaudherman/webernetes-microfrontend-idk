import type { Bus } from "./bus";

/**
 * Le contrat d'un fragment.
 *
 * C'est un objet d'architecture, pas un détail d'implémentation : le shell l'affiche
 * dans l'en-tête de chaque module, et c'est la seule chose qu'il connaisse d'un
 * fragment en dehors de son nom de balise.
 *
 * Ce contrat est déclaratif et n'est vérifié par personne à l'exécution. Un fragment
 * peut annoncer publier `filtre:change` et publier tout autre chose ; rien ne le
 * signalera. C'est exactement le point de l'essai 5.
 */
export interface Contrat {
  readonly nom: string;
  readonly version: string;
  readonly publie: readonly string[];
  readonly consomme: readonly string[];
}

/** Ce qu'un fragment expose au shell : un élément personnalisé qui accepte un bus. */
export interface Fragment extends HTMLElement {
  bus?: Bus;
}

export interface ConstructeurFragment {
  new (): Fragment;
  readonly contrat: Contrat;
}

/**
 * Lit le contrat déclaré par un élément personnalisé. Le shell ne connaît que le nom
 * de la balise ; il passe par le registre des éléments personnalisés pour le reste.
 */
export function contratDe(nomBalise: string): Contrat | undefined {
  const constructeur = customElements.get(nomBalise) as ConstructeurFragment | undefined;
  return constructeur?.contrat;
}

export function formaterContrat(contrat: Contrat): string {
  const publie = contrat.publie.length > 0 ? contrat.publie.join(", ") : "rien";
  const consomme = contrat.consomme.length > 0 ? contrat.consomme.join(", ") : "rien";
  return `${contrat.nom}:${contrat.version} — publie ${publie} — consomme ${consomme}`;
}

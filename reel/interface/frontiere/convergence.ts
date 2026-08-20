/**
 * Qualification des erreurs, côté navigateur — et constat de ce qu'elle ne peut pas faire.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HISTORIQUE : CE MODULE A CHANGÉ DE SUJET, ET LE NOUVEAU EST PLUS INTÉRESSANT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Il qualifiait autrefois les phases de démarrage d'une moitié basse simulée dans
 * l'onglet. Avec de vrais processus, ce problème a disparu — et un autre l'a
 * remplacé, qui est un résultat de l'étude plutôt qu'un détail d'implémentation :
 *
 *   **Le navigateur ne dit jamais pourquoi un appel a échoué.**
 *
 * `TypeError: Failed to fetch` est rendu à l'identique pour :
 *   - un service mort (`ECONNREFUSED` côté système) ;
 *   - un refus CORS ;
 *   - un port fermé, filtré, ou une machine éteinte ;
 *   - un certificat refusé, une résolution de nom impossible.
 *
 * Ce n'est pas une lacune de l'implémentation, c'est une décision de sécurité de la
 * plateforme : distinguer ces cas laisserait une page sonder le réseau de la machine
 * qui l'exécute. Elle est justifiée, et elle est définitive.
 *
 * Conséquence pour la thèse, et il faut l'énoncer telle quelle : déplacer une
 * frontière de service vers le navigateur ne coûte pas seulement le code d'état, le
 * délai et le réessai. Ça coûte la CAUSE. Un intermédiaire côté réseau est le dernier
 * endroit où elle existe encore — et c'est pourquoi la passerelle renvoie
 * explicitement `cause` dans ses charges utiles d'erreur : elle transporte à la main
 * l'information que la plateforme masque.
 *
 * La même constatation figure déjà dans la maquette d'indépendance, à propos d'un
 * module chargé depuis une origine sans CORS : « le navigateur protège, mais il ne
 * dit pas de quoi ». Deux dispositifs indépendants, la même limite.
 */

export type PhaseConvergence =
  | "prete"
  | "opaque"
  | "garde-reseau"
  | "url-invalide"
  | "inattendue";

export interface EtatConvergence {
  readonly phase: PhaseConvergence;
  /** Formulation destinée à l'écran, lisible par un architecte. */
  readonly libelle: string;
  /** Message brut, affiché en police à chasse fixe. */
  readonly detail: string;
}

export const CONVERGENCE_PRETE: EtatConvergence = {
  phase: "prete",
  libelle: "services joignables",
  detail: "",
};

function message(erreur: unknown): string {
  if (erreur instanceof Error) return `${erreur.name}: ${erreur.message}`;
  return String(erreur);
}

export function qualifier(erreur: unknown): EtatConvergence {
  const detail = message(erreur);
  const texte = erreur instanceof Error ? erreur.message : String(erreur);

  // Le garde-réseau est le seul à donner une raison, parce que c'est nous qui
  // l'avons écrite. Elle est donc, littéralement, la seule cause que la page connaît.
  if (/garde-reseau/.test(texte)) {
    return {
      phase: "garde-reseau",
      libelle:
        "sortie refusée par le garde-réseau : l'origine visée n'est pas l'une des quatre déclarées",
      detail,
    };
  }

  if (/^Failed to parse URL|Invalid URL/.test(texte)) {
    return {
      phase: "url-invalide",
      libelle: "URL invalide",
      detail,
    };
  }

  if (/Failed to fetch|NetworkError|Load failed/.test(texte)) {
    return {
      phase: "opaque",
      libelle: "appel échoué, cause inconnue — le navigateur ne la communique pas",
      detail:
        `${detail} — service arrêté, refus CORS ou port fermé : indiscernables ici. ` +
        `Le journal collecté, en dessous, sait laquelle des trois.`,
    };
  }

  return { phase: "inattendue", libelle: "erreur inattendue", detail };
}

/**
 * Qualification des erreurs de convergence du cluster.
 *
 * `init()` rend la main bien avant que le cluster soit routable, et il n'existe aucun
 * signal de disponibilité. Pendant environ deux secondes, les appels échouent — et ils
 * échouent sous DEUX formes qui ne se rattrapent pas de la même façon :
 *
 *   Phase A, vers t+30 ms   Error nu. Pas de `.cause`, pas de `.code`.
 *                           message « no DNS listener on 10.96.0.10:53 »
 *                           L'alias `node-1` n'est pas enregistré par `init()` mais
 *                           par le pod kube-proxy ; tant qu'il n'a pas démarré, la
 *                           résolution retombe sur CoreDNS, qui n'écoute pas encore.
 *
 *   Phase B, t+280 à 1815 ms  TypeError « fetch failed », avec
 *                             `cause.code === "ECONNREFUSED"`.
 *                             Le Service existe, aucun pod n'est encore prêt derrière.
 *
 *   Phase C, vers t+2100 ms   200.
 *
 * Un `catch` qui lit `erreur.cause.code` sans garde plante sur la phase A. D'où ce
 * module : l'écran de démarrage annonce ce qui se passe réellement plutôt que
 * d'afficher une erreur générique pendant deux secondes.
 */

export type PhaseConvergence =
  | "prete"
  | "control-plane"
  | "aucun-pod-pret"
  | "nom-inconnu"
  | "url-invalide"
  | "cluster-arrete"
  | "inattendue";

export interface EtatConvergence {
  readonly phase: PhaseConvergence;
  /** Formulation destinée à l'écran, lisible par un architecte. */
  readonly libelle: string;
  /** Message brut, affiché en police à chasse fixe. */
  readonly detail: string;
}

interface CauseEventuelle {
  readonly code?: string;
  readonly port?: number;
  readonly message?: string;
}

function cause(erreur: unknown): CauseEventuelle | undefined {
  if (typeof erreur !== "object" || erreur === null) return undefined;
  const brute = (erreur as { cause?: unknown }).cause;
  if (typeof brute !== "object" || brute === null) return undefined;
  return brute as CauseEventuelle;
}

function message(erreur: unknown): string {
  if (erreur instanceof Error) {
    const interne = cause(erreur)?.message;
    return interne ? `${erreur.name}: ${erreur.message} — ${interne}` : `${erreur.name}: ${erreur.message}`;
  }
  return String(erreur);
}

export const CONVERGENCE_PRETE: EtatConvergence = {
  phase: "prete",
  libelle: "cluster prêt",
  detail: "",
};

export function qualifier(erreur: unknown): EtatConvergence {
  const detail = message(erreur);
  const texte = erreur instanceof Error ? erreur.message : String(erreur);
  const interne = cause(erreur);

  if (/^no DNS listener on /.test(texte)) {
    return {
      phase: "control-plane",
      libelle: "démarrage du plan de contrôle — CoreDNS et kube-proxy prennent la main",
      detail,
    };
  }

  if (interne?.code === "ECONNREFUSED" && (interne.port === 53 || /:53\b/.test(interne.message ?? ""))) {
    return {
      phase: "control-plane",
      libelle: "démarrage du plan de contrôle — le service DNS n'écoute pas encore",
      detail,
    };
  }

  if (interne?.code === "ECONNREFUSED") {
    return {
      phase: "aucun-pod-pret",
      libelle: "le Service existe, aucun pod n'est encore prêt derrière",
      detail,
    };
  }

  if (interne?.code === "ENOTFOUND") {
    return {
      phase: "nom-inconnu",
      libelle: "nom inconnu du cluster",
      detail,
    };
  }

  if (/^Failed to parse URL/.test(texte)) {
    return {
      phase: "url-invalide",
      libelle: "URL invalide — elle doit être absolue, en http, avec un port explicite",
      detail,
    };
  }

  if (/garde-reseau/.test(texte)) {
    return {
      phase: "nom-inconnu",
      libelle:
        "nom non résolu par le cluster : la requête a été interceptée avant de sortir de l'onglet",
      detail,
    };
  }

  return { phase: "inattendue", libelle: "erreur inattendue", detail };
}

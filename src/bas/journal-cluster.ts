import type { Cluster, CoreV1Event, NetworkHop, HttpRequest } from "@ngrok/webernetes";
import { estSonde } from "./entetes";

/**
 * Journal du cluster.
 *
 * Il n'invente aucune instrumentation : tout vient de mécanismes natifs du paquet.
 *   - `cluster.on("request" | "response")` pour le trafic HTTP simulé ;
 *   - `cluster.informer("events")` pour les Events Kubernetes.
 *
 * Quatre faits mesurés commandent ce code :
 *   1. `event.request` est la MÊME référence entre la requête et la réponse : on
 *      corrèle par identité d'objet plutôt que par en-tête.
 *   2. `chain` est INVERSÉE sur l'événement de réponse.
 *   3. Une erreur de routage émet une requête SANS réponse : apparier strictement
 *      laisserait des lignes ouvertes.
 *   4. Les sondes du kubelet représentent environ 35 % du trafic. Sans filtre, le
 *      journal est illisible.
 *
 * Ce journal n'est jamais fusionné avec celui du bus. Leur séparation est le propos.
 */

export type NatureLigne = "requete" | "evenement";

export interface LigneCluster {
  readonly cle: string;
  readonly horodatage: number;
  readonly nature: NatureLigne;
  readonly methode?: string;
  readonly chemin?: string;
  readonly hote?: string;
  readonly status?: number;
  readonly dureeMs?: number;
  readonly latenceSimuleeMs?: number;
  readonly chaine?: string;
  readonly erreur?: string;
  readonly niveau?: string;
  readonly motif?: string;
  readonly objet?: string;
  readonly source?: string;
  readonly message?: string;
}

const PLAFOND = 300;

const lignes: LigneCluster[] = [];
const observateurs = new Set<(lignes: readonly LigneCluster[]) => void>();

let compteurCle = 0;
let compteur5xx = 0;

export function journalCluster(): readonly LigneCluster[] {
  return lignes;
}

export function codes5xxRecus(): number {
  return compteur5xx;
}

export function observerJournalCluster(
  observateur: (lignes: readonly LigneCluster[]) => void,
): () => void {
  observateurs.add(observateur);
  observateur(lignes);
  return () => observateurs.delete(observateur);
}

function pousser(ligne: Omit<LigneCluster, "cle">): void {
  compteurCle += 1;
  lignes.push({ ...ligne, cle: `c${compteurCle}` });
  // Les Events Kubernetes ne sont pas agrégés et n'ont aucune durée de vie :
  // le journal croîtrait sans limite.
  if (lignes.length > PLAFOND) lignes.splice(0, lignes.length - PLAFOND);
  for (const observateur of observateurs) observateur(lignes);
}

function etiquetteSaut(saut: NetworkHop): string {
  switch (saut.type) {
    case "pod":
      return `pod:${saut.resource.metadata?.name ?? "?"}`;
    case "node":
      return `nœud:${saut.resource.metadata?.name ?? "?"}`;
    case "service":
      return `svc:${saut.resource.metadata?.name ?? "?"}`;
    case "external":
      return `externe:${saut.host}`;
  }
}

function chaine(sauts: readonly NetworkHop[], inversee: boolean): string {
  const ordonnes = inversee ? [...sauts].reverse() : [...sauts];
  // Le nœud d'origine figure deux fois de suite quand l'appel entre par un NodePort.
  // C'est exact mais illisible en projection : on replie les répétitions immédiates.
  const etiquettes = ordonnes.map(etiquetteSaut);
  return etiquettes.filter((etiquette, index) => etiquette !== etiquettes[index - 1]).join(" → ");
}

/** Instant en millisecondes d'un horodatage k8s, qui peut être une Date ou une chaîne. */
function instant(valeur: unknown): number | undefined {
  if (valeur instanceof Date) return valeur.getTime();
  if (typeof valeur === "string") {
    const millisecondes = new Date(valeur).getTime();
    return Number.isNaN(millisecondes) ? undefined : millisecondes;
  }
  return undefined;
}

export interface BranchementJournal {
  readonly detacher: () => Promise<void>;
}

/**
 * Branche le journal sur le cluster. Les écouteurs réseau doivent être posés AVANT
 * `init()`, l'informateur d'Events APRÈS.
 */
export function brancherEcouteursReseau(cluster: Cluster): () => void {
  const debuts = new WeakMap<HttpRequest, number>();

  const surRequete = (evenement: {
    request: HttpRequest;
    chain: NetworkHop[];
    latencyMs: number;
    error?: Error;
  }): void => {
    if (estSonde(evenement.request)) return;
    debuts.set(evenement.request, performance.now());

    // Erreur de routage : aucune réponse ne suivra, la ligne se ferme ici.
    if (evenement.error) {
      debuts.delete(evenement.request);
      pousser({
        horodatage: Date.now(),
        nature: "requete",
        methode: evenement.request.method,
        chemin: evenement.request.url.pathname,
        hote: evenement.request.host || evenement.request.url.host,
        chaine: chaine(evenement.chain, false),
        latenceSimuleeMs: evenement.latencyMs,
        erreur: evenement.error.message,
      });
    }
  };

  const surReponse = (evenement: {
    request: HttpRequest;
    response?: { status: number };
    error?: Error;
    chain: NetworkHop[];
    latencyMs: number;
  }): void => {
    if (estSonde(evenement.request)) return;
    const debut = debuts.get(evenement.request);
    debuts.delete(evenement.request);

    const status = evenement.response?.status;
    if (status !== undefined && status >= 500) compteur5xx += 1;

    pousser({
      horodatage: Date.now(),
      nature: "requete",
      methode: evenement.request.method,
      chemin: evenement.request.url.pathname,
      hote: evenement.request.host || evenement.request.url.host,
      status,
      dureeMs: debut === undefined ? undefined : Math.round(performance.now() - debut),
      latenceSimuleeMs: evenement.latencyMs,
      chaine: chaine(evenement.chain, true),
      erreur: evenement.error?.message,
    });
  };

  cluster.on("request", surRequete);
  cluster.on("response", surReponse);

  return () => {
    cluster.off("request", surRequete);
    cluster.off("response", surReponse);
  };
}

/** Informateur sur les Events Kubernetes. À créer après `init()`. */
export function brancherEvenements(cluster: Cluster): { stop: () => Promise<void> } {
  const informateur = cluster.informer(
    "events",
    (type, evenement: CoreV1Event) => {
      if (type !== "add") return;
      if (evenement.involvedObject?.namespace !== "default") return;

      pousser({
        horodatage:
          instant(evenement.eventTime) ??
          instant(evenement.lastTimestamp) ??
          instant(evenement.firstTimestamp) ??
          Date.now(),
        nature: "evenement",
        niveau: evenement.type ?? "Normal",
        motif: evenement.reason ?? "?",
        objet: `${evenement.involvedObject?.kind ?? "?"}/${evenement.involvedObject?.name ?? "?"}`,
        source: evenement.source?.component ?? evenement.reportingComponent ?? "?",
        message: evenement.message ?? "",
      });
    },
    {
      // `informer.stop()` déclenche systématiquement un AbortError : sans ce filtre,
      // chaque démontage afficherait une erreur.
      onError: (erreur: unknown) => {
        if ((erreur as Error | undefined)?.name !== "AbortError") console.warn(erreur);
      },
    },
  );

  return { stop: () => informateur.stop() };
}

export function viderJournalCluster(): void {
  lignes.length = 0;
  compteur5xx = 0;
  for (const observateur of observateurs) observateur(lignes);
}

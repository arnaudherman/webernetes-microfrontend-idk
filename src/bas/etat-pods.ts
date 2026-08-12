import type { Cluster, NetworkHop, V1Pod, HttpRequest } from "@ngrok/webernetes";
import { estSonde } from "./entetes";

/**
 * Vue vivante des pods, alimentée par l'informateur natif du paquet.
 *
 * Trois pièges mesurés, tous traités ici :
 *   - le tout premier événement « add » d'un pod n'a NI phase, NI IP, NI nœud, NI
 *     statut de conteneur : la carte doit tolérer un statut entièrement vide ;
 *   - un pod supprimé volontairement passe par `phase: "Failed"` pendant environ une
 *     seconde avant de disparaître. Le colorer en rouge afficherait un faux échec à
 *     chaque essai. On regarde `deletionTimestamp` d'abord ;
 *   - après une suppression, il existe une fenêtre de sur-effectif d'environ 1,8 s
 *     pendant laquelle quatre objets Pod coexistent pour trois réplicas. Le compteur
 *     ignore donc les pods en cours de suppression.
 */

export type Presentation = "attente" | "actif" | "terminaison" | "echec";

export interface EtatPod {
  readonly uid: string;
  readonly nom: string;
  readonly app: string;
  readonly phase: string;
  readonly presentation: Presentation;
  readonly ip: string;
  readonly noeud: string;
  readonly pret: boolean;
  readonly redemarrages: number;
}

const pods = new Map<string, EtatPod>();
const observateurs = new Set<(pods: readonly EtatPod[]) => void>();
const observateursTrafic = new Set<(nomPod: string, status: number | undefined) => void>();

function liste(): readonly EtatPod[] {
  return [...pods.values()].sort((a, b) => a.nom.localeCompare(b.nom));
}

function diffuser(): void {
  const instantane = liste();
  for (const observateur of observateurs) observateur(instantane);
}

export function observerPods(observateur: (pods: readonly EtatPod[]) => void): () => void {
  observateurs.add(observateur);
  observateur(liste());
  return () => observateurs.delete(observateur);
}

export function observerTrafic(
  observateur: (nomPod: string, status: number | undefined) => void,
): () => void {
  observateursTrafic.add(observateur);
  return () => observateursTrafic.delete(observateur);
}

export function podsActifs(): readonly EtatPod[] {
  return liste();
}

/** Réplicas réellement prêts d'une application, hors pods en cours de suppression. */
export function comptePrets(app: string): number {
  return liste().filter((pod) => pod.app === app && pod.pret && pod.presentation !== "terminaison")
    .length;
}

function presentation(pod: V1Pod, phase: string): Presentation {
  if (pod.metadata?.deletionTimestamp) return "terminaison";
  if (phase === "Succeeded") return "terminaison";
  if (phase === "Failed") return "echec";
  if (phase === "Running") return "actif";
  return "attente";
}

function convertir(pod: V1Pod): EtatPod | undefined {
  const uid = pod.metadata?.uid;
  const nom = pod.metadata?.name;
  if (!uid || !nom) return undefined;

  const phase = pod.status?.phase ?? "";
  const conteneurs = pod.status?.containerStatuses ?? [];

  return {
    uid,
    nom,
    app: pod.metadata?.labels?.["app"] ?? "—",
    phase: phase || "—",
    presentation: presentation(pod, phase),
    ip: pod.status?.podIP ?? "—",
    noeud: pod.spec?.nodeName ?? "—",
    pret:
      conteneurs.length > 0 &&
      conteneurs.every((conteneur) => conteneur.ready === true) &&
      !pod.metadata?.deletionTimestamp,
    redemarrages: conteneurs.reduce((total, conteneur) => total + (conteneur.restartCount ?? 0), 0),
  };
}

/** Informateur sur les pods du namespace default. À créer après `init()`. */
export function brancherEtatPods(cluster: Cluster): { stop: () => Promise<void> } {
  const informateur = cluster.informer(
    "pods",
    (type, pod: V1Pod) => {
      const uid = pod.metadata?.uid;
      if (!uid) return;

      if (type === "delete") {
        pods.delete(uid);
      } else {
        const etat = convertir(pod);
        if (etat) pods.set(uid, etat);
      }
      diffuser();
    },
    {
      namespace: "default",
      onError: (erreur: unknown) => {
        if ((erreur as Error | undefined)?.name !== "AbortError") console.warn(erreur);
      },
    },
  );

  return { stop: () => informateur.stop() };
}

/**
 * Signale à la vue quel pod vient de répondre, pour faire clignoter sa carte.
 * Le dernier saut de la chaîne inversée d'une réponse est l'émetteur de la réponse.
 */
export function brancherTrafic(cluster: Cluster): () => void {
  const surReponse = (evenement: {
    request: HttpRequest;
    response?: { status: number };
    chain: NetworkHop[];
  }): void => {
    if (estSonde(evenement.request)) return;
    const saut = evenement.chain.find((etape) => etape.type === "pod");
    const nom = saut?.type === "pod" ? saut.resource.metadata?.name : undefined;
    if (!nom) return;
    for (const observateur of observateursTrafic) observateur(nom, evenement.response?.status);
  };

  cluster.on("response", surReponse);
  return () => {
    cluster.off("response", surReponse);
  };
}

export function viderEtatPods(): void {
  pods.clear();
  diffuser();
}

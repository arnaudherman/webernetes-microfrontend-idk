import { Cluster, newLatencyProvider } from "@ngrok/webernetes";
import { estSonde } from "./entetes";
import { ImageCharges } from "./images/image-charges";
import { ImageTaches } from "./images/image-taches";
import { MANIFESTES } from "./manifestes";

/**
 * Cycle de vie du cluster.
 *
 * Webernetes simule fidèlement Kubernetes dans l'onglet ; il n'exécute rien pour de
 * vrai. Le contrôle est réel, la charge de travail est simulée.
 *
 * Trois faits contraignent ce module :
 *  - `init()` rend la main AVANT que le cluster soit routable ; il n'existe aucun
 *    signal de disponibilité, il faut interroger le réseau lui-même ;
 *  - `close()` est le seul nettoyage, et il est indispensable sous rechargement à
 *    chaud : un cluster laisse sinon entre 21 et 42 minuteurs permanents ;
 *  - un cluster fermé n'est pas réutilisable, il faut en construire un nouveau.
 */

/**
 * Latence injectée sur le trafic applicatif, pour que la traversée de la frontière
 * dure assez longtemps pour être vue en salle. Les sondes restent à zéro : les
 * ralentir déclencherait des `Unhealthy` en cascade.
 *
 * L'événement réseau est émis immédiatement avec `latencyMs`, PUIS l'attente a lieu.
 * On peut donc animer pendant exactement cette durée avant que le pod ne reçoive.
 */
export const LATENCE_REQUETE_MS = 90;
export const LATENCE_REPONSE_MS = 60;

export interface CrochetsDemarrage {
  /** Appelé après la construction, avant `init()` : brancher ici les écouteurs réseau. */
  readonly avantInit?: (cluster: Cluster) => void;
  /** Appelé après `init()`, avant `apply()` : créer ici les informateurs. */
  readonly apresInit?: (cluster: Cluster) => void;
}

export interface ServiceApplique {
  readonly nom: string;
  readonly type: string;
  readonly clusterIP: string;
  readonly port: number;
  readonly portCible: number;
  readonly nodePort?: number;
}

let instance: Cluster | undefined;
let enCours: Promise<Cluster> | undefined;
let services: readonly ServiceApplique[] = [];

export function clusterActif(): Cluster | undefined {
  return instance;
}

/** Services tels que le serveur les a rendus, avec leurs adresses réellement allouées. */
export function servicesAppliques(): readonly ServiceApplique[] {
  return services;
}

export async function demarrerCluster(crochets: CrochetsDemarrage = {}): Promise<Cluster> {
  if (enCours) return await enCours;

  enCours = (async () => {
    const cluster = new Cluster({
      nodes: 3,
      latencyProvider: newLatencyProvider({
        clusterNetworkRequestLatency: (_contexte, evenement) =>
          estSonde(evenement.request) ? 0 : LATENCE_REQUETE_MS,
        clusterNetworkResponseLatency: (_contexte, evenement) =>
          estSonde(evenement.request) ? 0 : LATENCE_REPONSE_MS,
      }),
    });

    cluster.registerImage(ImageTaches);
    cluster.registerImage(ImageCharges);

    crochets.avantInit?.(cluster);
    await cluster.init();
    crochets.apresInit?.(cluster);

    const appliques = await cluster.apply(MANIFESTES);

    services = appliques
      .filter((ressource) => ressource.kind === "Service")
      .map((ressource) => {
        const service = ressource as Extract<(typeof MANIFESTES)[number], { kind: "Service" }>;
        const port = service.spec?.ports?.[0];
        return {
          nom: service.metadata?.name ?? "?",
          type: service.spec?.type ?? "ClusterIP",
          clusterIP: service.spec?.clusterIP ?? "—",
          port: port?.port ?? 0,
          portCible: Number(port?.targetPort ?? 0),
          nodePort: port?.nodePort,
        };
      });

    instance = cluster;
    return cluster;
  })();

  return await enCours;
}

/**
 * Ferme le cluster. Idempotent côté paquet, mais on protège quand même l'entrée :
 * sous rechargement à chaud, deux démontages peuvent se croiser.
 */
export async function arreterCluster(): Promise<void> {
  const aFermer = instance ?? (enCours ? await enCours.catch(() => undefined) : undefined);
  instance = undefined;
  enCours = undefined;
  services = [];
  await aFermer?.close();
}

/** Compteur de tâches en attente dans l'horloge simulée : l'assertion anti-fuite. */
export function tachesEnAttente(): number | undefined {
  return instance?.clock.pendingTaskCount();
}

import type { ClusterApplyResource } from "@ngrok/webernetes";

/**
 * Les ressources Kubernetes de la démonstration.
 *
 * `apply()` n'accepte que six kinds : Deployment, ReplicaSet, Namespace, Node, Pod,
 * Service. Ni ConfigMap, ni Secret, ni Ingress.
 */

export const NAMESPACE = "default";
export const DEPLOIEMENT_TACHES = "taches";
export const DEPLOIEMENT_CHARGES = "charges";
export const REPLIQUES_TACHES = 3;
export const NODE_PORT = 31000;
export const NOEUD_DE_SORTIE = "node-1";

/** L'adresse unique par laquelle la page atteint le cluster. */
export const ADRESSE_CLUSTER = `http://${NOEUD_DE_SORTIE}:${NODE_PORT}`;

/**
 * Sonde de disponibilité pointée sur une route qui répond 200 en toutes circonstances.
 *
 * Si elle visait la route applicative, un pod en panne sortirait des endpoints du
 * Service en environ 150 ms et l'appelant recevrait une exception réseau
 * (`ECONNREFUSED` sur l'IP du NŒUD) au lieu du code 500 attendu. L'essai 2 perdrait
 * alors exactement ce qu'il doit montrer : une panne qualifiée par un code d'état.
 */
function sonde() {
  return {
    httpGet: { path: "/healthz", port: 8080 },
    initialDelaySeconds: 0,
    periodSeconds: 1,
    timeoutSeconds: 1,
    failureThreshold: 1,
  };
}

export const MANIFESTES: ClusterApplyResource[] = [
  {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: { name: DEPLOIEMENT_TACHES, namespace: NAMESPACE, labels: { app: "taches" } },
    spec: {
      replicas: REPLIQUES_TACHES,
      selector: { matchLabels: { app: "taches" } },
      template: {
        metadata: { labels: { app: "taches" } },
        spec: {
          containers: [
            {
              name: "taches",
              image: "etude/taches:1.0",
              ports: [{ containerPort: 8080 }],
              readinessProbe: sonde(),
            },
          ],
        },
      },
    },
  },
  {
    // Un seul réplica, délibérément : le drapeau de panne est un état d'instance et
    // aucun état ne peut être partagé entre réplicas dans ce simulateur.
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: { name: DEPLOIEMENT_CHARGES, namespace: NAMESPACE, labels: { app: "charges" } },
    spec: {
      replicas: 1,
      selector: { matchLabels: { app: "charges" } },
      template: {
        metadata: { labels: { app: "charges" } },
        spec: {
          containers: [
            {
              name: "charges",
              image: "etude/charges:1.0",
              env: [{ name: "URL_TACHES", value: "http://taches.default.svc:80/taches" }],
              ports: [{ containerPort: 8080 }],
              readinessProbe: sonde(),
            },
          ],
        },
      },
    },
  },
  {
    apiVersion: "v1",
    kind: "Service",
    metadata: { name: "taches", namespace: NAMESPACE },
    spec: {
      type: "ClusterIP",
      selector: { app: "taches" },
      ports: [{ name: "http", port: 80, targetPort: 8080, protocol: "TCP" }],
    },
  },
  {
    apiVersion: "v1",
    kind: "Service",
    metadata: { name: "charges", namespace: NAMESPACE },
    spec: {
      type: "NodePort",
      selector: { app: "charges" },
      ports: [{ name: "http", port: 80, targetPort: 8080, nodePort: NODE_PORT, protocol: "TCP" }],
    },
  },
];

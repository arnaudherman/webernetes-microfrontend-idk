import { clusterActif } from "./cluster";
import { ADRESSE_CLUSTER, NAMESPACE } from "./manifestes";

/**
 * Les deux essais qui se jouent sous la frontière.
 *
 * Ils n'ont aucune idée de l'existence d'une interface : ce sont des opérations
 * Kubernetes et des appels HTTP, rien d'autre.
 */

function cluster() {
  const actif = clusterActif();
  if (!actif) throw new Error("Le cluster n'est pas démarré.");
  return actif;
}

/* ------------------------------------------------ essai 1 : supprimer un pod */

export interface SuppressionPod {
  readonly nom: string;
  readonly noeud: string;
}

/**
 * Supprime un pod du Deployment `taches`. Le contrôleur en recrée un.
 *
 * On écarte les pods déjà marqués pour suppression : pendant environ 1,8 s après un
 * premier essai, quatre objets Pod coexistent pour trois réplicas, et supprimer une
 * victime déjà en cours de suppression ne produirait rien de visible.
 */
export async function supprimerUnPodTaches(): Promise<SuppressionPod> {
  const api = cluster().api.corev1;

  const liste = await api.listNamespacedPod({
    namespace: NAMESPACE,
    labelSelector: "app=taches",
  });

  const victime = liste.items.find((pod) => !pod.metadata?.deletionTimestamp);
  if (!victime?.metadata?.name) {
    throw new Error("Aucun pod `taches` supprimable pour le moment.");
  }

  await api.deleteNamespacedPod({ name: victime.metadata.name, namespace: NAMESPACE });

  return {
    nom: victime.metadata.name,
    noeud: victime.spec?.nodeName ?? "?",
  };
}

/* --------------------------------------- essai 2 : casser le contrat serveur */

/**
 * Bascule le pod `charges` en panne, ou l'en sort, par routage de chemin.
 *
 * Aucune API du simulateur ne permet de forcer un pod existant à répondre 500 : ni
 * injection de faute, ni intergiciel, ni crochet réseau. Le drapeau est donc porté
 * par l'image elle-même et basculé par un appel HTTP. Le pod ne redémarre pas, son
 * conteneur ne change pas, son compteur de redémarrages reste à zéro : c'est bien la
 * même instance, vivante, qui se met à mentir.
 */
export async function armerPanneServeur(): Promise<void> {
  await cluster().fetch(`${ADRESSE_CLUSTER}/panne`);
}

export async function retablirServeur(): Promise<void> {
  await cluster().fetch(`${ADRESSE_CLUSTER}/nominal`);
}

/** Lit l'état réel du pod plutôt que de se fier à une copie locale. */
export async function panneServeurArmee(): Promise<boolean> {
  const reponse = await cluster().fetch(`${ADRESSE_CLUSTER}/etat`);
  if (reponse.status !== 200) return false;
  return (JSON.parse(reponse.body) as { en_panne?: boolean }).en_panne === true;
}

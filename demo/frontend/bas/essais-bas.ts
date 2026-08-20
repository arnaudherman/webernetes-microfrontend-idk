import { URL_COMMANDE } from "../../../reel/interface/bas/adresses";

/**
 * Les quatre essais qui se jouent sous la frontière.
 *
 * Ils n'ont aucune idée de l'existence d'une interface : ce sont des signaux POSIX et
 * des appels HTTP, rien d'autre. Chacun passe par la console, qui est la seule à
 * pouvoir agir sur les processus — elle en est le parent.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HISTORIQUE : CE QUI A REMPLACÉ L'ESSAI DE SUPPRESSION, ET POURQUOI
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La moitié basse simulée savait faire disparaître une unité de calcul et la voir
 * recréée par un contrôleur. Rien ne l'a remplacé, et c'est assumé : reconstruire un
 * contrôleur ici reviendrait à réécrire Kubernetes en moins bien pour montrer moins.
 *
 * À sa place, l'essai 4 : `taches` sert « etat » là où le contrat dit « statut ».
 * L'essai 5 rejoue exactement la même faute une couche plus HAUT, sur le bus. Une
 * seule faute, trois placements de frontière, un seul détecteur — la passerelle.
 * C'est le meilleur essai du lot parce qu'il ne démontre pas que « le réseau
 * vérifie » (il ne vérifie rien), mais qu'un INTERMÉDIAIRE vérifie, parce que
 * quelqu'un l'a écrit, et qu'il n'en existe aucun au-dessus de la frontière.
 */

export interface EtatBas {
  /** `taches` répond 500 sur sa route applicative. */
  readonly contratRompu: boolean;
  /** `taches` sert « etat » au lieu de « statut ». */
  readonly formeRompue: boolean;
  /**
   * Faux quand `taches` est mort ou figé : ses drapeaux sont alors inconnaissables.
   * On préfère le dire plutôt que d'afficher « intact » sans en rien savoir.
   */
  readonly lisible: boolean;
  /**
   * `vivant` et `repond` sont deux questions distinctes, et ce type les portait
   * incomplètes : il ne déclarait que `vivant`, alors que la console rend les deux
   * depuis toujours. Un consommateur qui voulait savoir si un service ÉCOUTE ne
   * pouvait que déduire — c'est-à-dire supposer.
   *
   * L'écart est celui de l'essai 3 : figé par SIGSTOP, un processus est vivant et
   * muet. Il est aussi celui d'un démarrage, dans l'autre sens : lancé, il est
   * vivant avant d'écouter.
   */
  readonly processus: readonly {
    nom: string;
    vivant: boolean;
    repond: boolean;
    fige: boolean;
  }[];
}

async function commander(action: string, service?: string): Promise<unknown> {
  const url = new URL(URL_COMMANDE);
  url.searchParams.set("action", action);
  if (service) url.searchParams.set("service", service);

  const reponse = await fetch(url, { method: "GET" });
  const corps = (await reponse.json()) as { erreur?: string };
  if (!reponse.ok) throw new Error(corps.erreur ?? `la console répond ${reponse.status}`);
  return corps;
}

/* ------------------------------------------ essai 1 : tuer le service charges */

/**
 * SIGTERM sur `charges`. Le processus meurt, son port se ferme, et l'appel suivant
 * de la passerelle reçoit un vrai `ECONNREFUSED` — pas un délai : sur la boucle
 * locale, un refus est immédiat. C'est l'essai 3 qui montre l'attente.
 */
export async function tuerCharges(): Promise<void> {
  await commander("arreter", "charges");
}

export async function relancerCharges(): Promise<void> {
  await commander("demarrer", "charges");
}

/* --------------------------------------- essai 2 : casser le contrat serveur */

/**
 * `taches` répond 500 sans redémarrer : même processus, même pid, le compteur
 * d'uptime ne bouge pas. C'est bien la même instance, vivante, qui se met à mentir.
 *
 * `taches` est l'amont ESSENTIEL : la passerelle rend 503, parce qu'il n'y a rien à
 * composer. Comparer avec l'essai 1, où l'amont manquant est optionnel et où la même
 * passerelle rend un 200 partiel. Deux boutons voisins, deux décisions différentes,
 * une seule passerelle : c'est là qu'elle gagne sa place.
 */
export async function armerPanneServeur(): Promise<void> {
  await commander("contrat-rompu");
}

export async function retablirServeur(): Promise<void> {
  await commander("contrat-retabli");
}

/* --------------------------------------------- essai 3 : figer, sans tuer */

/**
 * SIGSTOP sur `charges`. Le processus reste vivant, sa socket d'écoute reste ouverte,
 * le noyau accepte toujours les connexions — et personne ne répond jamais.
 *
 * C'est une forme de panne que le refus ne produit pas, et c'est elle qui oblige à
 * porter un BUDGET DE DÉLAI. La passerelle en a un, parce qu'écrire un intermédiaire
 * force à décider quoi répondre quand l'amont se tait. En appels directs, personne
 * n'est obligé de décider : `fetch` n'expire jamais de lui-même, et la page attend
 * indéfiniment sans rien dire.
 */
export async function figerCharges(): Promise<void> {
  await commander("figer", "charges");
}

export async function degelerCharges(): Promise<void> {
  await commander("degeler", "charges");
}

/* ------------------------------- essai 4 : servir une charge utile non conforme */

/** `taches` renomme `statut` en `etat`. Code d'état inchangé, contrat rompu. */
export async function armerFormeRompue(): Promise<void> {
  await commander("forme-rompue");
}

export async function retablirForme(): Promise<void> {
  await commander("forme-retablie");
}

/* --------------------------------------------------------------------- lecture */

/** Lit l'état réel des processus plutôt que de se fier à une copie locale. */
export async function etatBas(): Promise<EtatBas> {
  return (await commander("etat")) as EtatBas;
}

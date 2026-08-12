import type { HttpResponse } from "@ngrok/webernetes";
import { clusterActif } from "../bas/cluster";
import { ADRESSE_CLUSTER } from "../bas/manifestes";
import type { Bus } from "../haut/bus";
import { qualifier, type EtatConvergence } from "./convergence";

/**
 * La passerelle : le seul endroit du dépôt où une donnée passe du cluster à l'interface.
 *
 * Tout ce qui est affiché au-dessus de la frontière est entré par cette fonction, par
 * un unique appel `cluster.fetch` vers un Service NodePort. Aucun autre module de
 * `src/haut` ne connaît l'existence du cluster.
 */

export interface Traversee {
  readonly reponse: HttpResponse;
  readonly dureeMs: number;
}

export interface Tentative {
  readonly numero: number;
  readonly depuisMs: number;
  readonly etat: EtatConvergence;
}

export interface EvenementTraversee {
  readonly phase: "depart" | "arrivee";
  readonly chemin: string;
  readonly status?: number;
  readonly dureeMs?: number;
  readonly erreur?: string;
}

export type ObservateurTraversee = (evenement: EvenementTraversee) => void;

const observateurs = new Set<ObservateurTraversee>();
let traversees = 0;

/** Permet à la ligne de frontière de s'illuminer pendant toute la durée de l'appel. */
export function observerTraversee(observateur: ObservateurTraversee): () => void {
  observateurs.add(observateur);
  return () => observateurs.delete(observateur);
}

/** Nombre d'appels ayant traversé la frontière depuis le chargement de la page. */
export function nombreTraversees(): number {
  return traversees;
}

function signaler(evenement: EvenementTraversee): void {
  for (const observateur of observateurs) observateur(evenement);
}

/**
 * L'appel qui traverse la frontière.
 *
 * L'URL doit être absolue, en `http:`, avec un port explicite. Depuis la page,
 * l'origine de l'appel est un nœud : seul l'alias de nœud et le nom pleinement
 * qualifié à cinq étiquettes se résolvent. Une forme courte partirait sur le vrai
 * réseau — c'est le garde-réseau qui l'arrêterait.
 */
export async function traverser(chemin: string): Promise<Traversee> {
  const cluster = clusterActif();
  if (!cluster) throw new Error("Le cluster n'est pas démarré : aucune traversée possible.");

  traversees += 1;
  signaler({ phase: "depart", chemin });

  const debut = performance.now();
  try {
    const reponse = await cluster.fetch(`${ADRESSE_CLUSTER}${chemin}`);
    const dureeMs = performance.now() - debut;
    signaler({ phase: "arrivee", chemin, status: reponse.status, dureeMs });
    return { reponse, dureeMs };
  } catch (erreur) {
    signaler({
      phase: "arrivee",
      chemin,
      dureeMs: performance.now() - debut,
      erreur: erreur instanceof Error ? erreur.message : String(erreur),
    });
    throw erreur;
  }
}

/* -------------------------------------------------------------------------- */
/* Le chargement des données : la seule chose qui monte du cluster vers l'écran. */
/* -------------------------------------------------------------------------- */

export interface EtatSource {
  readonly phase: "attente" | "chargement" | "charge" | "erreur";
  readonly libelle: string;
  readonly detail?: string;
}

const observateursSource = new Set<(etat: EtatSource) => void>();
let etatSource: EtatSource = { phase: "attente", libelle: "en attente du cluster" };
let contratsServeurRompus = 0;

export function observerSource(observateur: (etat: EtatSource) => void): () => void {
  observateursSource.add(observateur);
  observateur(etatSource);
  return () => observateursSource.delete(observateur);
}

/**
 * Nombre de fois où le contrat serveur a été pris en défaut. Ce compteur existe
 * parce que le réseau QUALIFIE la panne : un code d'état 5xx est un fait observable,
 * pas une interprétation.
 */
export function contratsServeurViolesDetectes(): number {
  return contratsServeurRompus;
}

function majSource(etat: EtatSource): void {
  etatSource = etat;
  for (const observateur of observateursSource) observateur(etat);
}

/**
 * Traverse la frontière, puis publie la charge utile sur le bus.
 *
 * C'est la seule fonction du dépôt qui touche aux deux moitiés. En dessous d'elle,
 * un code d'état ; au-dessus, un événement sans accusé de réception.
 */
export async function chargerDonnees(bus: Bus): Promise<void> {
  majSource({ phase: "chargement", libelle: "chargement en cours…" });

  try {
    const { reponse, dureeMs } = await traverser("/donnees");

    if (reponse.status !== 200) {
      if (reponse.status >= 500) contratsServeurRompus += 1;
      majSource({
        phase: "erreur",
        libelle: `le service a répondu ${reponse.status}`,
        detail: reponse.body.slice(0, 200),
      });
      return;
    }

    const charge = JSON.parse(reponse.body) as { meta?: { agrege_par?: string } };
    bus.publier("donnees:chargees", charge, "passerelle");

    majSource({
      phase: "charge",
      libelle: `200 en ${Math.round(dureeMs)} ms`,
      detail: charge.meta?.agrege_par,
    });
  } catch (erreur) {
    const etat = qualifier(erreur);
    majSource({ phase: "erreur", libelle: etat.libelle, detail: etat.detail });
  }
}

/**
 * Interroge le réseau jusqu'à obtenir un 200. Il n'existe aucun autre moyen de savoir
 * que le cluster est prêt : `init()` a déjà rendu la main depuis longtemps.
 */
export async function attendreCluster(
  surTentative?: (tentative: Tentative) => void,
  delaiMaxMs = 40_000,
): Promise<{ tentatives: number; dureeMs: number }> {
  const debut = performance.now();
  let numero = 0;

  for (;;) {
    numero += 1;
    let etat: EtatConvergence | undefined;

    try {
      const { reponse } = await traverser("/donnees");
      if (reponse.status === 200) {
        return { tentatives: numero, dureeMs: performance.now() - debut };
      }
      etat = {
        phase: "aucun-pod-pret",
        libelle:
          reponse.status === 502
            ? "le service d'agrégation répond, son amont n'est pas encore prêt"
            : `le cluster répond ${reponse.status}`,
        detail: `status ${reponse.status} — ${reponse.body.slice(0, 160)}`,
      };
    } catch (erreur) {
      etat = qualifier(erreur);
    }

    surTentative?.({ numero, depuisMs: performance.now() - debut, etat });

    if (performance.now() - debut > delaiMaxMs) {
      throw new Error(`Le cluster n'a pas convergé en ${delaiMaxMs} ms : ${etat.detail}`);
    }

    await new Promise((resoudre) => setTimeout(resoudre, 200));
  }
}

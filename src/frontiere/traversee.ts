import {
  URL_CHARGES_DIRECT,
  URL_DONNEES_PASSERELLE,
  URL_TACHES_DIRECT,
} from "../bas/adresses";
import { EN_TETE_CORRELATION, EN_TETE_DEGRADATION, entete } from "../bas/entetes";
import type { Bus } from "../haut/bus";
import { qualifier } from "./convergence";

/**
 * Le point de traversée.
 *
 * C'est le seul module du dépôt où une donnée passe du réseau à l'interface. Tout ce
 * qui est affiché au-dessus de la frontière est entré par ici.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UN MOT SUR LE VOCABULAIRE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ce fichier s'appelait `passerelle.ts`. Le mot est désormais réservé au PROCESSUS
 * qui tourne sur 127.0.0.1:7200 et prend trois décisions. Ici, il n'y a pas de
 * décision : il y a un franchissement. Deux choses portant le même nom dans une
 * étude d'architecture, c'est une ambiguïté qui se paie en réunion.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LES DEUX MODES, ET POURQUOI LEUR ÉCART EST LE LIVRABLE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   « passerelle »  un appel. La composition et les trois décisions ont lieu côté
 *                   réseau, dans un processus, écrites une fois.
 *   « direct »      deux appels. La composition remonte dans le navigateur — c'est
 *                   littéralement le déplacement de frontière que l'étude instruit.
 *
 * Les deux modes publient sur le bus une charge utile IDENTIQUE. C'est la contrainte
 * qui rend la comparaison honnête : rien au-dessus de la frontière ne sait dans quel
 * mode il tourne, et `src/haut` n'a pas une ligne de différence entre les deux.
 */

export type Mode = "passerelle" | "direct";

const MODES: readonly Mode[] = ["passerelle", "direct"];

function modeDeLUrl(): Mode {
  const demande = new URL(globalThis.location.href).searchParams.get("mode");
  return MODES.includes(demande as Mode) ? (demande as Mode) : "passerelle";
}

let mode: Mode = modeDeLUrl();
const observateursMode = new Set<(mode: Mode) => void>();

export function modeCourant(): Mode {
  return mode;
}

export function observerMode(observateur: (mode: Mode) => void): () => void {
  observateursMode.add(observateur);
  observateur(mode);
  return () => observateursMode.delete(observateur);
}

/**
 * Le mode est une variable d'URL, mais on le bascule SANS RECHARGER.
 *
 * Recharger perdrait les compteurs de session, et l'écart entre les deux modes se
 * lit précisément sur une session où l'on a joué la même panne des deux côtés. La
 * variable d'URL reste la source de vérité au chargement, et elle est réécrite pour
 * que l'adresse soit partageable — c'est tout ce qu'on lui demande.
 */
export function basculerMode(nouveau: Mode): void {
  if (nouveau === mode) return;
  mode = nouveau;

  const url = new URL(globalThis.location.href);
  url.searchParams.set("mode", nouveau);
  globalThis.history.replaceState(null, "", url);

  for (const observateur of observateursMode) observateur(nouveau);
}

/* ------------------------------------------------------ la mesure de l'écart */

export interface MesureMode {
  /** Chargements de données joués dans ce mode. */
  readonly chargements: number;
  /** Appels HTTP réellement émis : un par chargement via la passerelle, deux en direct. */
  readonly appels: number;
  readonly dernierMs?: number;
  readonly cumulMs: number;
  /** Chargements qui n'ont pas abouti. */
  readonly echecs: number;
  /**
   * Échecs dont la CAUSE a pu être nommée. C'est le chiffre qui porte l'étude :
   * via la passerelle il égale le nombre d'échecs, en direct il reste à zéro.
   */
  readonly echecsQualifies: number;
}

function mesureVide(): MesureMode {
  return { chargements: 0, appels: 0, cumulMs: 0, echecs: 0, echecsQualifies: 0 };
}

const mesures: Record<Mode, MesureMode> = {
  passerelle: mesureVide(),
  direct: mesureVide(),
};

export function mesuresParMode(): Readonly<Record<Mode, MesureMode>> {
  return mesures;
}

function enregistrer(
  pour: Mode,
  ajout: { appels: number; dureeMs: number; echec: boolean; qualifie: boolean },
): void {
  const courante = mesures[pour];
  mesures[pour] = {
    chargements: courante.chargements + 1,
    appels: courante.appels + ajout.appels,
    dernierMs: ajout.dureeMs,
    cumulMs: courante.cumulMs + ajout.dureeMs,
    echecs: courante.echecs + (ajout.echec ? 1 : 0),
    echecsQualifies: courante.echecsQualifies + (ajout.qualifie ? 1 : 0),
  };
}

/* ------------------------------------------------- l'animation de la frontière */

export interface EvenementTraversee {
  readonly phase: "depart" | "arrivee";
  readonly mode: Mode;
  readonly appels: number;
  readonly status?: number;
  readonly dureeMs?: number;
  readonly erreur?: string;
}

export type ObservateurTraversee = (evenement: EvenementTraversee) => void;

const observateurs = new Set<ObservateurTraversee>();
let traversees = 0;

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

/* ------------------------------------------------------------- l'état affiché */

export interface EtatSource {
  readonly phase: "attente" | "chargement" | "charge" | "degrade" | "erreur";
  readonly libelle: string;
  readonly detail?: string;
  /** L'identifiant de corrélation de la dernière traversée, quand il est lisible. */
  readonly correlation?: string;
}

const observateursSource = new Set<(etat: EtatSource) => void>();
let etatSource: EtatSource = { phase: "attente", libelle: "en attente des services" };
let contratsServeurRompus = 0;
let contratsAmontRefuses = 0;

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

/**
 * Charges utiles non conformes ARRÊTÉES avant d'atteindre la page.
 *
 * À comparer avec `CONTRATS_FRONT_DETECTES`, qui vaut zéro et le restera. C'est la
 * même faute — un champ renommé, contrat déclaré inchangé — placée une couche plus
 * bas. Le chiffre bouge ici parce que quelqu'un a écrit une forme attendue dans la
 * passerelle. En mode direct, il ne bouge pas non plus : ce n'est donc pas le réseau
 * qui vérifie, c'est l'intermédiaire.
 */
export function contratsAmontDetectes(): number {
  return contratsAmontRefuses;
}

function majSource(etat: EtatSource): void {
  etatSource = etat;
  for (const observateur of observateursSource) observateur(etat);
}

/* ------------------------------------------------------------ la traversée */

interface Recu {
  readonly status: number;
  readonly corps: unknown;
  readonly correlation?: string;
  readonly degradation?: string;
}

async function appelUnique(url: string): Promise<Recu> {
  const reponse = await fetch(url);
  const texte = await reponse.text();

  let corps: unknown;
  try {
    corps = JSON.parse(texte);
  } catch {
    corps = { erreur: "réponse illisible", extrait: texte.slice(0, 200) };
  }

  return {
    status: reponse.status,
    corps,
    correlation: entete(reponse.headers, EN_TETE_CORRELATION),
    degradation: entete(reponse.headers, EN_TETE_DEGRADATION),
  };
}

interface Composee {
  readonly charge: Record<string, unknown>;
  readonly status: number;
  readonly correlation?: string;
  readonly degradation?: string;
  readonly appels: number;
}

/** Mode « passerelle » : un appel, tout est déjà décidé de l'autre côté. */
async function viaPasserelle(): Promise<Composee> {
  const recu = await appelUnique(URL_DONNEES_PASSERELLE);
  return {
    charge: recu.corps as Record<string, unknown>,
    status: recu.status,
    correlation: recu.correlation,
    degradation: recu.degradation,
    appels: 1,
  };
}

/**
 * Mode « direct » : deux appels, et la composition remonte ici.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE CODE DONNE AU MODE DIRECT SA MEILLEURE CHANCE, DÉLIBÉRÉMENT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Un `Promise.all` naïf ferait tomber tout l'écran parce qu'un amont optionnel
 * manque, et la comparaison serait truquée. On utilise donc `allSettled` : le
 * navigateur prend, lui aussi, une décision de dégradation. Ce qu'il en coûte est
 * alors visible pour ce que c'est, et ce n'est pas « le navigateur ne peut pas » :
 *
 *   1. cette décision est écrite ICI, donc livrée à chaque utilisateur, et à
 *      réécrire dans chaque front qui parlera à ces services ;
 *   2. la CAUSE est indisponible — `fetch` rend `TypeError: Failed to fetch` pour un
 *      service mort, un refus CORS et un port fermé. La page peut constater le
 *      manque, elle ne peut pas le nommer ;
 *   3. il n'y a AUCUN budget de délai. On pourrait en écrire un — il faudrait en
 *      écrire un, et le réécrire partout. Faute de quoi un service figé fait attendre
 *      la page indéfiniment, sans un mot. C'est l'essai 3, et c'est le cas courant ;
 *   4. rien de tout cela n'est observable par quiconque n'a pas l'onglet sous les yeux.
 */
async function enDirect(): Promise<Composee> {
  const [tachesR, chargesR] = await Promise.allSettled([
    appelUnique(URL_TACHES_DIRECT),
    appelUnique(URL_CHARGES_DIRECT),
  ]);

  // L'amont essentiel. La distinction essentiel/optionnel n'est écrite nulle part
  // ailleurs que dans ces quelques lignes — et elle n'est connue que d'elles.
  if (tachesR.status === "rejected" || tachesR.value.status !== 200) {
    const status = tachesR.status === "fulfilled" ? tachesR.value.status : 0;
    return {
      charge:
        tachesR.status === "fulfilled"
          ? (tachesR.value.corps as Record<string, unknown>)
          : { erreur: "amont injoignable", cause: "inconnue du navigateur" },
      status,
      appels: 2,
    };
  }

  const taches = (tachesR.value.corps as { taches?: unknown[] }).taches ?? [];
  const charges =
    chargesR.status === "fulfilled" && chargesR.value.status === 200
      ? ((chargesR.value.corps as { charges?: unknown[] }).charges ?? [])
      : undefined;

  return {
    charge: {
      meta: { servi_par: "taches", agrege_par: charges ? "charges" : null, mode: "direct" },
      taches,
      charges: charges ?? [],
      ...(charges
        ? {}
        : {
            degrade: {
              partie: "charges",
              // Le navigateur ne reçoit pas la cause. Écrire ici « ECONNREFUSED »
              // serait inventer : la page n'en sait rien et ne peut pas le savoir.
              cause: "inconnue — le navigateur ne reçoit pas la cause",
              decide_par: "navigateur",
            },
          }),
    },
    status: 200,
    appels: 2,
  };
}

export async function traverser(): Promise<Composee> {
  const courant = mode;
  traversees += 1;
  signaler({ phase: "depart", mode: courant, appels: courant === "direct" ? 2 : 1 });

  const debut = performance.now();
  try {
    const composee = courant === "passerelle" ? await viaPasserelle() : await enDirect();
    signaler({
      phase: "arrivee",
      mode: courant,
      appels: composee.appels,
      status: composee.status,
      dureeMs: performance.now() - debut,
    });
    return composee;
  } catch (erreur) {
    signaler({
      phase: "arrivee",
      mode: courant,
      appels: courant === "direct" ? 2 : 1,
      dureeMs: performance.now() - debut,
      erreur: erreur instanceof Error ? erreur.message : String(erreur),
    });
    throw erreur;
  }
}

/* ---------------------------------------------------- le chargement des données */

interface Degradation {
  readonly partie?: string;
  readonly cause?: string;
  readonly decide_par?: string;
  readonly attenduMs?: number;
}

/**
 * Traverse la frontière, puis publie la charge utile sur le bus.
 *
 * C'est la seule fonction du dépôt qui touche aux deux moitiés. En dessous d'elle,
 * un code d'état ; au-dessus, un événement sans accusé de réception.
 */
export async function chargerDonnees(bus: Bus): Promise<void> {
  const courant = mode;
  majSource({ phase: "chargement", libelle: `chargement en cours… (mode ${courant})` });

  const debut = performance.now();

  try {
    const composee = await traverser();
    const dureeMs = performance.now() - debut;

    if (composee.status !== 200) {
      const corps = composee.charge as { erreur?: string; cause?: string; ecarts?: string[] };

      // Les deux compteurs ne doivent JAMAIS compter le même événement.
      //
      // Un 502 de la passerelle n'est pas une panne du service : c'est un REFUS. La
      // charge utile était servie en 200 par un amont parfaitement vivant, et c'est
      // l'intermédiaire qui l'a arrêtée. Le compter aussi comme « contrat serveur
      // violé » ferait bouger le chiffre de l'essai 2 en jouant l'essai 4 — et la
      // personne qui présente pointerait un compteur en disant quelque chose de faux.
      //
      // Les deux chiffres répondent à deux questions distinctes :
      //   contrats serveur violés   le service a-t-il cessé de tenir son engagement ?
      //   charges utiles arrêtées   quelqu'un l'a-t-il constaté avant le client ?
      if (composee.status === 502) contratsAmontRefuses += 1;
      else if (composee.status >= 500) contratsServeurRompus += 1;

      const qualifie = corps.cause !== undefined || (corps.ecarts?.length ?? 0) > 0;
      enregistrer(courant, { appels: composee.appels, dureeMs, echec: true, qualifie });

      majSource({
        phase: "erreur",
        libelle: `le réseau a répondu ${composee.status || "— aucun code"}`,
        detail:
          corps.ecarts?.join(" · ") ??
          corps.cause ??
          corps.erreur ??
          "aucune cause : le navigateur ne la reçoit pas",
        ...(composee.correlation ? { correlation: composee.correlation } : {}),
      });
      return;
    }

    bus.publier("donnees:chargees", composee.charge, "traversee");

    const degrade = (composee.charge as { degrade?: Degradation }).degrade;
    enregistrer(courant, { appels: composee.appels, dureeMs, echec: false, qualifie: false });

    if (degrade) {
      majSource({
        phase: "degrade",
        libelle: `200 partiel en ${Math.round(dureeMs)} ms — ${degrade.partie} manque`,
        detail:
          `cause : ${degrade.cause ?? "inconnue"} · décidé par ${degrade.decide_par ?? "?"}` +
          (degrade.attenduMs === undefined ? "" : ` après ${degrade.attenduMs} ms`),
        ...(composee.correlation ? { correlation: composee.correlation } : {}),
      });
      return;
    }

    const meta = (composee.charge as { meta?: { agrege_par?: string } }).meta;
    majSource({
      phase: "charge",
      libelle: `200 en ${Math.round(dureeMs)} ms · ${composee.appels} appel${composee.appels > 1 ? "s" : ""}`,
      ...(meta?.agrege_par ? { detail: meta.agrege_par } : {}),
      ...(composee.correlation ? { correlation: composee.correlation } : {}),
    });
  } catch (erreur) {
    const etat = qualifier(erreur);
    enregistrer(courant, {
      appels: courant === "direct" ? 2 : 1,
      dureeMs: performance.now() - debut,
      echec: true,
      qualifie: etat.phase !== "opaque",
    });
    majSource({ phase: "erreur", libelle: etat.libelle, detail: etat.detail });
  }
}

/**
 * Attend que les services répondent.
 *
 * Il n'y a plus de convergence à observer : soit les processus tournent, soit ils ne
 * tournent pas. On interroge donc quelques secondes — le temps que `npm run demo`
 * lance Vite et les services ensemble — puis on le dit clairement.
 */
export async function attendreServices(delaiMaxMs = 8000): Promise<{ tentatives: number }> {
  const debut = performance.now();
  let numero = 0;

  for (;;) {
    numero += 1;
    try {
      const reponse = await fetch(URL_DONNEES_PASSERELLE, { method: "GET" });
      if (reponse.status < 500) {
        await reponse.body?.cancel();
        return { tentatives: numero };
      }
      await reponse.body?.cancel();
    } catch {
      // Les services ne sont pas encore là.
    }

    if (performance.now() - debut > delaiMaxMs) {
      throw new Error(
        "Les services de la moitié basse ne répondent pas. " +
          "Lancer « npm run services » dans un second terminal, ou « npm run demo » qui lance tout.",
      );
    }

    await new Promise((resoudre) => setTimeout(resoudre, 250));
  }
}

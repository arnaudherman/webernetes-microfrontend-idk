import { PORTS } from "../bas/adresses";
import {
  basculerMode,
  nombreTraversees,
  observerMode,
  observerTraversee,
  type Mode,
} from "./traversee";

/**
 * La frontière.
 *
 * Une ligne en travers de la page, étiquetée des deux côtés, avec le point de
 * traversée matérialisé dessus. Ce point est le seul endroit du dépôt où une donnée
 * passe du réseau à l'interface.
 *
 * Le sélecteur de mode est posé SUR la ligne, et c'est le bon endroit : le mode n'est
 * pas un réglage d'affichage, c'est la position de la frontière elle-même. À gauche
 * de la ligne on décide côté réseau, à droite on décide dans l'onglet.
 */

const ETIQUETTE_HAUT = "modularité de l'interface · micro-frontends · sujet de l'étude";
const ETIQUETTE_BAS = "modularité serveur · quatre processus, un vrai réseau · hors sujet de l'étude";

/**
 * Plancher d'animation.
 *
 * La latence injectée a disparu ; un appel sur la boucle locale dure deux à six
 * millisecondes, ce qui ne s'anime pas. La pastille reste donc allumée un quart de
 * seconde au minimum.
 *
 * C'est une durée de PRÉSENTATION, pas une durée mesurée, et la distinction est
 * affichée : le compteur à côté montre la milliseconde réelle. Réinjecter une latence
 * dans l'appel lui-même serait refaire exactement ce qu'on vient de supprimer, sous
 * un autre nom.
 */
const PLANCHER_ANIMATION_MS = 250;

/** Au-delà, on affiche le temps qui passe : c'est ce qui rend l'attente visible. */
const SEUIL_ATTENTE_VISIBLE_MS = 700;

const APPELS: Record<Mode, string> = {
  passerelle: `fetch("http://127.0.0.1:${PORTS.passerelle}/donnees") — 1 appel`,
  direct: `fetch(:${PORTS.taches}/taches) + fetch(:${PORTS.charges}/charges) — 2 appels`,
};

const TITRES: Record<Mode, string> = {
  passerelle: "via passerelle",
  direct: "appels directs",
};

const EXPLICATIONS: Record<Mode, string> = {
  passerelle: "corrélation, dégradation et conformité décidées côté réseau",
  direct: "la composition et ses décisions remontent dans l'onglet",
};

export function rendreFrontiere(hote: HTMLElement): () => void {
  hote.classList.add("frontiere");

  const haut = document.createElement("p");
  haut.className = "frontiere-etiquette frontiere-etiquette-haut";
  haut.textContent = ETIQUETTE_HAUT;

  const bas = document.createElement("p");
  bas.className = "frontiere-etiquette frontiere-etiquette-bas";
  bas.textContent = ETIQUETTE_BAS;

  const point = document.createElement("div");
  point.className = "frontiere-point";

  const pastille = document.createElement("span");
  pastille.className = "frontiere-pastille";
  pastille.setAttribute("aria-hidden", "true");

  const appel = document.createElement("code");
  appel.className = "frontiere-appel donnee";

  const compteur = document.createElement("span");
  compteur.className = "frontiere-compteur donnee";
  compteur.textContent = "0 traversée";

  const annonce = document.createElement("p");
  annonce.className = "hors-ecran";
  annonce.setAttribute("role", "status");

  point.append(pastille, appel, compteur);

  /* --------------------------------------------------- le sélecteur de mode */

  const selecteur = document.createElement("div");
  selecteur.className = "frontiere-modes";
  selecteur.setAttribute("role", "group");
  selecteur.setAttribute("aria-label", "position de la frontière");

  const boutons = new Map<Mode, HTMLButtonElement>();
  for (const mode of ["passerelle", "direct"] as const) {
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "frontiere-mode";
    bouton.textContent = TITRES[mode];
    bouton.title = EXPLICATIONS[mode];
    bouton.addEventListener("click", () => basculerMode(mode));
    boutons.set(mode, bouton);
    selecteur.append(bouton);
  }

  const explication = document.createElement("span");
  explication.className = "frontiere-explication";

  const ligne = document.createElement("div");
  ligne.className = "frontiere-ligne";
  ligne.append(selecteur, point);

  hote.replaceChildren(haut, ligne, explication, bas, annonce);

  const detacherMode = observerMode((mode) => {
    for (const [candidat, bouton] of boutons) {
      bouton.dataset["actif"] = candidat === mode ? "oui" : "non";
      bouton.setAttribute("aria-pressed", candidat === mode ? "true" : "false");
    }
    appel.textContent = APPELS[mode];
    explication.textContent = EXPLICATIONS[mode];
  });

  /* ------------------------------------------------------------- l'animation */

  let enVol = 0;
  let debutVol: number | undefined;
  let minuteurPlancher: number | undefined;
  let minuteurAttente: number | undefined;

  function poser(etat: string): void {
    point.dataset["etat"] = etat;
  }

  const detacher = observerTraversee((evenement) => {
    if (evenement.phase === "depart") {
      enVol += 1;
      debutVol = performance.now();

      /*
       * Le plancher de la traversée PRÉCÉDENTE est désarmé ici, et cette ligne
       * manquait.
       *
       * Le minuteur n'était annulé qu'à l'arrivée et au démontage. Un plancher armé
       * par la traversée N survivait donc au départ de la traversée N+1 et posait
       * « repos » sur un appel EN VOL.
       *
       * Mesuré, en gelant `charges` juste après un chargement rapide :
       *
       *     5 ms  en-vol     la traversée N part
       *    89 ms  en-vol     la traversée N+1 part, 800 ms d'appel devant elle
       *   251 ms  repos      ← le plancher de N, en retard d'une traversée
       *   791 ms  attente    le seuil de 700 ms finit par rattraper
       *
       * Cinq cent quarante millisecondes de frontière au repos pendant qu'un appel
       * est en vol. Le seuil d'attente corrigeait tout seul, ce qui est pire que si
       * rien ne corrigeait : le défaut se referme avant qu'on ait le temps de le
       * soupçonner. Et il tombe sur l'essai 3, dont la thèse est que l'attente doit
       * se VOIR.
       */
      if (minuteurPlancher !== undefined) globalThis.clearTimeout(minuteurPlancher);

      poser("en-vol");

      // Une attente qui dure doit se voir : c'est tout l'essai 3 en mode direct, où
      // personne n'a écrit de budget de délai et où la page attend sans fin.
      minuteurAttente = globalThis.setInterval(() => {
        if (debutVol === undefined) return;
        const attente = performance.now() - debutVol;
        if (attente < SEUIL_ATTENTE_VISIBLE_MS) return;
        compteur.textContent = `en attente depuis ${(attente / 1000).toFixed(1)} s`;
        poser("attente");
      }, 100);
      return;
    }

    enVol = Math.max(0, enVol - 1);
    if (minuteurAttente !== undefined) globalThis.clearInterval(minuteurAttente);

    const ecoule = debutVol === undefined ? 0 : performance.now() - debutVol;
    debutVol = undefined;

    const enErreur = evenement.erreur !== undefined || (evenement.status ?? 0) >= 400;
    const total = nombreTraversees();
    compteur.textContent = `${total} traversée${total > 1 ? "s" : ""}`;

    if (enVol === 0) {
      // Le plancher ne retarde RIEN : la mesure est déjà prise, la charge utile est
      // déjà publiée. Seule la pastille reste allumée un instant de plus.
      const reste = Math.max(0, PLANCHER_ANIMATION_MS - ecoule);
      if (minuteurPlancher !== undefined) globalThis.clearTimeout(minuteurPlancher);
      minuteurPlancher = globalThis.setTimeout(() => poser(enErreur ? "panne" : "repos"), reste);
    }

    annonce.textContent = enErreur
      ? `traversée en erreur : ${evenement.erreur ?? evenement.status}`
      : `traversée ${evenement.status} en ${Math.round(evenement.dureeMs ?? 0)} millisecondes, ` +
        `${evenement.appels} appel${evenement.appels > 1 ? "s" : ""}`;
  });

  poser("repos");

  return () => {
    if (minuteurPlancher !== undefined) globalThis.clearTimeout(minuteurPlancher);
    if (minuteurAttente !== undefined) globalThis.clearInterval(minuteurAttente);
    detacherMode();
    detacher();
  };
}

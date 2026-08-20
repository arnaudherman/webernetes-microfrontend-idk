import "./styles/socle.css";
import "./styles/page.css";
import "./styles/haut.css";
import "./styles/frontiere.css";
import "./styles/bas.css";
import "./styles/essais.css";
import "./styles/synthese.css";

// Enregistrement des éléments personnalisés. Le shell ne connaîtra ensuite que
// leurs noms de balise. Les quatre fragments réels vivent sous reel/interface ; les
// deux variantes v2 (essais 5 et 8) n'existent que pour cette démonstration.
import "../../reel/interface/haut/fragments/mf-filtres";
import "./haut/fragments/mf-filtres-v2";
import "../../reel/interface/haut/fragments/mf-tableau";
import "./haut/fragments/mf-tableau-v2";
import "../../reel/interface/haut/fragments/mf-detail";
import "../../reel/interface/haut/fragments/mf-charge";

import { installerGardeReseau } from "../../reel/interface/garde-reseau";
import { demarrerFluxConsole } from "../../reel/interface/bas/flux-console";
import { rendreMoitieBasse } from "./bas/rendu";
import { creerBus } from "../../reel/interface/haut/bus";
import { tracer } from "../../reel/interface/haut/journal-bus";
import { rendreJournalBus } from "./haut/rendu-journal-bus";
import { rendreRail, type Rail } from "./haut/rail";
import { Shell } from "../../reel/interface/haut/shell";
import { creerCadre } from "./haut/cadre-module";
import {
  attendreServices,
  chargerDonnees,
  observerMode,
  observerSource,
} from "../../reel/interface/frontiere/traversee";
import { rendreFrontiere } from "./frontiere/vue-frontiere";
import { rendreBarreEssais } from "./essais/barre-essais";
import { rendreSynthese } from "./synthese/panneau";

// Avant toute chose, et avant le moindre appel : la page se limite aux quatre
// origines déclarées, toutes sur 127.0.0.1.
installerGardeReseau();

const application = document.querySelector<HTMLElement>("#application");
if (!application) throw new Error("Élément #application introuvable dans index.html.");

application.innerHTML = `
  <div class="page">
    <h1 class="hors-ecran">
      La frontière — deux formes de modularité dans un seul onglet
    </h1>

    <section class="bande bande-haute">
      <div class="bandeau-source">
        <h2 class="titre-zone">interface — quatre micro-frontends montés indépendamment</h2>
        <div class="bandeau-droite">
          <div class="source-etat" id="source-etat" data-phase="attente"></div>
          <button type="button" class="bouton-synthese" id="ouvrir-synthese">synthèse</button>
        </div>
      </div>
      <div class="rail" id="rail"></div>
      <div class="modules" id="modules"></div>
      <div class="journal journal-bus" id="journal-bus"></div>
    </section>

    <div id="frontiere"></div>

    <section class="bande bande-basse">
      <div class="journal journal-collecte" id="journal-collecte"></div>
      <div class="topologie" id="topologie"></div>
    </section>

    <div id="synthese-hote"></div>
  </div>

  <div id="barre-essais"></div>
`;

/* ---------------------------------------------------------------- moitié haute */

const ORDRE_MODULES = ["filtres", "tableau", "detail", "charge"] as const;

let rail: Rail | undefined;

// L'observabilité de la frontière front est une affaire de shell : le traceur est
// injecté ici, les fragments ne voient qu'un bus à deux méthodes.
const bus = creerBus((trace) => {
  tracer(trace);
  rail?.surTrace(trace);
});

// Le troisième argument (creerCadre) est le seul point de couture entre le shell
// réel et le chrome visuel de démonstration — voir reel/interface/haut/shell.ts.
const shell = new Shell(document.querySelector<HTMLElement>("#modules")!, bus, creerCadre);

shell.declarer("filtres", "mf-filtres");
shell.declarer("tableau", "mf-tableau");
shell.declarer("detail", "mf-detail");
shell.declarer("charge", "mf-charge");

rail = rendreRail(document.querySelector<HTMLElement>("#rail")!, shell, ORDRE_MODULES);
const detacherJournalBus = rendreJournalBus(document.querySelector<HTMLElement>("#journal-bus")!);

// Les consommateurs sont montés avant les producteurs. Le bus ne rejoue rien : un
// abonné monté après une publication l'a manquée définitivement.
for (const cle of ["tableau", "detail", "charge", "filtres"]) shell.monter(cle);
rail.repositionner();

/* ------------------------------------------------------------------ frontière */

const zoneSource = document.querySelector<HTMLElement>("#source-etat")!;

const detacherSource = observerSource((etat) => {
  zoneSource.dataset["phase"] = etat.phase;
  zoneSource.replaceChildren();

  const libelle = document.createElement("span");
  libelle.textContent = etat.detail ? `${etat.libelle} · ${etat.detail}` : etat.libelle;
  zoneSource.append(libelle);

  // L'identifiant de corrélation est affiché à côté de l'appel qui l'a produit. Sans
  // `Access-Control-Expose-Headers` côté service, il traverserait le réseau et serait
  // invisible ici : la corrélation serait réelle et indémontrable.
  if (etat.correlation) {
    const id = document.createElement("code");
    id.className = "source-correlation donnee";
    id.textContent = `id=${etat.correlation}`;
    zoneSource.append(id);
  }

  if (etat.phase === "erreur" || etat.phase === "degrade") {
    const reessai = document.createElement("button");
    reessai.type = "button";
    reessai.className = "bouton-reessai";
    reessai.textContent = "réessayer";
    reessai.addEventListener("click", () => void chargerDonnees(bus));
    zoneSource.append(reessai);
  }
});

// Changer de mode change la position de la frontière : on recharge les données pour
// que l'écran affiche ce que ce mode-là produit, sans recharger la page — les
// compteurs de session sont ce qui rend la comparaison lisible.
let premierMode = true;
const detacherModeChargement = observerMode(() => {
  if (premierMode) {
    premierMode = false;
    return;
  }
  void chargerDonnees(bus);
});

const detacherFrontiere = rendreFrontiere(document.querySelector<HTMLElement>("#frontiere")!);

/* ---------------------------------------------------------------- moitié basse */

const detacherRendu = rendreMoitieBasse(
  document.querySelector<HTMLElement>("#journal-collecte")!,
  document.querySelector<HTMLElement>("#topologie")!,
);

/* ------------------------------------------------------------------ synthèse */

const synthese = rendreSynthese(document.querySelector<HTMLElement>("#synthese-hote")!);

document
  .querySelector<HTMLButtonElement>("#ouvrir-synthese")!
  .addEventListener("click", () => synthese.ouvrir());

/* -------------------------------------------------------------------- essais */

const detacherBarre = rendreBarreEssais(document.querySelector<HTMLElement>("#barre-essais")!, {
  bus,
  shell,
  rail,
});

/**
 * Le flux de la console est ouvert AVANT le premier chargement de données.
 *
 * L'ordre compte pour la démonstration : la toute première traversée doit apparaître
 * dans le journal collecté. Si le flux s'ouvrait après, la ligne fondatrice manquerait
 * et l'écran s'ouvrirait sur un journal qui a déjà oublié quelque chose.
 */
const detacherFlux = demarrerFluxConsole();

async function demarrer(): Promise<void> {
  await attendreServices();
  await chargerDonnees(bus);
}

void demarrer().catch((erreur: unknown) => {
  console.error(erreur);
});

import.meta.hot?.dispose(() => {
  detacherBarre();
  synthese.detacher();
  detacherSource();
  detacherModeChargement();
  detacherJournalBus();
  rail?.detacher();
  detacherRendu();
  detacherFrontiere();
  detacherFlux();
});

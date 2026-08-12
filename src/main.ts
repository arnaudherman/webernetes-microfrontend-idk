import "./styles/socle.css";
import "./styles/page.css";
import "./styles/haut.css";
import "./styles/frontiere.css";
import "./styles/bas.css";
import "./styles/essais.css";
import "./styles/synthese.css";

// Enregistrement des éléments personnalisés. Le shell ne connaîtra ensuite que
// leurs noms de balise.
import "./haut/fragments/mf-filtres";
import "./haut/fragments/mf-filtres-v2";
import "./haut/fragments/mf-tableau";
import "./haut/fragments/mf-tableau-v2";
import "./haut/fragments/mf-detail";
import "./haut/fragments/mf-charge";

import { installerGardeReseau } from "./garde-reseau";
import { arreterCluster, demarrerCluster } from "./bas/cluster";
import { brancherEtatPods, brancherTrafic } from "./bas/etat-pods";
import { brancherEcouteursReseau, brancherEvenements } from "./bas/journal-cluster";
import { rendreMoitieBasse } from "./bas/rendu";
import { creerBus } from "./haut/bus";
import { rendreJournalBus, tracer } from "./haut/journal-bus";
import { rendreRail, type Rail } from "./haut/rail";
import { Shell } from "./haut/shell";
import { attendreCluster, chargerDonnees, observerSource } from "./frontiere/passerelle";
import { rendreFrontiere } from "./frontiere/vue-frontiere";
import { rendreBarreEssais } from "./essais/barre-essais";
import { rendreSynthese } from "./synthese/panneau";

// Avant toute chose, et avant la construction du moindre cluster : la page
// s'interdit d'émettre hors de sa propre origine.
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
      <div class="journal journal-cluster" id="journal-cluster"></div>
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

const shell = new Shell(document.querySelector<HTMLElement>("#modules")!, bus);

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

  if (etat.phase === "erreur") {
    const reessai = document.createElement("button");
    reessai.type = "button";
    reessai.className = "bouton-reessai";
    reessai.textContent = "réessayer";
    reessai.addEventListener("click", () => void chargerDonnees(bus));
    zoneSource.append(reessai);
  }
});

const detacherFrontiere = rendreFrontiere(document.querySelector<HTMLElement>("#frontiere")!);

/* ---------------------------------------------------------------- moitié basse */

const detacherRendu = rendreMoitieBasse(
  document.querySelector<HTMLElement>("#journal-cluster")!,
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

let detacherReseau: (() => void) | undefined;
let detacherTrafic: (() => void) | undefined;
let informateurPods: { stop: () => Promise<void> } | undefined;
let informateurEvenements: { stop: () => Promise<void> } | undefined;

async function demarrer(): Promise<void> {
  await demarrerCluster({
    avantInit: (cluster) => {
      detacherReseau = brancherEcouteursReseau(cluster);
      detacherTrafic = brancherTrafic(cluster);
    },
    apresInit: (cluster) => {
      informateurPods = brancherEtatPods(cluster);
      informateurEvenements = brancherEvenements(cluster);
    },
  });

  await attendreCluster();
  await chargerDonnees(bus);
}

void demarrer().catch((erreur: unknown) => {
  console.error(erreur);
});

import.meta.hot?.dispose(() => {
  detacherBarre();
  synthese.detacher();
  detacherSource();
  detacherJournalBus();
  rail?.detacher();
  detacherRendu();
  detacherFrontiere();
  detacherReseau?.();
  detacherTrafic?.();
  void informateurPods?.stop();
  void informateurEvenements?.stop();
  void arreterCluster();
});

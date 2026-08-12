import { servicesAppliques } from "./cluster";
import { observerJournalCluster, type LigneCluster } from "./journal-cluster";
import { observerPods, observerTrafic, comptePrets, type EtatPod } from "./etat-pods";
import { DEPLOIEMENT_CHARGES, DEPLOIEMENT_TACHES, REPLIQUES_TACHES } from "./manifestes";

/** Rendu de la moitié basse : journal du cluster, nœuds, pods, services. */

const NOEUDS = ["node-1", "node-2", "node-3"];
const PLAFOND_LIGNES = 300;

function heure(horodatage: number): string {
  const date = new Date(horodatage);
  const deuxChiffres = (valeur: number, taille = 2) => String(valeur).padStart(taille, "0");
  return (
    `${deuxChiffres(date.getHours())}:${deuxChiffres(date.getMinutes())}:` +
    `${deuxChiffres(date.getSeconds())}.${deuxChiffres(date.getMilliseconds(), 3)}`
  );
}

function cellule(classe: string, texte: string): HTMLElement {
  const element = document.createElement("span");
  element.className = classe;
  element.textContent = texte;
  return element;
}

function ligneJournal(ligne: LigneCluster): HTMLLIElement {
  const element = document.createElement("li");
  element.className = `ligne ligne-${ligne.nature}`;
  element.dataset["cle"] = ligne.cle;

  element.append(cellule("heure", heure(ligne.horodatage)));

  if (ligne.nature === "requete") {
    element.append(cellule("verbe", ligne.methode ?? "—"));
    element.append(cellule("cible", ligne.chemin ?? "—"));

    const statut = cellule(
      "statut",
      ligne.status === undefined ? (ligne.erreur ? "ERR" : "—") : String(ligne.status),
    );
    if (ligne.status !== undefined) {
      statut.classList.add(ligne.status >= 400 ? "est-panne" : "est-nominal");
    } else if (ligne.erreur) {
      statut.classList.add("est-panne");
    }
    element.append(statut);

    element.append(cellule("duree", ligne.dureeMs === undefined ? "—" : `${ligne.dureeMs} ms`));
    element.append(cellule("chaine", ligne.erreur ? `${ligne.chaine ?? ""} — ${ligne.erreur}` : (ligne.chaine ?? "")));
  } else {
    element.append(cellule("verbe", "ÉVÉN"));
    element.append(cellule("cible", `${ligne.motif ?? "?"} · ${ligne.objet ?? "?"}`));
    const niveau = cellule("statut", ligne.niveau === "Warning" ? "!" : "·");
    if (ligne.niveau === "Warning") niveau.classList.add("est-panne");
    element.append(niveau);
    element.append(cellule("duree", ligne.source ?? "—"));
    element.append(cellule("chaine", ligne.message ?? ""));
  }

  return element;
}

function rendreJournal(hote: HTMLElement): () => void {
  const liste = document.createElement("ol");
  liste.className = "journal-lignes donnee";
  liste.setAttribute("aria-live", "off");

  hote.replaceChildren(
    (() => {
      const entete = document.createElement("header");
      entete.className = "journal-tete";
      const titre = document.createElement("h2");
      titre.className = "titre-zone";
      titre.textContent = "journal du cluster";
      const legende = document.createElement("p");
      legende.className = "journal-legende";
      legende.innerHTML =
        "horodatage · méthode · chemin · <strong>code d'état</strong> · durée · chaîne de sauts";
      entete.append(titre, legende);
      return entete;
    })(),
    liste,
  );

  let derniereCle: string | undefined;

  return observerJournalCluster((lignes) => {
    const depuis = derniereCle
      ? lignes.findIndex((ligne) => ligne.cle === derniereCle) + 1
      : 0;
    const aAjouter = depuis > 0 || derniereCle === undefined ? lignes.slice(depuis) : lignes;

    if (aAjouter.length === 0 && lignes.length === 0) {
      liste.replaceChildren();
      derniereCle = undefined;
      return;
    }

    const enBas = liste.scrollTop + liste.clientHeight >= liste.scrollHeight - 24;
    for (const ligne of aAjouter) liste.append(ligneJournal(ligne));
    while (liste.childElementCount > PLAFOND_LIGNES) liste.firstElementChild?.remove();

    derniereCle = lignes.at(-1)?.cle;
    if (enBas) liste.scrollTop = liste.scrollHeight;
  });
}

function cartePod(pod: EtatPod): HTMLElement {
  const carte = document.createElement("article");
  carte.className = "pod";
  carte.dataset["presentation"] = pod.presentation;
  carte.dataset["nom"] = pod.nom;

  const nom = document.createElement("div");
  nom.className = "pod-nom donnee";
  nom.textContent = pod.nom;

  const meta = document.createElement("div");
  meta.className = "pod-meta";
  const phase = document.createElement("span");
  phase.className = "pod-phase";
  phase.textContent = pod.presentation === "terminaison" ? "Terminating" : pod.phase;
  const ip = document.createElement("span");
  ip.className = "pod-ip donnee";
  ip.textContent = pod.ip;
  meta.append(phase, ip);

  const etat = document.createElement("div");
  etat.className = "pod-etat";
  etat.textContent =
    (pod.pret ? "prêt" : "pas prêt") +
    (pod.redemarrages > 0 ? ` · ${pod.redemarrages} redémarrage(s)` : "");

  carte.append(nom, meta, etat);
  return carte;
}

function rendrePods(hote: HTMLElement): () => void {
  const entete = document.createElement("header");
  entete.className = "topologie-tete";
  const titre = document.createElement("h2");
  titre.className = "titre-zone";
  titre.textContent = "cluster — trois nœuds, namespace default";
  const compteurs = document.createElement("p");
  compteurs.className = "compteurs donnee";
  entete.append(titre, compteurs);

  const grille = document.createElement("div");
  grille.className = "noeuds";

  const zoneServices = document.createElement("div");
  zoneServices.className = "services donnee";

  hote.replaceChildren(entete, grille, zoneServices);

  const detacherPods = observerPods((pods) => {
    compteurs.textContent =
      `${DEPLOIEMENT_TACHES} ${comptePrets("taches")}/${REPLIQUES_TACHES} prêts · ` +
      `${DEPLOIEMENT_CHARGES} ${comptePrets("charges")}/1 prêt`;

    grille.replaceChildren(
      ...NOEUDS.map((noeud, index) => {
        const colonne = document.createElement("div");
        colonne.className = "noeud";

        const tete = document.createElement("div");
        tete.className = "noeud-tete";
        const nom = document.createElement("span");
        nom.textContent = noeud;
        const adresse = document.createElement("span");
        adresse.className = "donnee noeud-ip";
        adresse.textContent = `192.168.1.${index + 1}`;
        tete.append(nom, adresse);

        const contenu = document.createElement("div");
        contenu.className = "noeud-pods";
        const siens = pods.filter((pod) => pod.noeud === noeud);
        if (siens.length === 0) {
          const vide = document.createElement("p");
          vide.className = "noeud-vide";
          vide.textContent = "aucun pod applicatif";
          contenu.append(vide);
        } else {
          contenu.append(...siens.map(cartePod));
        }

        colonne.append(tete, contenu);
        return colonne;
      }),
    );

    const services = servicesAppliques();
    zoneServices.replaceChildren(
      ...services.map((service) => {
        const element = document.createElement("span");
        element.className = "service";
        element.textContent =
          `Service ${service.nom} · ${service.type} · ${service.clusterIP}:${service.port} → ${service.portCible}` +
          (service.nodePort ? ` · nodePort ${service.nodePort}` : "");
        return element;
      }),
    );
  });

  const detacherTrafic = observerTrafic((nomPod, status) => {
    const carte = grille.querySelector<HTMLElement>(`.pod[data-nom="${CSS.escape(nomPod)}"]`);
    if (!carte) return;
    carte.classList.remove("pod-trafic", "pod-trafic-panne");
    void carte.offsetWidth;
    carte.classList.add(status !== undefined && status >= 400 ? "pod-trafic-panne" : "pod-trafic");
    setTimeout(() => carte.classList.remove("pod-trafic", "pod-trafic-panne"), 700);
  });

  return () => {
    detacherPods();
    detacherTrafic();
  };
}

export function rendreMoitieBasse(hoteJournal: HTMLElement, hotePods: HTMLElement): () => void {
  const detacherJournal = rendreJournal(hoteJournal);
  const detacherPods = rendrePods(hotePods);
  return () => {
    detacherJournal();
    detacherPods();
  };
}

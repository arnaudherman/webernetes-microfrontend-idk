import { PORTS } from "../../../reel/interface/bas/adresses";
import { observerLien, type Lien } from "../../../reel/interface/bas/flux-console";
import { observerJournalCollecte, type LigneCollectee } from "../../../reel/interface/bas/journal-collecte";
import {
  observerProcessus,
  observerTrafic,
  presentation,
  type EtatProcessus,
} from "../../../reel/interface/bas/etat-processus";

/** Rendu de la moitié basse : journal collecté, processus, console. */

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

/**
 * Une ligne du journal.
 *
 * La colonne d'origine est la première, et elle n'est pas décorative : la console
 * déclenche les pannes ET collecte le journal. Sans elle, on pourrait soupçonner le
 * journal de raconter ce que la console a décidé plutôt que ce qui s'est produit.
 *
 *   ·   rapporté par le service lui-même, sur sa sortie standard
 *   »   constaté ou décidé par la console
 */
function ligneJournal(ligne: LigneCollectee): HTMLLIElement {
  const element = document.createElement("li");
  element.className = `ligne ligne-${ligne.nature}`;
  element.dataset["origine"] = ligne.origine;
  element.dataset["cle"] = ligne.cle;

  element.append(cellule("origine", ligne.origine === "console" ? "»" : "·"));
  element.append(cellule("heure", heure(ligne.horodatage)));
  element.append(cellule("service", ligne.service ?? "console"));

  if (ligne.nature === "requete") {
    element.append(cellule("cible", `${ligne.methode ?? "—"} ${ligne.chemin ?? "—"}`));

    const statut = cellule("statut", ligne.status === undefined ? "—" : String(ligne.status));
    if (ligne.status !== undefined) {
      statut.classList.add(ligne.status >= 400 ? "est-panne" : "est-nominal");
    }
    element.append(statut);

    element.append(cellule("duree", ligne.dureeMs === undefined ? "—" : `${ligne.dureeMs} ms`));
    element.append(
      cellule("chaine", `${ligne.de ?? "?"} → ${ligne.service ?? "?"}   id=${ligne.id ?? "—"}`),
    );
  } else {
    element.append(cellule("cible", ligne.nature));
    const niveau = cellule("statut", ligne.niveau === "attention" ? "!" : "·");
    if (ligne.niveau === "attention") niveau.classList.add("est-panne");
    element.append(niveau);
    element.append(cellule("duree", ""));
    element.append(cellule("chaine", ligne.message ?? ""));
  }

  return element;
}

function rendreJournal(hote: HTMLElement): () => void {
  const liste = document.createElement("ol");
  liste.className = "journal-lignes donnee";
  liste.setAttribute("aria-live", "off");

  const entete = document.createElement("header");
  entete.className = "journal-tete";

  const titre = document.createElement("h2");
  titre.className = "titre-zone";
  titre.textContent = "journal collecté — quatre processus, un flux";

  const legende = document.createElement("p");
  legende.className = "journal-legende";
  legende.innerHTML =
    "origine · horodatage · service · appel · <strong>code d'état</strong> · durée · " +
    "chemin et corrélation &nbsp;—&nbsp; <strong>·</strong> rapporté par le service, " +
    "<strong>»</strong> constaté par la console";

  /**
   * Le statut de ce journal est affiché, parce qu'il a changé et que le changement
   * est un résultat.
   *
   * Au-dessus de la ligne, la page VOIT : le journal du bus est écrit dans le fil
   * d'exécution qui publie, et il ne peut pas diverger de ce qui se produit. Ici, la
   * page est INFORMÉE : quatre processus lui racontent ce qu'ils ont bien voulu
   * écrire, par un canal qui peut prendre du retard ou tomber. C'est ainsi qu'on
   * observe un système réel, et il vaut mieux l'annoncer que laisser croire à une
   * transparence que la version simulée avait et que celle-ci n'a plus.
   */
  const statut = document.createElement("p");
  statut.className = "journal-statut";
  statut.innerHTML =
    "<strong>Rapporté, non constaté</strong> — la page ne voit pas les services, ils lui " +
    "racontent. Au-dessus de la ligne on voit ; en dessous on est informé.";

  const etatLien = document.createElement("p");
  etatLien.className = "lien-console donnee";

  // Le statut est un frère de l'en-tête, pas un quatrième élément de sa rangée :
  // l'en-tête est une ligne de base unique, et y insérer une phrase pleine largeur
  // la ferait éclater en quatre lignes au détriment du journal lui-même.
  entete.append(titre, legende, etatLien);
  hote.replaceChildren(entete, statut, liste);

  const detacherLien = observerLien((lien: Lien) => {
    etatLien.dataset["etat"] = lien.etat;
    etatLien.textContent =
      lien.etat === "ouvert"
        ? `flux ouvert depuis la console, 127.0.0.1:${PORTS.console}`
        : lien.etat === "attente"
          ? "connexion au flux de la console…"
          : `flux rompu — ${lien.detail ?? ""} · la moitié basse n'est plus rapportée. ` +
            `Lancer « npm run services ».`;
  });

  let derniereCle: string | undefined;

  const detacherJournal = observerJournalCollecte((lignes) => {
    const depuis = derniereCle ? lignes.findIndex((ligne) => ligne.cle === derniereCle) + 1 : 0;
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

  return () => {
    detacherLien();
    detacherJournal();
  };
}

function duree(ms: number | undefined): string {
  if (ms === undefined) return "—";
  const secondes = Math.floor(ms / 1000);
  if (secondes < 60) return `${secondes} s`;
  return `${Math.floor(secondes / 60)} min ${String(secondes % 60).padStart(2, "0")} s`;
}

const LIBELLES: Record<string, string> = {
  actif: "actif",
  fige: "figé — vivant, muet",
  muet: "ne répond plus",
  absent: "arrêté",
};

function carteProcessus(etat: EtatProcessus): HTMLElement {
  const carte = document.createElement("article");
  carte.className = "processus";
  carte.dataset["presentation"] = presentation(etat);
  carte.dataset["nom"] = etat.nom;

  const nom = document.createElement("div");
  nom.className = "processus-nom donnee";
  nom.textContent = `${etat.nom}:${etat.port}`;

  const meta = document.createElement("div");
  meta.className = "processus-meta";
  const phase = document.createElement("span");
  phase.className = "processus-phase";
  phase.textContent = LIBELLES[presentation(etat)] ?? "—";
  const pid = document.createElement("span");
  pid.className = "processus-pid donnee";
  pid.textContent = etat.pid === undefined ? "pas de pid" : `pid ${etat.pid}`;
  meta.append(phase, pid);

  const chiffres = document.createElement("div");
  chiffres.className = "processus-etat";
  chiffres.textContent =
    `${etat.requetes} requête${etat.requetes > 1 ? "s" : ""} · en vie ${duree(etat.depuisMs)}` +
    (etat.dernierStatus === undefined ? "" : ` · dernier ${etat.dernierStatus}`);

  carte.append(nom, meta, chiffres);
  return carte;
}

function rendreProcessus(hote: HTMLElement): () => void {
  const entete = document.createElement("header");
  entete.className = "topologie-tete";
  const titre = document.createElement("h2");
  titre.className = "titre-zone";
  titre.textContent = "trois processus, trois ports, un vrai réseau";
  const compteurs = document.createElement("p");
  compteurs.className = "compteurs donnee";
  entete.append(titre, compteurs);

  const grille = document.createElement("div");
  grille.className = "processus-grille";

  /**
   * La console est affichée à part, sous une étiquette qui dit ce qu'elle est.
   * La laisser dans la grille lui donnerait le statut d'un composant de
   * l'architecture, alors qu'elle occupe la place de la main de l'opérateur et du
   * collecteur de journaux — deux choses qui existent dans tout système réel et dont
   * aucune n'entre dans la comparaison.
   */
  const note = document.createElement("p");
  note.className = "hors-architecture prose";
  note.textContent =
    `Un quatrième processus tourne sur 127.0.0.1:${PORTS.console} : la console. ` +
    "Elle lance les trois autres, collecte leur journal et exécute les essais. Elle " +
    "est l'établi, pas un composant : rien de ce qu'elle fait n'entre dans la comparaison.";

  hote.replaceChildren(entete, grille, note);

  const detacherProcessus = observerProcessus((processus) => {
    // « 0/0 en état de répondre » est un décompte sur un ensemble vide : ça se lit
    // comme une observation alors que c'est une absence d'observation. Tant que la
    // console n'a rien rapporté, on le dit — et le titre annonce la composition de
    // l'architecture, pas ce qu'on aurait constaté.
    if (processus.length === 0) {
      compteurs.textContent = "aucun service rapporté";
      const rien = document.createElement("p");
      rien.className = "aucun-service prose";
      rien.textContent =
        "La console n'a encore rien rapporté. Ce n'est pas « zéro service en état de " +
        "répondre » : c'est que personne ne nous a rien dit. Lancer « npm run demo ».";
      grille.replaceChildren(rien);
      return;
    }

    const vivants = processus.filter((etat) => etat.vivant && etat.repond).length;
    compteurs.textContent = `${vivants}/${processus.length} en état de répondre`;
    grille.replaceChildren(...processus.map(carteProcessus));
  });

  const detacherTrafic = observerTrafic((nom, status) => {
    const carte = grille.querySelector<HTMLElement>(`.processus[data-nom="${CSS.escape(nom)}"]`);
    if (!carte) return;
    carte.classList.remove("processus-trafic", "processus-trafic-panne");
    void carte.offsetWidth;
    carte.classList.add(
      status !== undefined && status >= 400 ? "processus-trafic-panne" : "processus-trafic",
    );
    setTimeout(() => carte.classList.remove("processus-trafic", "processus-trafic-panne"), 700);
  });

  return () => {
    detacherProcessus();
    detacherTrafic();
  };
}

export function rendreMoitieBasse(hoteJournal: HTMLElement, hoteProcessus: HTMLElement): () => void {
  const detacherJournal = rendreJournal(hoteJournal);
  const detacherProcessus = rendreProcessus(hoteProcessus);
  return () => {
    detacherJournal();
    detacherProcessus();
  };
}

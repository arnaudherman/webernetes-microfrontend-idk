import { compteurs } from "./compteurs";

/**
 * L'écran de synthèse.
 *
 * Replié par défaut, déplié en fin de démonstration. Il ne résume pas la théorie :
 * il chiffre la session qu'on vient de jouer. Les nombres sont relus à chaque
 * ouverture, jamais mémorisés.
 *
 * Les trois lignes de conclusion sont formulées comme des conditions, pas comme une
 * recommandation. L'étude est exploratoire ; conclure que les micro-frontends sont
 * une bonne ou une mauvaise idée serait répondre à une question que personne n'a
 * posée, et le faire sur la base d'une démonstration de huit minutes.
 */

interface LigneComparaison {
  readonly critere: string;
  readonly sous: string;
  readonly au_dessus: string;
}

const COMPARAISON: readonly LigneComparaison[] = [
  {
    critere: "Frontière vérifiée par",
    sous: "le réseau, à chaque appel",
    au_dessus: "personne",
  },
  {
    critere: "Panne signalée",
    sous: "code d'état, délai, réessai",
    au_dessus: "aucun signal",
  },
  {
    critere: "Destinataire absent",
    sous: "connexion refusée, 503",
    au_dessus: "message perdu en silence",
  },
  {
    critere: "Observabilité",
    sous: "native",
    au_dessus: "à construire entièrement",
  },
  {
    critere: "Découpage naturel",
    sous: "par service",
    au_dessus: "par écran et par équipe",
  },
  {
    critere: "Coût principal",
    sous: "latence et cohérence",
    au_dessus: "coordination et gouvernance des contrats",
  },
];

const CONDITIONS: readonly string[] = [
  "Les micro-frontends deviennent pertinents à partir de plusieurs équipes qui livrent sur des cadences différentes.",
  "En dessous de ce seuil, ils ajoutent un coût de coordination sans contrepartie.",
  "L'observabilité de la frontière front est un prérequis, pas une amélioration ultérieure.",
];

function cellule(balise: "td" | "th", texte: string, classe?: string): HTMLElement {
  const element = document.createElement(balise);
  if (classe) element.className = classe;
  element.textContent = texte;
  if (balise === "th") element.scope = "row";
  return element;
}

function chiffre(valeur: number, libelle: string, note?: string): HTMLElement {
  const bloc = document.createElement("div");
  bloc.className = "chiffre";

  const nombre = document.createElement("p");
  nombre.className = "chiffre-valeur donnee";
  nombre.textContent = String(valeur);

  const intitule = document.createElement("p");
  intitule.className = "chiffre-libelle";
  intitule.textContent = libelle;

  bloc.append(nombre, intitule);

  if (note) {
    const precision = document.createElement("p");
    precision.className = "chiffre-note";
    precision.textContent = note;
    bloc.append(precision);
  }

  return bloc;
}

export function rendreSynthese(hote: HTMLElement): { ouvrir: () => void; detacher: () => void } {
  const panneau = document.createElement("details");
  panneau.className = "synthese";
  panneau.id = "synthese";

  const resume = document.createElement("summary");
  resume.className = "synthese-resume";
  resume.textContent = "écran de synthèse — l'asymétrie, chiffrée sur cette session";

  const corps = document.createElement("div");
  corps.className = "synthese-corps";

  const zoneChiffres = document.createElement("div");
  zoneChiffres.className = "chiffres";

  const tableau = document.createElement("table");
  tableau.className = "comparaison";

  const entete = document.createElement("thead");
  const rangeeEntete = document.createElement("tr");
  rangeeEntete.append(
    cellule("td", ""),
    cellule("td", "Sous la frontière (HTTP)", "colonne-bas"),
    cellule("td", "Au-dessus (bus d'événements)", "colonne-haut"),
  );
  entete.append(rangeeEntete);

  const corpsTableau = document.createElement("tbody");
  for (const ligne of COMPARAISON) {
    const rangee = document.createElement("tr");
    rangee.append(
      cellule("th", ligne.critere),
      cellule("td", ligne.sous, "colonne-bas"),
      cellule("td", ligne.au_dessus, "colonne-haut"),
    );
    corpsTableau.append(rangee);
  }
  tableau.append(entete, corpsTableau);

  const conclusion = document.createElement("div");
  conclusion.className = "conclusion";
  const titreConclusion = document.createElement("h3");
  titreConclusion.className = "titre-zone";
  titreConclusion.textContent = "conditions, et non recommandation";
  const liste = document.createElement("ul");
  liste.className = "conditions";
  for (const condition of CONDITIONS) {
    const element = document.createElement("li");
    element.className = "prose";
    element.textContent = condition;
    liste.append(element);
  }
  conclusion.append(titreConclusion, liste);

  corps.append(zoneChiffres, tableau, conclusion);
  panneau.append(resume, corps);
  hote.replaceChildren(panneau);

  function rafraichir(): void {
    const c = compteurs();
    zoneChiffres.replaceChildren(
      chiffre(c.messagesPublies, "messages publiés sur le bus"),
      chiffre(c.messagesPerdus, "partis vers 0 abonné", "aucun n'a produit de signal"),
      chiffre(c.traversees, "appels émis à travers la frontière"),
      chiffre(c.codes5xx, "codes 5xx reçus", "qualifiés par le réseau"),
      chiffre(c.contratsServeurDetectes, "contrats serveur violés", "détectés par le réseau"),
      chiffre(
        c.contratsFrontDetectes,
        "contrats front violés détectés",
        c.contratsFrontDeclenches > 0
          ? `${c.contratsFrontDeclenches} déclenché(s) et connu(s) du seul opérateur`
          : "aucun mécanisme ne serait en position d'en détecter",
      ),
      chiffre(c.sortiesBloquees, "requêtes sortantes refusées", "la page n'émet rien hors de l'onglet"),
    );
  }

  panneau.addEventListener("toggle", () => {
    if (panneau.open) rafraichir();
  });

  rafraichir();

  return {
    ouvrir() {
      panneau.open = true;
      rafraichir();
      panneau.scrollIntoView({ block: "start", behavior: "smooth" });
    },
    detacher() {
      hote.replaceChildren();
    },
  };
}

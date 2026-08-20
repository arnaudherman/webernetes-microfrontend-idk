import { compteurs, type Compteurs } from "./compteurs";

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
    sous: "un intermédiaire, quand quelqu'un l'a écrit",
    au_dessus: "personne, et personne ne serait en position de le faire",
  },
  {
    critere: "Panne signalée",
    sous: "code d'état, délai, réessai",
    au_dessus: "aucun signal",
  },
  {
    critere: "Cause de la panne",
    sous: "nommée : ECONNREFUSED, budget dépassé, 500",
    au_dessus: "indisponible, par décision de la plateforme",
  },
  {
    // La colonne neuve, et celle qu'on oublie le plus facilement : renoncer est une
    // DÉCISION, et elle demande deux informations qu'un fragment n'a pas.
    critere: "Renoncement (budget de délai)",
    sous: "dérivable : distribution de latence de l'amont, échéance de l'appelant",
    au_dessus: "aucune des deux n'est connue — et fetch n'expire jamais de lui-même",
  },
  {
    // Seule ligne du tableau qu'aucun essai ne démontre, et elle est formulée pour
    // qu'on ne puisse pas le lui reprocher : la fermeture de connexion EST observable
    // côté serveur, mais cette passerelle-ci n'en fait rien. On ne s'attribue pas une
    // propriété qu'on n'a pas jouée devant la salle.
    critere: "Annulation",
    sous: "la fermeture de connexion est observable — non exploitée ici",
    au_dessus: "un message publié ne se rappelle pas, et rien ne l'observe",
  },
  {
    critere: "Destinataire absent",
    sous: "connexion refusée, 503 ou 200 partiel",
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

/**
 * L'écart entre les deux positions de la frontière, mesuré sur la session.
 *
 * C'est le livrable de la seconde version de ce dispositif. Les deux modes servent
 * le même écran à partir des mêmes services ; leur différence n'apparaît qu'en
 * panne, et elle tient dans la dernière ligne — le nombre d'échecs dont la CAUSE a
 * pu être nommée. Via la passerelle, il égale le nombre d'échecs. En appels directs,
 * il reste à zéro, quoi qu'on fasse, parce que le navigateur ne transmet pas la cause.
 *
 * Le tableau reste vide tant qu'on n'a pas joué dans les deux modes. C'est voulu :
 * une comparaison à moitié jouée n'est pas une comparaison, et remplir les cases
 * absentes avec des zéros donnerait à croire le contraire.
 */
function rendreEcart(compteurs: Compteurs): HTMLElement {
  const bloc = document.createElement("div");
  bloc.className = "ecart";

  const titre = document.createElement("h3");
  titre.className = "titre-zone";
  titre.textContent = "l'écart entre les deux positions de la frontière, sur cette session";
  bloc.append(titre);

  const tableau = document.createElement("table");
  tableau.className = "comparaison comparaison-ecart";

  const entete = document.createElement("thead");
  const rangeeEntete = document.createElement("tr");
  rangeeEntete.append(
    cellule("td", ""),
    cellule("td", "Via passerelle", "colonne-bas"),
    cellule("td", "Appels directs", "colonne-haut"),
  );
  entete.append(rangeeEntete);

  const moyenne = (mesure: { cumulMs: number; chargements: number }) =>
    mesure.chargements === 0 ? "—" : `${Math.round(mesure.cumulMs / mesure.chargements)} ms`;

  const lignes: readonly [string, (mesure: Compteurs["parMode"]["direct"]) => string][] = [
    ["Chargements joués", (mesure) => String(mesure.chargements)],
    ["Appels HTTP émis", (mesure) => String(mesure.appels)],
    ["Durée moyenne", moyenne],
    ["Échecs", (mesure) => String(mesure.echecs)],
    ["dont la cause a pu être nommée", (mesure) => String(mesure.echecsQualifies)],
  ];

  const corps = document.createElement("tbody");
  for (const [critere, valeur] of lignes) {
    const rangee = document.createElement("tr");
    rangee.append(
      cellule("th", critere),
      cellule("td", valeur(compteurs.parMode.passerelle), "colonne-bas donnee"),
      cellule("td", valeur(compteurs.parMode.direct), "colonne-haut donnee"),
    );
    corps.append(rangee);
  }
  tableau.append(entete, corps);
  bloc.append(tableau);

  const joues = (["passerelle", "direct"] as const).filter(
    (mode) => compteurs.parMode[mode].chargements > 0,
  );
  if (joues.length < 2) {
    const note = document.createElement("p");
    note.className = "ecart-note prose";
    note.textContent =
      "Un seul mode a été joué pour l'instant. Basculez le sélecteur posé sur la ligne de " +
      "frontière, rejouez la même panne, et revenez ici : c'est la comparaison qui est le " +
      "résultat, pas les chiffres d'un seul côté.";
    bloc.append(note);
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

  const zoneEcart = document.createElement("div");
  zoneEcart.className = "zone-ecart";

  corps.append(zoneChiffres, tableau, zoneEcart, conclusion);
  panneau.append(resume, corps);
  hote.replaceChildren(panneau);

  function rafraichir(): void {
    const c = compteurs();
    zoneChiffres.replaceChildren(
      chiffre(c.messagesPublies, "messages publiés sur le bus"),
      chiffre(c.messagesPerdus, "partis vers 0 abonné", "aucun n'a produit de signal"),
      chiffre(c.traversees, "traversées de la frontière"),
      chiffre(c.codes5xx, "codes 5xx reçus", "qualifiés par le réseau"),
      chiffre(c.contratsServeurDetectes, "contrats serveur violés", "signalés par un code d'état"),
      chiffre(
        c.contratsAmontDetectes,
        "charges utiles non conformes arrêtées",
        "par la passerelle, avant le client — essai 4",
      ),
      chiffre(
        c.contratsFrontDetectes,
        "contrats front violés détectés",
        c.contratsFrontDeclenches > 0
          ? `${c.contratsFrontDeclenches} déclenché(s) et connu(s) du seul opérateur`
          : "aucun mécanisme ne serait en position d'en détecter",
      ),
      chiffre(c.sortiesBloquees, "sorties refusées", "seules les quatre origines déclarées"),
    );
    zoneEcart.replaceChildren(rendreEcart(c));
  }

  panneau.addEventListener("toggle", () => {
    if (panneau.open) rafraichir();
  });

  rafraichir();

  return {
    ouvrir() {
      panneau.open = true;
      rafraichir();
      /*
       * `behavior: "auto"` et non `"smooth"`, et ce n'est pas un choix d'esthétique.
       *
       * Mesuré : avec `"smooth"`, `scrollY` restait à 0 pendant que le panneau
       * s'ouvrait 1237 px plus bas — 146 px sous la ligne de flottaison. Le bouton
       * « synthèse » est en haut à droite de la page, le panneau tout en bas : on
       * cliquait, et rien ne bougeait à l'écran. Un contrôle qui promet d'ouvrir
       * quelque chose et ne l'amène pas sous les yeux est exactement le genre de
       * silence que cette démonstration dénonce.
       */
      panneau.scrollIntoView({ block: "start", behavior: "auto" });
    },
    detacher() {
      hote.replaceChildren();
    },
  };
}

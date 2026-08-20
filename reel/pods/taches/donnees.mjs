// @ts-check

/**
 * Le jeu de données de la démonstration : les tâches d'une étude d'architecture réelle.
 *
 * Ce fichier est chargé par le processus `taches`, et par lui seul. Il n'est plus
 * écrit en TypeScript, et ce n'est pas une régression : c'est la conséquence du
 * déplacement.
 *
 * Auparavant, « aucun fragment n'importe le type `Tache` » était une discipline —
 * tenue par un vérificateur d'imports, mais une discipline. Le type existait, à
 * portée de `import`. Maintenant la donnée vit dans un autre processus, dans un
 * autre fichier, dans un autre mode de langage : il n'y a plus de type à partager,
 * même pour qui le voudrait. L'absence de contrat de forme entre les deux moitiés
 * est devenue un fait de topologie.
 *
 * C'est le sujet de l'étude, pas un oubli. Si un fragment pouvait importer ce type,
 * l'essai 5 deviendrait une erreur de compilation et la démonstration s'effondrerait :
 * le compilateur jouerait le rôle que personne ne joue en vrai entre deux équipes qui
 * livrent séparément.
 *
 * @typedef {"a-faire" | "en-cours" | "termine"} Statut
 *
 * @typedef {object} Tache
 * @property {string} id
 * @property {string} titre
 * @property {Statut} statut
 * @property {string} responsable
 * @property {string} echeance      Au format AAAA-MM-JJ.
 * @property {number} chargeJours
 */

/** @type {readonly Tache[]} */
export const ETUDE = [
  {
    id: "T-01",
    titre: "Recenser les applications front du SI",
    statut: "termine",
    responsable: "A. Mercier",
    echeance: "2026-09-04",
    chargeJours: 4,
  },
  {
    id: "T-02",
    titre: "Mener les entretiens avec les équipes produit",
    statut: "termine",
    responsable: "C. Delaunay",
    echeance: "2026-09-11",
    chargeJours: 6,
  },
  {
    id: "T-03",
    titre: "Cartographier les dépendances entre écrans",
    statut: "en-cours",
    responsable: "A. Mercier",
    echeance: "2026-09-25",
    chargeJours: 5,
  },
  {
    id: "T-04",
    titre: "Rédiger la note de cadrage",
    statut: "a-faire",
    responsable: "S. Rahimi",
    echeance: "2026-10-02",
    chargeJours: 3,
  },
  {
    id: "T-05",
    titre: "Comparer les mécanismes d'intégration",
    statut: "en-cours",
    responsable: "S. Rahimi",
    echeance: "2026-10-09",
    chargeJours: 8,
  },
  {
    id: "T-06",
    titre: "Évaluer le coût de coordination inter-équipes",
    statut: "a-faire",
    responsable: "C. Delaunay",
    echeance: "2026-10-16",
    chargeJours: 5,
  },
  {
    id: "T-07",
    titre: "Définir les critères d'observabilité de la frontière",
    statut: "a-faire",
    responsable: "A. Mercier",
    echeance: "2026-10-23",
    chargeJours: 4,
  },
  {
    id: "T-08",
    titre: "Instruire le scénario à une seule équipe",
    statut: "a-faire",
    responsable: "S. Rahimi",
    echeance: "2026-10-30",
    chargeJours: 2,
  },
  {
    id: "T-09",
    titre: "Préparer la présentation à l'équipe d'architecture",
    statut: "en-cours",
    responsable: "C. Delaunay",
    echeance: "2026-11-06",
    chargeJours: 3,
  },
];

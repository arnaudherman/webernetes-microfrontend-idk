/**
 * Le jeu de données de la démonstration : les tâches d'une étude d'architecture réelle.
 *
 * Ce module vit sous `src/bas`. Il est servi par l'image `etude/taches`, à
 * l'intérieur du cluster. Aucun module de `src/haut` ne l'importe — pas même le
 * type `Tache`.
 *
 * Ce n'est pas une coquetterie. Si un fragment importait `Tache`, l'essai 5
 * (« mf-filtres publie { etat } au lieu de { statut } ») deviendrait une erreur
 * de compilation, et la démonstration s'effondrerait : le compilateur jouerait le
 * rôle que personne ne joue en vrai entre deux équipes qui livrent séparément.
 * L'absence de type partagé est le sujet, pas un oubli.
 */

export type Statut = "a-faire" | "en-cours" | "termine";

export interface Tache {
  readonly id: string;
  readonly titre: string;
  readonly statut: Statut;
  readonly responsable: string;
  /** Échéance au format AAAA-MM-JJ. */
  readonly echeance: string;
  readonly chargeJours: number;
}

export const ETUDE: readonly Tache[] = [
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

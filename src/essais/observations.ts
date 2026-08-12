/**
 * Les observations.
 *
 * Une zone de texte mise à jour à chaque essai. Elle dit ce qui vient de se passer et
 * ce qu'il faut en conclure, pour un architecte d'entreprise : vérification,
 * signalement, coût, gouvernance — pas cycle de vie d'éléments personnalisés.
 *
 * Chaque observation se lit à deux vitesses. Le VERDICT est la phrase que la salle
 * lit sur l'écran ; le DÉTAIL est ce que la personne qui présente développe à l'oral.
 * Le texte compte autant que le code : c'est lui qui empêche la démonstration de se
 * réduire à une curiosité technique.
 */

export interface Observation {
  readonly titre: string;
  readonly verdict: string;
  readonly detail: string;
  readonly ton: "neutre" | "nominal" | "panne";
}

export const OBSERVATION_INITIALE: Observation = {
  titre: "six essais, groupés par moitié",
  verdict: "Deux essais agissent sous la frontière, quatre au-dessus.",
  detail:
    "Chaque essai met à jour cette zone. Les essais 5 puis 2 sont à jouer l'un après " +
    "l'autre, sans rechargement : c'est la comparaison décisive.",
  ton: "neutre",
};

export function suppressionPod(nom: string, noeud: string): Observation {
  return {
    titre: "essai 1 — un pod supprimé, un pod recréé",
    verdict: "C'est ce que Webernetes enseigne, et rien là-dedans ne concerne l'interface.",
    detail:
      `${nom} a été supprimé sur ${noeud}. Le contrôleur en a recréé un, le planificateur ` +
      "l'a placé, le Service a routé vers lui dès qu'il a été prêt. Toute la séquence est " +
      "datée dans le journal du cluster, à droite.",
    ton: "nominal",
  };
}

export const CONTRAT_SERVEUR_ROMPU: Observation = {
  titre: "essai 2 — la même panne, immédiatement qualifiée",
  verdict: "Le réseau a qualifié la panne : un code d'état, à l'appel suivant.",
  detail:
    "Le pod répond 500 sans avoir redémarré — même conteneur, zéro redémarrage. L'appelant " +
    "n'a rien eu à deviner : il affiche une erreur explicite, propose de réessayer, et sait " +
    "compter ses échecs. La frontière est vérifiée par un tiers qui n'est ni l'émetteur ni " +
    "le destinataire. Comparez avec l'essai 5.",
  ton: "panne",
};

export const CONTRAT_SERVEUR_RETABLI: Observation = {
  titre: "essai 2 — contrat serveur rétabli",
  verdict: "Le rétablissement se constate comme la panne : par un code d'état.",
  detail:
    "Le service répond de nouveau 200, les données sont revenues. Aucune des deux " +
    "transitions n'a demandé au client de faire une hypothèse.",
  ton: "nominal",
};

export const FRAGMENT_DEMONTE: Observation = {
  titre: "essai 3 — déployabilité indépendante, perte silencieuse",
  verdict: "Cliquez une tâche : le journal du bus affichera « 0 abonné », sans rien signaler.",
  detail:
    "Le fragment de détail a disparu, les trois autres n'ont pas bougé, la console est " +
    "restée vide. La déployabilité indépendante est réelle — c'est le principal argument en " +
    "faveur du modèle. Mais le tableau continue de publier dans le vide et se croit entendu.",
  ton: "neutre",
};

export const FRAGMENT_REMONTE: Observation = {
  titre: "essai 4 — un fragment en différé démarre aveugle",
  verdict: "Le fragment est revenu vide : le bus ne rejoue rien.",
  detail:
    "Tout ce qui a été publié pendant son absence lui est définitivement perdu. Ce n'est pas " +
    "un défaut d'implémentation, c'est un choix d'architecture — mais un choix qui doit être " +
    "écrit quelque part, sinon chaque équipe le redécouvrira à ses frais.",
  ton: "neutre",
};

export const CONTRAT_FRONT_ROMPU: Observation = {
  titre: "essai 5 — l'interface ment, et rien ne le signale",
  verdict: "Le filtre indique « en cours », le tableau annonce neuf sur neuf. Le chiffre est faux.",
  detail:
    "La version 2.0 des filtres publie etat au lieu de statut ; son contrat déclaré, lui, est " +
    "inchangé. Le tableau lit statut, obtient undefined, en conclut qu'aucun filtre n'est " +
    "demandé. Aucune exception, aucun journal anormal. Le couplage n'a pas disparu : il a été " +
    "déplacé du code vers un contrat non typé que personne ne vérifie.",
  ton: "panne",
};

export const CONTRAT_FRONT_RETABLI: Observation = {
  titre: "essai 5 — contrat front rétabli",
  verdict: "Ni la rupture ni le rétablissement n'ont laissé la moindre trace.",
  detail:
    "Le filtrage fonctionne de nouveau. Notez comment nous l'avons appris : parce que nous " +
    "savions quoi regarder. Sous la frontière, la même séquence aurait laissé deux lignes " +
    "horodatées avec leur code d'état.",
  ton: "nominal",
};

export const TABLEAU_REMPLACE: Observation = {
  titre: "essai 6 — substitution à chaud, contrat respecté",
  verdict: "La substitution tient parce que le contrat est respecté. C'est cela qu'il faut gouverner.",
  detail:
    "Le rendu a changé du tout au tout ; le shell n'a changé qu'un nom de balise et les autres " +
    "fragments n'ont pas été prévenus. Le coût est visible à l'instant : le fragment neuf est " +
    "arrivé vide et il a fallu redemander les données au cluster. Même angle mort qu'à " +
    "l'essai 4, payé à chaque substitution.",
  ton: "nominal",
};

export const TABLEAU_RESTAURE: Observation = {
  titre: "essai 6 — retour à l'implémentation d'origine",
  verdict: "La réversibilité est réelle, elle n'est pas gratuite.",
  detail:
    "Même geste, même coût : un nom de balise changé, un rechargement pour repeupler le " +
    "fragment.",
  ton: "neutre",
};

export function echec(message: string): Observation {
  return {
    titre: "l'essai n'a pas pu être joué",
    verdict: "L'essai a échoué.",
    detail: message,
    ton: "panne",
  };
}

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
  titre: "huit essais, et la numérotation monte à travers la ligne",
  verdict: "Les essais 1 à 4 se jouent sous la frontière, les essais 5 à 8 au-dessus.",
  detail:
    "Chaque essai met à jour cette zone. Les essais 4 puis 5 sont à jouer l'un après " +
    "l'autre, sans rechargement : c'est la même faute — un champ renommé, contrat " +
    "déclaré inchangé — placée de part et d'autre de la ligne. Deux boutons voisins, " +
    "séparés uniquement par elle. C'est la comparaison décisive. " +
    "Les essais du bas se rejouent dans les deux modes, avec le sélecteur posé sur la ligne.",
  ton: "neutre",
};

/* ------------------------------------------- essai 1 : tuer le service charges */

export function serviceTue(mode: "passerelle" | "direct"): Observation {
  if (mode === "passerelle") {
    return {
      titre: "essai 1 — l'amont optionnel manque, la passerelle tranche",
      verdict: "200 partiel : les tâches sont là, l'agrégat manque, et le manque est NOMMÉ.",
      detail:
        "Le processus est mort — pid disparu, port fermé. La passerelle a reçu un vrai " +
        "ECONNREFUSED, immédiatement : sur la boucle locale un refus ne fait pas attendre. " +
        "Elle a distingué l'amont essentiel de l'amont optionnel et décidé de servir ce " +
        "qui était servable, en disant quoi manque et pourquoi. Rejouez le même essai en " +
        "appels directs.",
      ton: "panne",
    };
  }

  return {
    titre: "essai 1 — la même panne, sans personne pour la nommer",
    verdict: "Le manque est constaté, la cause est perdue : « Failed to fetch », et rien d'autre.",
    detail:
      "La page a bien dégradé — parce que ce code-ci a été écrit pour le faire, et qu'il " +
      "sera à réécrire dans chaque front qui parlera à ces services. Mais le navigateur " +
      "rend le même TypeError pour un service mort, un refus CORS et un port fermé : il le " +
      "fait exprès, et c'est définitif. La décision a survécu au déplacement de la " +
      "frontière ; l'information qui la fonde, non.",
    ton: "panne",
  };
}

export const SERVICE_RELANCE: Observation = {
  titre: "essai 1 — service relancé",
  verdict: "Nouveau pid, compteur de requêtes à zéro : c'est un autre processus.",
  detail:
    "Rien ne l'avait relancé tout seul. Il n'y a plus de contrôleur sous cette frontière, " +
    "et c'est le prix des vrais processus — payé une fois, en échange de vraies pannes.",
  ton: "nominal",
};

/* ------------------------------------- essai 2 : casser le contrat serveur (500) */

export const CONTRAT_SERVEUR_ROMPU: Observation = {
  titre: "essai 2 — l'amont essentiel tombe, et ça ne se dégrade pas",
  verdict: "503 : sans la liste des tâches, il n'y a rien à composer, et la passerelle le dit.",
  detail:
    "taches répond 500 sans avoir redémarré — même processus, même pid, l'uptime ne " +
    "bouge pas. C'est bien la même instance, vivante, qui se met à mentir. Comparez avec " +
    "l'essai 1, joué il y a un instant : même passerelle, autre amont, autre décision. " +
    "Distinguer l'essentiel de l'optionnel demande quelqu'un au milieu qui connaisse les " +
    "deux — c'est exactement ce qui n'existe pas au-dessus de la frontière.",
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

/* -------------------------------------------- essai 3 : figer, sans tuer */

export function serviceFige(mode: "passerelle" | "direct"): Observation {
  if (mode === "passerelle") {
    return {
      titre: "essai 3 — vivant, et muet",
      verdict: "La passerelle a renoncé à 800 ms, parce qu'elle porte un budget de délai.",
      detail:
        "SIGSTOP : le processus existe toujours, sa socket d'écoute est ouverte, le noyau " +
        "accepte les connexions — et personne ne répond jamais. Ce n'est pas un refus, " +
        "c'est un silence, et rien ne le distingue d'une lenteur sinon une décision. " +
        "Écrire un intermédiaire OBLIGE à la prendre : il faut bien répondre quelque chose.",
      ton: "panne",
    };
  }

  return {
    titre: "essai 3 — vivant, muet, et la page attend",
    verdict: "Aucun budget de délai : la page attend, et elle attendra indéfiniment.",
    detail:
      "Regardez le compteur sur la ligne de frontière : il monte. fetch n'expire jamais " +
      "de lui-même. On POURRAIT écrire ce budget ici — il faudrait l'écrire, et le " +
      "réécrire dans chaque front. Personne ne vous y oblige, et c'est précisément le " +
      "problème : la contrainte n'a pas disparu avec la frontière, elle est devenue " +
      "facultative. Cliquez « dégeler ».",
    ton: "panne",
  };
}

export const SERVICE_DEGELE: Observation = {
  titre: "essai 3 — service dégelé",
  verdict: "SIGCONT : le processus reprend là où il s'était arrêté, sans redémarrer.",
  detail:
    "Le compteur de requêtes n'a pas été remis à zéro et le pid est le même : c'est bien " +
    "la même instance. Un gel n'est pas une mort, et un système qui ne distingue pas les " +
    "deux traite deux pannes différentes de la même façon.",
  ton: "nominal",
};

/* ------------------------- essai 4 : servir une charge utile non conforme */

/**
 * Le premier des deux essais décisifs, et à lui seul deux des trois positions.
 *
 * La MÊME faute — `taches` sert « etat » là où le contrat dit « statut » — est jouée
 * ici sous la frontière, une fois avec un intermédiaire et une fois sans. L'essai 5
 * la rejoue une troisième fois, au-dessus. Trois positions, une seule faute.
 */
export function formeRompue(mode: "passerelle" | "direct"): Observation {
  if (mode === "passerelle") {
    return {
      titre: "essai 4 — première position : un intermédiaire, et l'écart est nommé",
      verdict: "502 : « champ requis absent : statut · champ inattendu : etat ».",
      detail:
        "taches sert etat au lieu de statut. Le nom de la ressource n'a pas bougé, le code " +
        "d'état est 200, le service est en parfaite santé. Trois consommateurs reçoivent " +
        "cette charge utile sans broncher — charges en tire un agrégat faux, avec une " +
        "catégorie « undefined » qui contient tout. Un seul la refuse, et ce n'est pas « le " +
        "réseau » : c'est un intermédiaire, parce que quelqu'un y a écrit la forme attendue. " +
        "Question à poser avant qu'on vous la pose : qui possède ce schéma ? " +
        "Basculez maintenant en appels directs, sans rien rétablir.",
      ton: "panne",
    };
  }

  return {
    titre: "essai 4 — deuxième position : plus d'intermédiaire, et le tableau ment",
    verdict: "200, aucune exception, aucun avertissement. Le tableau annonce neuf sur neuf.",
    detail:
      "Même faute, même service, même HTTP — et cette fois elle passe. Le protocole n'a " +
      "rien vérifié : il n'a jamais rien vérifié. Ce qui vérifiait, il y a un instant, " +
      "c'était la passerelle, et elle seule. Retirez l'intermédiaire et le réseau devient " +
      "exactement aussi silencieux qu'un bus d'événements. " +
      "Jouez maintenant l'essai 5, juste à droite : la même faute, au-dessus de la ligne.",
    ton: "panne",
  };
}

export const FORME_RETABLIE: Observation = {
  titre: "essai 4 — forme rétablie",
  verdict: "Le champ a repris son nom, et les deux modes redeviennent indiscernables.",
  detail:
    "C'est le point à retenir : hors panne, les deux positions de la frontière donnent le " +
    "même écran. L'écart ne se voit que le jour où quelque chose casse — ce qui est le " +
    "plus mauvais moment pour le découvrir.",
  ton: "nominal",
};

export const FRAGMENT_DEMONTE: Observation = {
  titre: "essai 6 — déployabilité indépendante, perte silencieuse",
  verdict: "Cliquez une tâche : le journal du bus affichera « 0 abonné », sans rien signaler.",
  detail:
    "Le fragment de détail a disparu, les trois autres n'ont pas bougé, la console est " +
    "restée vide. La déployabilité indépendante est réelle — c'est le principal argument en " +
    "faveur du modèle. Mais le tableau continue de publier dans le vide et se croit entendu.",
  ton: "neutre",
};

export const FRAGMENT_REMONTE: Observation = {
  titre: "essai 7 — un fragment en différé démarre aveugle",
  verdict: "Le fragment est revenu vide : le bus ne rejoue rien.",
  detail:
    "Tout ce qui a été publié pendant son absence lui est définitivement perdu. Ce n'est pas " +
    "un défaut d'implémentation, c'est un choix d'architecture — mais un choix qui doit être " +
    "écrit quelque part, sinon chaque équipe le redécouvrira à ses frais.",
  ton: "neutre",
};

export const CONTRAT_FRONT_ROMPU: Observation = {
  titre: "essai 5 — troisième position : l'interface ment, et rien ne le signale",
  verdict: "Le filtre indique « en cours », le tableau annonce neuf sur neuf. Le chiffre est faux.",
  detail:
    "La version 2.0 des filtres publie etat au lieu de statut ; son contrat déclaré, lui, est " +
    "inchangé. Le tableau lit statut, obtient undefined, en conclut qu'aucun filtre n'est " +
    "demandé. Aucune exception, aucun journal anormal. Le couplage n'a pas disparu : il a été " +
    "déplacé du code vers un contrat non typé que personne ne vérifie. " +
    "Vous venez de voir la même faute trois fois : nommée par un intermédiaire, avalée par " +
    "du vrai HTTP sans intermédiaire, et ici invisible. Ce que déplacer la frontière fait " +
    "perdre, ce n'est pas la détection — il n'y en avait pas — c'est la QUALIFICATION.",
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
  titre: "essai 8 — substitution à chaud, contrat respecté",
  verdict: "La substitution tient parce que le contrat est respecté. C'est cela qu'il faut gouverner.",
  detail:
    "Le rendu a changé du tout au tout ; le shell n'a changé qu'un nom de balise et les autres " +
    "fragments n'ont pas été prévenus. C'est le seul essai dont le résultat est positif, et il " +
    "compte autant que les autres. Le coût est visible à l'instant : le fragment neuf est " +
    "arrivé vide et il a fallu redemander les données aux services. Même angle mort qu'à " +
    "l'essai 7, payé à chaque substitution.",
  ton: "nominal",
};

export const TABLEAU_RESTAURE: Observation = {
  titre: "essai 8 — retour à l'implémentation d'origine",
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

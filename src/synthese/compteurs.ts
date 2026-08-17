import { codes5xxRecus } from "../bas/journal-collecte";
import { messagesPerdus, messagesPublies } from "../haut/journal-bus";
import {
  contratsAmontDetectes,
  contratsServeurViolesDetectes,
  mesuresParMode,
  nombreTraversees,
  type MesureMode,
  type Mode,
} from "../frontiere/traversee";
import { requetesBloquees } from "../garde-reseau";

/**
 * Les compteurs de la session en cours.
 *
 * Ce module lit les deux journaux ; aucun des deux ne le connaît. La dépendance est
 * inversée exprès : le journal du bus et le journal collecté ne doivent pas partager
 * de module commun, sans quoi leur séparation ne serait plus qu'une convention.
 */

/**
 * Violations du contrat front effectivement DÉTECTÉES par le système.
 *
 * Ce compteur ne bouge jamais, et c'est le résultat le plus important du tableau.
 * Rien dans la moitié haute — ni le bus, ni le shell, ni le compilateur, ni un
 * journal — n'est en position de constater qu'une charge utile a changé de forme.
 * Un compteur qui refuse de compter dit la chose plus clairement qu'un paragraphe.
 *
 * Il a gagné un voisin qui, lui, bouge : `contratsAmontDetectes`. C'est la MÊME
 * faute — un champ renommé, contrat déclaré inchangé — jouée sous la frontière par
 * l'essai 4. La comparaison des deux chiffres, sur la même session, est le résultat
 * chiffré de l'étude.
 *
 * Et il faut lire le voisin correctement : il ne bouge pas parce que « c'est du
 * réseau ». Rejouez l'essai 4 en appels directs et il restera à zéro lui aussi. Il
 * bouge parce qu'un INTERMÉDIAIRE lit une forme attendue que quelqu'un a écrite.
 */
export const CONTRATS_FRONT_DETECTES = 0;

let contratsFrontDeclenches = 0;

/** Incrémenté par l'opérateur de la démonstration, pas par une détection. */
export function declarerContratFrontRompu(): void {
  contratsFrontDeclenches += 1;
}

export interface Compteurs {
  readonly messagesPublies: number;
  readonly messagesPerdus: number;
  readonly traversees: number;
  readonly codes5xx: number;
  readonly contratsServeurDetectes: number;
  readonly contratsAmontDetectes: number;
  readonly contratsFrontDetectes: number;
  readonly contratsFrontDeclenches: number;
  readonly sortiesBloquees: number;
  readonly parMode: Readonly<Record<Mode, MesureMode>>;
}

export function compteurs(): Compteurs {
  return {
    messagesPublies: messagesPublies(),
    messagesPerdus: messagesPerdus(),
    traversees: nombreTraversees(),
    codes5xx: codes5xxRecus(),
    contratsServeurDetectes: contratsServeurViolesDetectes(),
    contratsAmontDetectes: contratsAmontDetectes(),
    contratsFrontDetectes: CONTRATS_FRONT_DETECTES,
    contratsFrontDeclenches: contratsFrontDeclenches,
    sortiesBloquees: requetesBloquees().length,
    parMode: mesuresParMode(),
  };
}

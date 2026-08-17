import type { Shell } from "./shell";

/**
 * Les quatre essais qui se jouent au-dessus de la frontière.
 *
 * Ils n'ont aucune idée de l'existence des services : ce sont des montages, des
 * démontages et des substitutions d'éléments personnalisés, rien d'autre.
 *
 * Tous passent par le shell, qui ne connaît des fragments que leurs noms de balise.
 * Aucun de ces essais n'accède au Shadow DOM d'un fragment ni n'appelle une méthode
 * qu'un fragment aurait exposée.
 */

export const BALISE_FILTRES_NOMINALE = "mf-filtres";
export const BALISE_FILTRES_ROMPUE = "mf-filtres-v2";
export const BALISE_TABLEAU_V1 = "mf-tableau";
export const BALISE_TABLEAU_V2 = "mf-tableau-v2";

/* ------------------------------------------- essais 6 et 7 : mf-detail */

export function demonterDetail(shell: Shell): void {
  shell.demonter("detail");
}

export function remonterDetail(shell: Shell): void {
  shell.monter("detail");
}

export function detailEstMonte(shell: Shell): boolean {
  return shell.estMonte("detail");
}

/* ------------------------------------- essai 5 : casser le contrat front */

export function contratFrontRompu(shell: Shell): boolean {
  return shell.nomBaliseDe("filtres") === BALISE_FILTRES_ROMPUE;
}

/**
 * Substitue au fragment de filtres une version qui publie `etat` au lieu de `statut`.
 *
 * Le shell fait exactement le même geste qu'à l'essai 8 : il change un nom de balise.
 * Il n'a aucun moyen de savoir que celui-ci rompt le contrat et l'autre non — la
 * forme des charges utiles n'est écrite nulle part qu'il puisse consulter.
 */
export function basculerContratFront(shell: Shell): boolean {
  const rompu = contratFrontRompu(shell);
  shell.remplacer("filtres", rompu ? BALISE_FILTRES_NOMINALE : BALISE_FILTRES_ROMPUE);
  return !rompu;
}

/* ------------------------------- essai 8 : remplacer l'implémentation du tableau */

export function tableauEnV2(shell: Shell): boolean {
  return shell.nomBaliseDe("tableau") === BALISE_TABLEAU_V2;
}

export function basculerImplementationTableau(shell: Shell): boolean {
  const enV2 = tableauEnV2(shell);
  shell.remplacer("tableau", enV2 ? BALISE_TABLEAU_V1 : BALISE_TABLEAU_V2);
  return !enV2;
}

#!/usr/bin/env node
/**
 * Verificateur d'affordance.
 *
 * La these de ce depot est qu'une chose peut ressembler a ce qu'elle n'est pas et que
 * personne ne le signale. Le dispositif s'etait pris a son propre piege : les jetons de
 * contrat portaient `border: 1px solid currentColor` et l'accent `--nominal`, soit
 * exactement la bordure et l'accent des boutons de filtre situes dans la meme colonne.
 * On essayait de cliquer dessus. En sens inverse, le `summary` de la synthese etait
 * cliquable sans bordure ni fond : un controle invisible.
 *
 * Ni le typecheck ni la recette ne pouvaient le voir. Ce script fait des deux regles
 * une assertion opposable.
 *
 *   Regle 1 — UNE BOITE BORDEE EST UN CONTROLE, ET RIEN D'AUTRE NE L'EST.
 *             Aucun element en ligne ne porte de bordure s'il n'est pas cliquable.
 *
 *   Regle 2 — CE QUI AGIT DOIT SE VOIR.
 *             Aucun `cursor: pointer` sans bordure, ni fond, ni soulignement.
 *
 * La regle 2 ne demande aucune liste blanche : elle se verifie toute seule, et c'est
 * elle qui rattrapera le prochain controle invisible.
 *
 * Usage : node outils/verifier-affordance.mjs
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REEL = join(RACINE, "reel", "interface");
const DEMO = join(RACINE, "demo", "frontend");

/**
 * Les seuls elements en ligne autorises a porter une bordure : ce sont des controles.
 * Ajouter une entree ici est une DECISION, pas une formalite — elle affirme que la
 * chose se clique.
 */
const CONTROLES_EN_LIGNE = [
  ".bouton",
  ".essai",
  ".bouton-synthese",
  ".bouton-reessai",
  ".frontiere-mode",
  "button",
];

async function fichiers(repertoire, suffixes) {
  const trouves = [];
  for (const entree of await readdir(repertoire, { withFileTypes: true })) {
    const chemin = join(repertoire, entree.name);
    if (entree.isDirectory()) trouves.push(...(await fichiers(chemin, suffixes)));
    else if (suffixes.some((s) => entree.name.endsWith(s))) trouves.push(chemin);
  }
  return trouves;
}

/**
 * Rassemble le CSS du depot : les feuilles de `demo/frontend/styles`, ET les gabarits
 * `STYLE` des fragments — reels (`reel/interface/haut/fragments`) et de demonstration
 * (`demo/frontend/haut/fragments`, les variantes v2) — qui vivent dans le Shadow DOM et
 * qu'aucun outil ne regarde.
 */
async function sourcesCss() {
  const sources = [];

  for (const chemin of await fichiers(join(DEMO, "styles"), [".css"])) {
    sources.push({ nom: relative(RACINE, chemin), css: await readFile(chemin, "utf8") });
  }

  for (const racineFragments of [join(REEL, "haut", "fragments"), join(DEMO, "haut", "fragments")]) {
    for (const chemin of await fichiers(racineFragments, [".ts"])) {
      const source = await readFile(chemin, "utf8");
      const gabarit = source.match(/const STYLE = `([\s\S]*?)`;/);
      if (gabarit) sources.push({ nom: `${relative(RACINE, chemin)} (Shadow DOM)`, css: gabarit[1] });
    }
  }

  return sources;
}

/** Decoupe grossiere en regles. Suffisant : on n'ecrit pas de CSS imbrique ici. */
function regles(css) {
  const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const trouvees = [];
  for (const bloc of sansCommentaires.split("}")) {
    const coupure = bloc.indexOf("{");
    if (coupure === -1) continue;
    const selecteur = bloc.slice(0, coupure).trim().replace(/\s+/g, " ");
    const declarations = bloc.slice(coupure + 1).trim();
    if (selecteur && !selecteur.startsWith("@")) trouvees.push({ selecteur, declarations });
  }
  return trouvees;
}

const aBordure = (d) =>
  /border(-(top|right|bottom|left))?\s*:\s*(?!none|0)[^;]*\d/.test(d) ||
  /border-(width|style)\s*:\s*(?!none|0)/.test(d);
const aFond = (d) => /background(-color)?\s*:\s*(?!none|transparent)[^;]+/.test(d);
const aSoulignement = (d) => /text-decoration[^:]*:\s*[^;]*underline/.test(d);
const estEnLigne = (d) => /display\s*:\s*inline-(block|flex)/.test(d);
const aCurseurMain = (d) => /cursor\s*:\s*pointer/.test(d);

const estControle = (selecteur) =>
  CONTROLES_EN_LIGNE.some((c) => selecteur.includes(c)) ||
  /:hover|:focus|:active|\[aria-pressed/.test(selecteur);

const manquements = [];

for (const { nom, css } of await sourcesCss()) {
  for (const { selecteur, declarations } of regles(css)) {
    // Regle 1
    if (estEnLigne(declarations) && aBordure(declarations) && !estControle(selecteur)) {
      manquements.push(
        `${nom}\n      ${selecteur}\n      porte une bordure en ligne sans etre un controle.\n` +
          `      Une boite bordee se clique. Si celle-ci ne se clique pas, retirez la bordure ;\n` +
          `      si elle se clique, declarez-la dans CONTROLES_EN_LIGNE.`,
      );
    }

    // Regle 2
    if (
      aCurseurMain(declarations) &&
      !aBordure(declarations) &&
      !aFond(declarations) &&
      !aSoulignement(declarations)
    ) {
      manquements.push(
        `${nom}\n      ${selecteur}\n      declare « cursor: pointer » sans bordure, ni fond, ni soulignement.\n` +
          `      Un controle invisible n'est pas un controle : il faut le voir a l'arret,\n` +
          `      pas seulement au survol, et pas seulement de pres.`,
      );
    }
  }
}

if (manquements.length > 0) {
  console.error(`\nAFFORDANCE VIOLEE — ${manquements.length} manquement(s)\n`);
  for (const manquement of manquements) console.error(`  - ${manquement}\n`);
  process.exit(1);
}

console.log("\nAffordance respectee.");
console.log("Aucune boite bordee qui ne se clique pas, aucun controle invisible.\n");

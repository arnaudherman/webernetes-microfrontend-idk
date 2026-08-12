#!/usr/bin/env node
/**
 * Empreintes SHA-256 des artefacts publiés.
 *
 * C'est l'instrument de la preuve centrale : on relève les empreintes, on recompile
 * UN SEUL dépôt, on relève à nouveau. Une empreinte change, les autres sont
 * identiques au bit près, et aucun serveur n'a été redémarré.
 *
 *   node empreintes.mjs
 */

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = dirname(fileURLToPath(import.meta.url));

/**
 * On relève les empreintes des artefacts EN SORTIE DE COMPILATION (`dist`), parce que
 * c'est là que la preuve centrale se joue : recompiler un seul dépôt ne doit changer
 * qu'une seule empreinte. Les artefacts publiés, eux, sont immuables par construction —
 * leur empreinte figure dans le manifeste et dans la carte d'import.
 */
const ARTEFACTS = [
  { equipe: "équipe tableau", chemin: "equipe-tableau/dist/mf-tableau.js" },
  { equipe: "équipe filtres", chemin: "equipe-filtres/dist/mf-filtres.js" },
  { equipe: "équipe socle (v3)", chemin: "socle/v3/bus.js" },
  { equipe: "équipe socle (v4)", chemin: "socle/v4/bus.js" },
  { equipe: "dépôt concurrent", chemin: "depot-concurrent/dist/mf-tableau.js" },
];

const horodatage = new Date().toISOString().replace("T", " ").slice(0, 19);
console.log(`\nEmpreintes SHA-256 des artefacts publiés — ${horodatage}\n`);

let manquants = 0;

for (const artefact of ARTEFACTS) {
  const fichier = resolve(RACINE, artefact.chemin);
  try {
    const info = await stat(fichier);
    const contenu = await readFile(fichier);
    const empreinte = createHash("sha256").update(contenu).digest("hex");
    console.log(
      `  ${artefact.equipe.padEnd(20)} ${empreinte.slice(0, 32)}…  ` +
        `${String(info.size).padStart(6)} o   ${artefact.chemin}`,
    );
  } catch {
    manquants += 1;
    console.log(`  ${artefact.equipe.padEnd(20)} ${"—".padEnd(32)}    absent   ${artefact.chemin}`);
  }
}

if (manquants > 0) {
  console.log(`\n  ${manquants} artefact(s) absent(s) : lancer d'abord « node construire.mjs ».`);
}
console.log("");

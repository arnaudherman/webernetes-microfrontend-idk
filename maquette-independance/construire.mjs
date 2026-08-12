#!/usr/bin/env node
/**
 * Construit les artefacts. Chaque dépôt a sa propre chaîne, et ne connaît pas les autres.
 *
 *   node construire.mjs                  construit les trois dépôts
 *   node construire.mjs equipe-tableau   n'en construit qu'un — c'est la preuve centrale
 */

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = dirname(fileURLToPath(import.meta.url));
const DEPOTS = ["equipe-tableau", "equipe-filtres", "depot-concurrent"];

const demandes = process.argv.slice(2);
const aConstruire = demandes.length > 0 ? demandes : DEPOTS;

for (const depot of aConstruire) {
  if (!DEPOTS.includes(depot)) {
    console.error(`\nDépôt inconnu : ${depot}\nDépôts disponibles : ${DEPOTS.join(", ")}\n`);
    process.exit(1);
  }
}

for (const depot of aConstruire) {
  const debut = process.hrtime.bigint();
  console.log(`\n── ${depot} ──`);
  const resultat = spawnSync("npx", ["vite", "build"], {
    cwd: resolve(RACINE, depot),
    stdio: "inherit",
    shell: false,
  });
  const duree = Number(process.hrtime.bigint() - debut) / 1e6;
  if (resultat.status !== 0) {
    console.error(`\nÉchec de construction de ${depot}.\n`);
    process.exit(resultat.status ?? 1);
  }
  console.log(`   ${depot} construit en ${Math.round(duree)} ms`);
}

console.log(
  `\n${aConstruire.length} dépôt(s) construit(s) sur ${DEPOTS.length}. ` +
    `Les autres artefacts n'ont pas été touchés.\n`,
);

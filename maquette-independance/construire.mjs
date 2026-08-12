#!/usr/bin/env node
/**
 * Construit les artefacts. Chaque dépôt a sa propre chaîne, et ne connaît pas les autres.
 *
 *   node construire.mjs                  construit les trois dépôts
 *   node construire.mjs equipe-tableau   n'en construit qu'un — c'est la preuve centrale
 */

import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = dirname(fileURLToPath(import.meta.url));
// L'équipe calcul compile d'abord son Rust en wasm, puis bundle son fragment.
const DEPOTS = ["equipe-tableau", "equipe-filtres", "depot-concurrent", "equipe-calcul"];
const PREALABLES = {
  "equipe-calcul": ["wasm-pack", ["build", "--target", "web", "--release", "--out-dir", "pkg"]],
};

/**
 * rustup installe cargo dans ~/.cargo/bin et l'ajoute au PATH par le fichier de
 * démarrage du shell. Un sous-processus lancé sans shell n'en hérite pas : wasm-pack
 * échouerait alors sur un « cargo introuvable » parfaitement opaque.
 */
const ENVIRONNEMENT = {
  ...process.env,
  PATH: [join(homedir(), ".cargo", "bin"), process.env.PATH].filter(Boolean).join(delimiter),
};

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
  const prealable = PREALABLES[depot];
  if (prealable) {
    const [programme, arguments_] = prealable;
    const avant = spawnSync("npx", [programme, ...arguments_], {
      cwd: resolve(RACINE, depot),
      stdio: "inherit",
      shell: false,
      env: ENVIRONNEMENT,
    });
    if (avant.status !== 0) {
      console.error(
        `\n  ${depot} : la compilation Rust a échoué.\n` +
          `  Rust est-il installé ?  rustup target add wasm32-unknown-unknown\n` +
          `  Les artefacts DÉJÀ PUBLIÉS restent utilisables sans Rust : « node servir.mjs » fonctionne.\n`,
      );
      process.exit(avant.status ?? 1);
    }
  }

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

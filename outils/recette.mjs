#!/usr/bin/env node
/**
 * Recette — une commande qui vérifie que tout marche.
 *
 *   npm run recette
 *
 * Vérifie la démonstration principale et la maquette d'indépendance. Sort en code 1
 * au premier échec, avec la sortie de la commande fautive.
 *
 * À lancer avant toute présentation, et après toute modification.
 */

import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAQUETTE = join(RACINE, "maquette-independance");

let echecs = 0;
const debutTotal = process.hrtime.bigint();

function titre(texte) {
  console.log(`\n${texte}`);
}

function etape(intitule, execution) {
  const debut = process.hrtime.bigint();
  let resultat;
  try {
    resultat = execution();
  } catch (erreur) {
    resultat = { ok: false, detail: erreur.message };
  }
  const duree = Math.round(Number(process.hrtime.bigint() - debut) / 1e6);
  const marque = resultat.ok ? "  OK  " : "ÉCHEC ";
  console.log(`  ${marque} ${intitule.padEnd(46)} ${String(duree).padStart(6)} ms`);
  if (!resultat.ok) {
    echecs += 1;
    if (resultat.detail) {
      console.log(
        String(resultat.detail)
          .trim()
          .split("\n")
          .slice(-12)
          .map((ligne) => `         │ ${ligne}`)
          .join("\n"),
      );
    }
  }
  return resultat;
}

function commande(programme, arguments_, repertoire = RACINE) {
  const sortie = spawnSync(programme, arguments_, {
    cwd: repertoire,
    encoding: "utf8",
    shell: false,
  });
  return {
    ok: sortie.status === 0,
    detail: `${sortie.stdout ?? ""}${sortie.stderr ?? ""}`,
    sortie: sortie.stdout ?? "",
  };
}

function fichierNonVide(chemin, tailleMinimale = 1) {
  const complet = join(RACINE, chemin);
  if (!existsSync(complet)) return { ok: false, detail: `absent : ${chemin}` };
  const taille = statSync(complet).size;
  if (taille < tailleMinimale) {
    return { ok: false, detail: `${chemin} ne fait que ${taille} octets` };
  }
  return { ok: true, taille };
}

function contient(chemin, aiguille, intitule) {
  const resultat = commande("grep", ["-q", aiguille, join(RACINE, chemin)]);
  return resultat.ok ? { ok: true } : { ok: false, detail: `${intitule} introuvable dans ${chemin}` };
}

/* ------------------------------------------------------ démonstration principale */

titre("Démonstration principale");

etape("dépendances installées", () =>
  existsSync(join(RACINE, "node_modules", "vite"))
    ? { ok: true }
    : { ok: false, detail: "node_modules absent — lancer « npm install »" },
);

etape("typecheck", () => commande("npx", ["tsc", "--noEmit"]));

etape("invariant de frontière", () => {
  const resultat = commande("node", ["outils/verifier-frontiere.mjs"]);
  return resultat.ok && resultat.sortie.includes("Frontiere respectee")
    ? { ok: true }
    : { ok: false, detail: resultat.detail };
});

etape("build de production", () => commande("npx", ["vite", "build", "--logLevel", "warn"]));

etape("artefact produit", () => {
  const resultat = commande("node", [
    "-e",
    "const {readdirSync,statSync}=require('node:fs');" +
      "const d='dist/assets';const f=readdirSync(d).filter(n=>n.endsWith('.js'));" +
      "if(f.length!==1)throw new Error('attendu 1 fichier .js, trouvé '+f.length);" +
      "const t=statSync(d+'/'+f[0]).size;if(t<400000)throw new Error('artefact suspect: '+t);" +
      "console.log(t)",
  ]);
  if (!resultat.ok) return resultat;
  console.log(`         │ un seul artefact JavaScript, ${resultat.sortie.trim()} octets`);
  return { ok: true };
});

/* ------------------------------------------------------------------- documents */

titre("Documents");

etape("README — déroulé minuté (critère 8)", () =>
  contient("README.md", "^| 0:00 ", "ligne 0:00 du tableau minuté"),
);
etape("README — renvoi vers la maquette", () =>
  contient("README.md", "maquette-independance", "lien vers la maquette"),
);
etape("DEROULE.md présent", () => fichierNonVide("DEROULE.md", 4000));
etape("README de la maquette présent", () =>
  fichierNonVide("maquette-independance/README.md", 3000),
);

/* -------------------------------------------------------- maquette d'indépendance */

titre("Maquette d'indépendance");

etape("construction des trois dépôts", () => commande("node", ["construire.mjs"], MAQUETTE));

for (const artefact of [
  "maquette-independance/equipe-tableau/dist/mf-tableau.js",
  "maquette-independance/equipe-filtres/dist/mf-filtres.js",
  "maquette-independance/depot-concurrent/dist/mf-tableau.js",
  "maquette-independance/socle/v1/bus.js",
  "maquette-independance/socle/v2/bus.js",
]) {
  etape(`artefact ${artefact.split("/").slice(1, 2)[0]}/…`, () => fichierNonVide(artefact, 100));
}

etape("le spécificateur nu survit à la compilation", () => {
  for (const fichier of [
    "maquette-independance/equipe-tableau/dist/mf-tableau.js",
    "maquette-independance/equipe-filtres/dist/mf-filtres.js",
  ]) {
    const resultat = commande("grep", ["-q", '"@socle/bus"', join(RACINE, fichier)]);
    if (!resultat.ok) {
      return { ok: false, detail: `@socle/bus a été résolu à la compilation dans ${fichier}` };
    }
  }
  return { ok: true };
});

etape("aucun artefact n'embarque de copie du socle", () => {
  for (const fichier of [
    "maquette-independance/equipe-tableau/dist/mf-tableau.js",
    "maquette-independance/equipe-filtres/dist/mf-filtres.js",
  ]) {
    const resultat = commande("grep", ["-q", "__instancesSocle", join(RACINE, fichier)]);
    if (resultat.ok) return { ok: false, detail: `le socle est recopié dans ${fichier}` };
  }
  return { ok: true };
});

/* ------------------------------------------------------------------- conclusion */

const total = Math.round(Number(process.hrtime.bigint() - debutTotal) / 1e6);

if (echecs === 0) {
  console.log(`\nRecette complète en ${total} ms. Tout marche.\n`);
  console.log("  npm run dev                                    → http://localhost:5173/");
  console.log("  cd maquette-independance && node servir.mjs     → http://localhost:5100/\n");
  process.exit(0);
}

console.log(`\n${echecs} vérification(s) en échec sur la recette (${total} ms).\n`);
process.exit(1);

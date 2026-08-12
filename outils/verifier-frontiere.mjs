#!/usr/bin/env node
/**
 * Verificateur d'invariant d'architecture.
 *
 * La these de la demonstration est que les deux moities du depot ne se parlent pas.
 * Ce script en fait une assertion opposable plutot qu'un commentaire.
 *
 *   Invariant 1 — aucun module de src/haut n'importe src/bas, et reciproquement.
 *   Invariant 2 — aucun fragment n'importe le code d'un autre fragment.
 *   Invariant 3 — seuls les modules d'orchestration declares ci-dessous voient les
 *                 deux moities, et uniquement pour cabler ou declencher.
 *
 * Usage : npm run verifier-frontiere
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, dirname, posix } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(RACINE, "src");

/** Modules autorises a connaitre les deux moities. */
const ORCHESTRATION = new Set([
  "main.ts",
  "frontiere/passerelle.ts",
  "essais/barre-essais.ts",
  "synthese/compteurs.ts",
  "synthese/panneau.ts",
]);

async function fichiersTypeScript(repertoire) {
  const trouves = [];
  for (const entree of await readdir(repertoire, { withFileTypes: true })) {
    const chemin = join(repertoire, entree.name);
    if (entree.isDirectory()) trouves.push(...(await fichiersTypeScript(chemin)));
    else if (entree.name.endsWith(".ts")) trouves.push(chemin);
  }
  return trouves;
}

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g;

function specificateurs(source) {
  const trouves = [];
  for (const correspondance of source.matchAll(SPECIFIER)) trouves.push(correspondance[1]);
  return trouves;
}

/** "haut" | "bas" | "frontiere" | "essais" | "synthese" | "styles" | "racine" */
function zone(cheminRelatif) {
  const segment = cheminRelatif.split("/")[0];
  return cheminRelatif.includes("/") ? segment : "racine";
}

function resoudre(fichierRelatif, specificateur) {
  if (!specificateur.startsWith(".")) return undefined;
  const resolu = posix.normalize(posix.join(posix.dirname(fichierRelatif), specificateur));
  return resolu.endsWith(".ts") ? resolu : `${resolu}.ts`;
}

const violations = [];
const passerelles = [];

const fichiers = await fichiersTypeScript(SRC);

for (const absolu of fichiers) {
  const fichier = relative(SRC, absolu).split("\\").join("/");
  const source = await readFile(absolu, "utf8");
  const zoneSource = zone(fichier);

  const zonesVues = new Set();

  for (const specificateur of specificateurs(source)) {
    const cible = resoudre(fichier, specificateur);
    if (!cible) continue;
    const zoneCible = zone(cible);
    zonesVues.add(zoneCible);

    if (zoneSource === "haut" && zoneCible === "bas") {
      violations.push(`${fichier} importe ${cible} : la moitie haute ne doit pas connaitre le cluster.`);
    }
    if (zoneSource === "bas" && zoneCible === "haut") {
      violations.push(`${fichier} importe ${cible} : la moitie basse ne doit pas connaitre l'interface.`);
    }
    if (fichier.startsWith("haut/fragments/") && cible.startsWith("haut/fragments/")) {
      violations.push(`${fichier} importe ${cible} : un fragment ne doit pas importer un autre fragment.`);
    }
  }

  if (zonesVues.has("haut") && zonesVues.has("bas")) {
    passerelles.push(fichier);
    if (!ORCHESTRATION.has(fichier)) {
      violations.push(
        `${fichier} voit les deux moities sans etre declare module d'orchestration.`,
      );
    }
  }
}

const total = fichiers.length;

if (violations.length > 0) {
  console.error(`\nFRONTIERE VIOLEE — ${violations.length} manquement(s) sur ${total} modules\n`);
  for (const violation of violations) console.error(`  - ${violation}`);
  console.error("");
  process.exit(1);
}

console.log(`\nFrontiere respectee — ${total} modules verifies.`);
console.log(`Modules voyant les deux moities : ${passerelles.length === 0 ? "aucun" : passerelles.join(", ")}`);
console.log("Aucun module de src/haut ne connait src/bas, et reciproquement.\n");

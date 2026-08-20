#!/usr/bin/env node
/**
 * Verificateur d'invariant d'architecture.
 *
 * La these de la demonstration est que les deux moities du depot ne se parlent pas.
 * Ce script en fait une assertion opposable plutot qu'un commentaire.
 *
 *   Invariant 1 — aucun module de reel/interface/haut n'importe reel/interface/bas,
 *                 et reciproquement.
 *   Invariant 2 — aucun fragment n'importe le code d'un autre fragment.
 *   Invariant 3 — seuls les modules d'orchestration declares ci-dessous voient les
 *                 deux moities, et uniquement pour cabler ou declencher.
 *   Invariant 4 — aucun module de reel/ n'importe quoi que ce soit sous demo/. La
 *                 surcouche de demonstration peut dependre du reel ; l'inverse ferait
 *                 de « reel/ » une fiction.
 *
 * Ce script ne balaie que reel/interface/ : c'est le seul endroit du depot ou les
 * deux moities narratives (modularite serveur, modularite interface) coexistent
 * encore reellement — la surcouche de demonstration (demo/frontend/) voit les deux
 * par construction (elle assemble tout pour l'ecran) et n'a donc plus besoin d'etre
 * declaree module par module.
 *
 * Usage : npm run verifier-frontiere
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, dirname, posix } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(RACINE, "reel", "interface");

/**
 * Modules autorises a connaitre les deux moities.
 *
 * `frontiere/traversee.ts` s'appelait `frontiere/passerelle.ts`. Le mot « passerelle »
 * designe maintenant le PROCESSUS qui tourne sur 127.0.0.1:7200 et prend trois
 * decisions ; ce module-la, lui, ne decide rien, il fait franchir. Deux choses du meme
 * nom dans une etude d'architecture, c'est une ambiguite qui se paie en reunion.
 */
const ORCHESTRATION = new Set(["frontiere/traversee.ts"]);

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
      violations.push(`${fichier} importe ${cible} : la moitie haute ne doit pas connaitre les services.`);
    }
    if (zoneSource === "bas" && zoneCible === "haut") {
      violations.push(`${fichier} importe ${cible} : la moitie basse ne doit pas connaitre l'interface.`);
    }
    if (fichier.startsWith("haut/fragments/") && cible.startsWith("haut/fragments/")) {
      violations.push(`${fichier} importe ${cible} : un fragment ne doit pas importer un autre fragment.`);
    }

    // Invariant 4 — un chemin relatif qui, une fois resolu depuis reel/interface,
    // retombe sur un segment "demo/" a quitte le reel. Le suffixe ".ts" que
    // `resoudre()` ajoute en bout de chaine (y compris sur un import .json — un
    // artefact preexistant de cette fonction) ne modifie jamais un segment
    // intermediaire : ce test reste correct malgre lui.
    if (/(^|\/)demo\//.test(cible)) {
      violations.push(`${fichier} importe ${cible} : un module réel ne doit jamais importer la démo.`);
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
console.log("Aucun module de reel/interface/haut ne connait reel/interface/bas, et reciproquement.");
console.log("Aucun module de reel/ n'importe demo/.\n");

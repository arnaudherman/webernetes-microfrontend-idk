#!/usr/bin/env node
/**
 * Publication — ce qui sépare la recompilation séparée du déploiement indépendant.
 *
 * Trois propriétés, et elles sont indissociables :
 *
 *   1. IMMUABILITÉ. Un artefact est publié sous `publie/<version>/`, et une version
 *      déjà publiée ne peut PAS être réécrite. C'est ce qui rend le retour arrière
 *      possible : l'ancienne version est toujours là.
 *
 *   2. VERSIONNAGE EXPLICITE. Le manifeste ne porte pas une URL, il porte un couple
 *      version + URL. Changer de version est une modification du manifeste, pas une
 *      recompilation.
 *
 *   3. INTÉGRITÉ. Chaque artefact publié porte une empreinte SHA-384, reportée dans
 *      la clé `integrity` de la carte d'import — un standard du web. Un artefact
 *      modifié après publication est refusé par le navigateur. C'est ce qui rend
 *      l'immuabilité opposable au lieu d'être une promesse.
 *
 *   node publier.mjs                 publie les versions déclarées dans les package.json
 *   node publier.mjs --forcer        republie une version existante (à éviter, voir plus haut)
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = dirname(fileURLToPath(import.meta.url));
const FORCER = process.argv.includes("--forcer");

const DEPOTS = [
  { nom: "equipe-tableau", balise: "mf-tableau", fichier: "mf-tableau.js", port: 5101 },
  { nom: "equipe-filtres", balise: "mf-filtres", fichier: "mf-filtres.js", port: 5102 },
  { nom: "depot-concurrent", balise: null, fichier: "mf-tableau.js", port: 5104 },
  // L'équipe calcul publie trois fichiers : son fragment, la glu wasm-bindgen et le
  // binaire wasm. Les trois sont versionnés ensemble — un binaire sans sa glu, ou
  // l'inverse, serait une combinaison qui n'a jamais existé.
  { nom: "equipe-calcul", balise: "mf-calcul", fichier: "mf-calcul.js", port: 5106,
    annexes: ["pkg/calcul.js", "pkg/calcul_bg.wasm"] },
];

const SOCLE = { version: "3.0", chemin: "socle/v3/bus.js", url: "http://localhost:5103/v3/bus.js" };

/** Empreinte au format attendu par la clé `integrity` d'une carte d'import. */
function empreinte(contenu) {
  return `sha384-${createHash("sha384").update(contenu).digest("base64")}`;
}

const publies = [];
let refus = 0;

for (const depot of DEPOTS) {
  const manifesteDepot = JSON.parse(
    await readFile(join(RACINE, depot.nom, "package.json"), "utf8"),
  );
  const version = manifesteDepot.version;
  const source = join(RACINE, depot.nom, "dist", depot.fichier);

  if (!existsSync(source)) {
    console.error(`\n  ${depot.nom} : aucun artefact construit. Lancer « node construire.mjs ».\n`);
    process.exit(1);
  }

  const contenu = await readFile(source);
  const repertoire = join(RACINE, depot.nom, "publie", version);
  const destination = join(repertoire, depot.fichier);

  if (existsSync(destination)) {
    const dejaPublie = await readFile(destination);
    if (dejaPublie.equals(contenu)) {
      console.log(`  ${depot.nom.padEnd(18)} ${version.padEnd(8)} déjà publié, identique`);
      publies.push({ ...depot, version, integrity: empreinte(contenu) });
      continue;
    }
    if (!FORCER) {
      console.error(
        `\n  REFUS — ${depot.nom} ${version} est déjà publié avec un contenu différent.\n` +
          `  Une version publiée ne se réécrit pas : c'est ce qui rend le retour arrière possible.\n` +
          `  Incrémentez la version dans ${depot.nom}/package.json, puis republiez.\n`,
      );
      refus += 1;
      continue;
    }
    console.log(`  ${depot.nom.padEnd(18)} ${version.padEnd(8)} RÉÉCRITE (--forcer)`);
  }

  await mkdir(repertoire, { recursive: true });
  await writeFile(destination, contenu);

  for (const annexe of depot.annexes ?? []) {
    const nomAnnexe = annexe.split("/").pop();
    await writeFile(join(repertoire, nomAnnexe), await readFile(join(RACINE, depot.nom, annexe)));
  }
  publies.push({ ...depot, version, integrity: empreinte(contenu) });
  console.log(`  ${depot.nom.padEnd(18)} ${version.padEnd(8)} publié → publie/${version}/${depot.fichier}`);
}

if (refus > 0) {
  console.error(`\n${refus} publication(s) refusée(s). Le manifeste n'a pas été modifié.\n`);
  process.exit(1);
}

/* ------------------------------------------------------------------ manifeste */

const contenuSocle = await readFile(join(RACINE, SOCLE.chemin));
const integriteSocle = empreinte(contenuSocle);

/**
 * PUBLIER N'EST PAS DÉPLOYER.
 *
 * Publier rend une version disponible sous une URL immuable. Déployer, c'est décider
 * qu'elle est celle que les utilisateurs reçoivent — et c'est une modification du
 * manifeste, faite séparément, par `basculer.mjs`.
 *
 * Confondre les deux, c'est perdre le retour arrière : si publier basculait
 * automatiquement, une version fautive partirait en production à la seconde où elle
 * est construite. On conserve donc la version actuellement servie, tant qu'elle
 * existe toujours.
 */
const ancien = existsSync(join(RACINE, "shell", "manifeste.json"))
  ? JSON.parse(await readFile(join(RACINE, "shell", "manifeste.json"), "utf8"))
  : { fragments: {} };

const fragments = {};
for (const publie of publies) {
  if (!publie.balise) continue;

  const servi = ancien.fragments?.[publie.balise];
  const artefactServi = servi
    ? join(RACINE, publie.nom, "publie", servi.version, publie.fichier)
    : undefined;

  if (servi && artefactServi && existsSync(artefactServi)) {
    fragments[publie.balise] = {
      version: servi.version,
      url: `http://localhost:${publie.port}/${servi.version}/${publie.fichier}`,
      integrity: empreinte(await readFile(artefactServi)),
    };
    if (servi.version !== publie.version) {
      console.log(
        `  ${"".padEnd(18)} ${"".padEnd(8)} ${publie.balise} reste servi en ${servi.version} ` +
          `(« node basculer.mjs ${publie.balise} ${publie.version} » pour déployer)`,
      );
    }
    continue;
  }

  fragments[publie.balise] = {
    version: publie.version,
    url: `http://localhost:${publie.port}/${publie.version}/${publie.fichier}`,
    integrity: publie.integrity,
  };
}

const manifeste = {
  socle: { version: SOCLE.version, url: SOCLE.url, integrity: integriteSocle },
  fragments,
};

await writeFile(
  join(RACINE, "shell", "manifeste.json"),
  `${JSON.stringify(manifeste, null, 2)}\n`,
);

/* --------------------------------------------------------- cartes d'import */

/**
 * La carte d'import est écrite DANS le HTML, pas injectée à l'exécution : une carte
 * ne peut plus rien redéfinir une fois qu'un spécificateur a été résolu, et les cartes
 * multiples ne sont pas portables. La publication régénère donc le bloc entre marqueurs.
 */
async function reecrireCarte(fichier, carte) {
  const chemin = join(RACINE, "shell", fichier);
  const html = await readFile(chemin, "utf8");
  const debut = "<!-- CARTE-DEBUT -->";
  const fin = "<!-- CARTE-FIN -->";
  const i = html.indexOf(debut);
  const j = html.indexOf(fin);
  if (i === -1 || j === -1) {
    console.error(`\n  ${fichier} : marqueurs ${debut} / ${fin} introuvables.\n`);
    process.exit(1);
  }
  const bloc =
    `${debut}\n    <script type="importmap">\n` +
    `${JSON.stringify(carte, null, 2)
      .split("\n")
      .map((ligne) => `      ${ligne}`)
      .join("\n")}\n` +
    `    </script>\n    `;
  await writeFile(chemin, html.slice(0, i) + bloc + html.slice(j));
}

const integrite = { [SOCLE.url]: integriteSocle };
for (const fragment of Object.values(fragments)) integrite[fragment.url] = fragment.integrity;

await reecrireCarte("index.html", {
  imports: { "@socle/bus": SOCLE.url },
  integrity: integrite,
});

const urlSocleV2 = "http://localhost:5103/v2/bus.js";
const integriteV2 = empreinte(await readFile(join(RACINE, "socle/v2/bus.js")));

await reecrireCarte("coexistence.html", {
  imports: { "@socle/bus": SOCLE.url },
  scopes: { "http://localhost:5102/": { "@socle/bus": urlSocleV2 } },
  integrity: { ...integrite, [urlSocleV2]: integriteV2 },
});

/* ------------------------------------------------------------------- rapport */

console.log("\nVersions disponibles sur les serveurs :");
for (const depot of DEPOTS) {
  const base = join(RACINE, depot.nom, "publie");
  if (!existsSync(base)) continue;
  const versions = (await readdir(base)).sort();
  console.log(`  ${depot.nom.padEnd(18)} ${versions.join("  ")}`);
}

console.log("\nManifeste et cartes d'import régénérés.");
console.log("Pour basculer une version sans rien recompiler :");
console.log("  node basculer.mjs mf-tableau <version>\n");

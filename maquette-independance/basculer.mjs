#!/usr/bin/env node
/**
 * Bascule un fragment d'une version publiée à une autre — sans rien recompiler.
 *
 * C'est la démonstration du déploiement indépendant, et son corollaire le plus utile :
 * le retour arrière. Une version publiée étant immuable, revenir en arrière ne demande
 * ni build, ni redéploiement, ni redémarrage — seulement de repointer le manifeste.
 *
 *   node basculer.mjs                        liste les versions disponibles
 *   node basculer.mjs mf-tableau 1.0.0       repointe le manifeste et la carte d'import
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { combinaisonDe, estApprouvee } from "./combinaisons.mjs";

const RACINE = dirname(fileURLToPath(import.meta.url));
const MANIFESTE = join(RACINE, "shell", "manifeste.json");

const DEPOTS = {
  "mf-tableau": { nom: "equipe-tableau", fichier: "mf-tableau.js", port: 5101 },
  "mf-filtres": { nom: "equipe-filtres", fichier: "mf-filtres.js", port: 5102 },
};

async function versionsDisponibles(balise) {
  const base = join(RACINE, DEPOTS[balise].nom, "publie");
  return existsSync(base) ? (await readdir(base)).sort() : [];
}

const [balise, version] = process.argv.slice(2);

if (!balise || !version) {
  console.log("\nVersions publiées :\n");
  const manifeste = JSON.parse(await readFile(MANIFESTE, "utf8"));
  for (const cle of Object.keys(DEPOTS)) {
    const courante = manifeste.fragments[cle]?.version;
    const liste = await versionsDisponibles(cle);
    console.log(
      `  ${cle.padEnd(12)} ${liste.map((v) => (v === courante ? `[${v}]` : ` ${v} `)).join(" ") || "aucune"}`,
    );
  }
  console.log("\n  [x] = version actuellement servie");
  console.log("\n  node basculer.mjs <balise> <version>\n");
  process.exit(0);
}

if (!DEPOTS[balise]) {
  console.error(`\n  Balise inconnue : ${balise}. Connues : ${Object.keys(DEPOTS).join(", ")}\n`);
  process.exit(1);
}

const depot = DEPOTS[balise];
const artefact = join(RACINE, depot.nom, "publie", version, depot.fichier);

if (!existsSync(artefact)) {
  const liste = await versionsDisponibles(balise);
  console.error(
    `\n  ${balise} ${version} n'est pas publié.\n  Versions disponibles : ${liste.join(", ") || "aucune"}\n`,
  );
  process.exit(1);
}

const contenu = await readFile(artefact);
const integrity = `sha384-${createHash("sha384").update(contenu).digest("base64")}`;
const url = `http://localhost:${depot.port}/${version}/${depot.fichier}`;

const manifeste = JSON.parse(await readFile(MANIFESTE, "utf8"));
const avant = manifeste.fragments[balise];
manifeste.fragments[balise] = { version, url, integrity };

/* ------------------------------------------------- la porte de déploiement */

const combinaison = combinaisonDe(manifeste);
const connue = await estApprouvee(combinaison.cle);

if (!connue && !process.argv.includes("--non-approuvee")) {
  console.error(
    `\n  REFUS — cette combinaison n'a jamais été assemblée :\n\n` +
      `    ${combinaison.cle}\n\n` +
      `  Chaque fragment se déploie séparément, donc la combinaison qui s'exécutera chez\n` +
      `  l'utilisateur peut n'avoir jamais existé nulle part. Rien dans le navigateur ne\n` +
      `  le vérifie ; cette porte est du code maison, et c'est ce qu'elle coûte.\n\n` +
      `  Pour l'assembler et l'enregistrer :\n` +
      `    node basculer.mjs ${balise} ${version} --non-approuvee\n` +
      `    (vérifier que tout fonctionne dans le navigateur)\n` +
      `    node approuver.mjs --preuve "…"\n\n` +
      `  Le manifeste n'a pas été modifié.\n`,
  );
  process.exit(1);
}

await writeFile(MANIFESTE, `${JSON.stringify(manifeste, null, 2)}\n`);

// La clé `integrity` de la carte d'import doit suivre, sinon le navigateur refuse
// l'artefact — ce qui est exactement le comportement voulu, mais pas ici.
for (const fichier of ["index.html", "coexistence.html"]) {
  const chemin = join(RACINE, "shell", fichier);
  const html = await readFile(chemin, "utf8");
  const i = html.indexOf("<!-- CARTE-DEBUT -->");
  const j = html.indexOf("<!-- CARTE-FIN -->");
  const bloc = html.slice(i, j);
  const carte = JSON.parse(bloc.slice(bloc.indexOf("{"), bloc.lastIndexOf("}") + 1));

  if (avant?.url) delete carte.integrity[avant.url];
  carte.integrity[url] = integrity;

  const nouveau =
    `<!-- CARTE-DEBUT -->\n    <script type="importmap">\n` +
    `${JSON.stringify(carte, null, 2)
      .split("\n")
      .map((ligne) => `      ${ligne}`)
      .join("\n")}\n` +
    `    </script>\n    `;
  await writeFile(chemin, html.slice(0, i) + nouveau + html.slice(j));
}

console.log(
  `\n  ${balise} : ${avant?.version ?? "—"} → ${version}\n` +
    `  ${url}\n` +
    `  ${integrity}\n\n` +
    `  combinaison : ${combinaison.cle}\n` +
    (connue
      ? `  assemblée le ${connue.enregistree} — « ${connue.preuve} »\n`
      : `  NON APPROUVÉE — déployée sous --non-approuvee\n`) +
    `\n  Aucune recompilation, aucun redémarrage de serveur. Rechargez la page.\n`,
);

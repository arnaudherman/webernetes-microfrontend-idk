#!/usr/bin/env node
/**
 * Enregistre la combinaison actuellement servie comme assemblée.
 *
 *   node approuver.mjs --preuve "assemblage vérifié en local le 12/08"
 *   node approuver.mjs --lister
 *
 * Ce script VÉRIFIE ce qui est vérifiable mécaniquement — présence et intégrité de
 * chaque artefact — puis ENREGISTRE une déclaration humaine. Il ne teste pas que les
 * fragments se comprennent. Voir l'avertissement en tête de combinaisons.mjs.
 */

import {
  approuver,
  combinaisonDe,
  manifesteCourant,
  matrice,
  verifierArtefacts,
} from "./combinaisons.mjs";

const arguments_ = process.argv.slice(2);

if (arguments_.includes("--lister")) {
  const { approuvees } = await matrice();
  console.log(`\n${approuvees.length} combinaison(s) enregistrée(s) :\n`);
  for (const entree of approuvees) {
    console.log(`  ${entree.cle}`);
    console.log(`     ${entree.enregistree}  —  ${entree.preuve}\n`);
  }
  process.exit(0);
}

const indice = arguments_.indexOf("--preuve");
const preuve = indice >= 0 ? arguments_[indice + 1] : undefined;

if (!preuve) {
  console.error(
    "\n  Une preuve est obligatoire. Approuver sans rien constater n'aurait aucun sens.\n" +
      '\n  node approuver.mjs --preuve "assemblage vérifié en local, les deux fragments dialoguent"\n',
  );
  process.exit(1);
}

const manifeste = await manifesteCourant();
const combinaison = combinaisonDe(manifeste);

console.log(`\n  Combinaison : ${combinaison.cle}\n`);

const problemes = await verifierArtefacts(manifeste);
if (problemes.length > 0) {
  console.error("  Vérifications mécaniques en échec :\n");
  for (const probleme of problemes) console.error(`    - ${probleme}`);
  console.error("\n  Rien n'a été enregistré.\n");
  process.exit(1);
}

console.log("  Vérifications mécaniques : artefacts présents et conformes à leur empreinte.");
await approuver(combinaison, preuve);

console.log(`  Enregistrée avec la preuve : « ${preuve} »`);
console.log("\n  Rappel : cet enregistrement est une déclaration, pas un test.\n");

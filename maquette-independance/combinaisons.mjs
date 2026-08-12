/**
 * La matrice des combinaisons assemblées.
 *
 * En artefact unique, il n'existe à tout instant qu'UNE combinaison de fragments, et
 * c'est exactement celle qui est livrée. En déploiement indépendant, il en existe
 * N × M — et celle qui s'exécute chez l'utilisateur n'a peut-être jamais été assemblée
 * nulle part : ni sur un poste de développement, ni en intégration.
 *
 * Aucun mécanisme du navigateur ne vérifie, à l'exécution, que la combinaison chargée
 * est une combinaison approuvée. Ce fichier est donc du CODE MAISON, et il transpose au
 * front une pratique éprouvée côté serveur : une porte de déploiement qui refuse une
 * combinaison dont personne n'a jamais constaté qu'elle fonctionne.
 *
 * CE QUE CETTE PORTE FAIT : elle empêche de déployer une combinaison inconnue par
 * inadvertance, et elle rend la combinatoire visible.
 *
 * CE QU'ELLE NE FAIT PAS : elle ne teste rien. Elle enregistre une DÉCLARATION —
 * exactement comme les portes de déploiement côté serveur, qui enregistrent le résultat
 * d'une vérification faite ailleurs. Une combinaison approuvée à la légère est une
 * combinaison approuvée.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = dirname(fileURLToPath(import.meta.url));
export const FICHIER_MATRICE = join(RACINE, "combinaisons.json");
export const FICHIER_MANIFESTE = join(RACINE, "shell", "manifeste.json");

const REPERTOIRES = {
  "mf-tableau": { nom: "equipe-tableau", fichier: "mf-tableau.js" },
  "mf-filtres": { nom: "equipe-filtres", fichier: "mf-filtres.js" },
  "mf-calcul": { nom: "equipe-calcul", fichier: "mf-calcul.js" },
};

export async function manifesteCourant() {
  return JSON.parse(await readFile(FICHIER_MANIFESTE, "utf8"));
}

/** La combinaison actuellement servie, sous forme canonique et comparable. */
export function combinaisonDe(manifeste) {
  const parties = Object.entries(manifeste.fragments)
    .map(([balise, entree]) => [balise, entree.version])
    .sort(([a], [b]) => a.localeCompare(b));
  parties.push(["socle", manifeste.socle.version]);
  return {
    versions: Object.fromEntries(parties),
    cle: parties.map(([nom, version]) => `${nom}@${version}`).join(" + "),
  };
}

export async function matrice() {
  if (!existsSync(FICHIER_MATRICE)) return { approuvees: [] };
  return JSON.parse(await readFile(FICHIER_MATRICE, "utf8"));
}

export async function estApprouvee(cle) {
  const { approuvees } = await matrice();
  return approuvees.find((entree) => entree.cle === cle);
}

/**
 * Les seules vérifications MÉCANIQUES possibles avant d'enregistrer une combinaison :
 * chaque artefact référencé existe, et son contenu correspond à l'empreinte déclarée.
 * Cela ne dit rien du fait que les fragments se comprennent — voir l'avertissement
 * en tête de fichier.
 */
export async function verifierArtefacts(manifeste) {
  const problemes = [];

  for (const [balise, entree] of Object.entries(manifeste.fragments)) {
    const repertoire = REPERTOIRES[balise];
    if (!repertoire) {
      problemes.push(`${balise} : balise inconnue de la matrice`);
      continue;
    }
    const chemin = join(RACINE, repertoire.nom, "publie", entree.version, repertoire.fichier);
    if (!existsSync(chemin)) {
      problemes.push(`${balise} ${entree.version} : artefact absent (${chemin})`);
      continue;
    }
    const empreinte = `sha384-${createHash("sha384").update(await readFile(chemin)).digest("base64")}`;
    if (empreinte !== entree.integrity) {
      problemes.push(`${balise} ${entree.version} : l'artefact ne correspond plus à son empreinte`);
    }
  }

  const socle = join(RACINE, "socle", `v${manifeste.socle.version.split(".")[0]}`, "bus.js");
  if (!existsSync(socle)) problemes.push(`socle ${manifeste.socle.version} : artefact absent`);

  return problemes;
}

export async function approuver(combinaison, preuve) {
  const donnees = await matrice();
  donnees.approuvees = donnees.approuvees.filter((entree) => entree.cle !== combinaison.cle);
  donnees.approuvees.push({
    cle: combinaison.cle,
    versions: combinaison.versions,
    preuve,
    enregistree: new Date().toISOString().slice(0, 19).replace("T", " "),
  });
  donnees.approuvees.sort((a, b) => a.cle.localeCompare(b.cle));
  await writeFile(FICHIER_MATRICE, `${JSON.stringify(donnees, null, 2)}\n`);
}

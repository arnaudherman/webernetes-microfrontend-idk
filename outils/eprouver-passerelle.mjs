#!/usr/bin/env node
// @ts-check
/**
 * Éprouve les trois décisions de la passerelle, pour de vrai.
 *
 * Une passerelle qui relaie des octets ne prouve rien. Or elle peut le devenir sans
 * que rien ne casse : il suffit qu'un jour quelqu'un retire la validation de forme
 * « pour débloquer », ou remplace le 200 partiel par un 502 « c'est plus simple ».
 * Les quatre essais du bas continueraient de produire quelque chose à l'écran, et ce
 * quelque chose ne serait plus la démonstration.
 *
 * Ce fichier lance les quatre processus et joue les quatre pannes, en constatant à
 * chaque fois la décision attendue. Il est appelé par `npm run recette`.
 *
 *   node outils/eprouver-passerelle.mjs
 */

import { spawn } from "node:child_process";
import { request } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PORTS } from "../reel/pods/_socle/adresses.mjs";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @param {number} port
 * @param {string} chemin
 * @returns {Promise<{ status: number, entetes: import("node:http").IncomingHttpHeaders, corps: any }>}
 */
function appeler(port, chemin) {
  return new Promise((resoudre, rejeter) => {
    const requete = request({ host: "127.0.0.1", port, path: chemin }, (reponse) => {
      let texte = "";
      reponse.setEncoding("utf8");
      reponse.on("data", (morceau) => {
        texte += morceau;
      });
      reponse.on("end", () => {
        let corps;
        try {
          corps = JSON.parse(texte);
        } catch {
          corps = texte;
        }
        resoudre({ status: reponse.statusCode ?? 0, entetes: reponse.headers, corps });
      });
    });
    requete.setTimeout(5000, () => requete.destroy(new Error("délai dépassé")));
    requete.on("error", rejeter);
    requete.end();
  });
}

const attendre = (ms) => new Promise((resoudre) => setTimeout(resoudre, ms));

const constats = [];
let echecs = 0;

/**
 * @param {string} intitule
 * @param {boolean} condition
 * @param {string} [vu]
 */
function constater(intitule, condition, vu) {
  if (condition) {
    constats.push(`${intitule}`);
    return;
  }
  echecs += 1;
  constats.push(`ÉCHEC — ${intitule}${vu ? ` (vu : ${vu})` : ""}`);
}

/* ------------------------------------------------------- lancement des processus */

const console_ = spawn(process.execPath, [join(RACINE, "demo", "console.mjs")], {
  cwd: RACINE,
  stdio: ["ignore", "pipe", "pipe"],
});

let sortieConsole = "";
console_.stdout.setEncoding("utf8");
console_.stdout.on("data", (morceau) => {
  sortieConsole += morceau;
});
console_.stderr.setEncoding("utf8");
console_.stderr.on("data", (morceau) => {
  sortieConsole += morceau;
});

function arreter(code) {
  console_.kill("SIGTERM");
  setTimeout(() => process.exit(code), 200);
}

process.on("exit", () => console_.kill("SIGTERM"));

/** Attend que la passerelle réponde, ou abandonne en expliquant. */
async function attendreServices() {
  for (let essai = 0; essai < 60; essai += 1) {
    if (console_.exitCode !== null) {
      process.stderr.write(`La console n'a pas démarré :\n${sortieConsole}\n`);
      arreter(1);
      return false;
    }
    try {
      const reponse = await appeler(PORTS.passerelle, "/donnees");
      if (reponse.status === 200) return true;
    } catch {
      // pas encore
    }
    await attendre(150);
  }
  process.stderr.write(`Les services n'ont pas répondu en 9 s :\n${sortieConsole}\n`);
  arreter(1);
  return false;
}

const commande = (action, service) =>
  appeler(PORTS.console, `/commande?action=${action}${service ? `&service=${service}` : ""}`);

if (!(await attendreServices())) process.exit(1);

/* ------------------------------------------------- devoir 1 : la corrélation */

{
  const nominal = await appeler(PORTS.passerelle, "/donnees");
  const id = nominal.entetes["x-correlation-id"];

  constater("nominal : 200 avec les tâches et l'agrégat", nominal.status === 200 && nominal.corps.taches?.length === 9 && nominal.corps.charges?.length === 3, `status ${nominal.status}`);
  constater("l'identifiant de corrélation est rendu au client", typeof id === "string" && id.length > 0);
  constater("il est exposé à travers CORS", String(nominal.entetes["access-control-expose-headers"] ?? "").includes("x-correlation-id"));
  constater("le corps porte le même identifiant", nominal.corps?.meta?.id === id, `${nominal.corps?.meta?.id} ≠ ${id}`);

  // Le même identifiant doit apparaître sur DEUX appels distincts à `taches` : celui
  // de la passerelle et celui de `charges`. C'est ce qui distingue une corrélation
  // réelle d'un identifiant décoratif posé sur une seule requête.
  await attendre(150);
  const sauts = sortieConsole
    .split("\n")
    .filter((ligne) => ligne.includes(`id=${id}`) && ligne.includes("→ taches"));
  constater("le même identifiant traverse les deux chemins vers taches", sauts.length === 2, `${sauts.length} saut(s)`);
}

/* ------------------- devoir 2 : dégrader, selon l'amont qui manque */

{
  await commande("arreter", "charges");
  await attendre(300);
  const partiel = await appeler(PORTS.passerelle, "/donnees");

  constater("amont optionnel mort : 200 partiel, pas 503", partiel.status === 200, `status ${partiel.status}`);
  constater("les tâches sont tout de même servies", partiel.corps?.taches?.length === 9);
  constater("le manque est nommé dans le corps", partiel.corps?.degrade?.partie === "charges");
  constater("la cause est nommée : refus de connexion", partiel.corps?.degrade?.cause === "ECONNREFUSED", String(partiel.corps?.degrade?.cause));
  constater("l'en-tête de dégradation est posé", partiel.entetes["x-degradation"] === "charges");

  await commande("demarrer", "charges");
  await attendre(700);
}

{
  await commande("figer", "charges");
  await attendre(200);
  const debut = performance.now();
  const fige = await appeler(PORTS.passerelle, "/donnees");
  const duree = performance.now() - debut;

  constater("amont figé : 200 partiel après le budget", fige.status === 200 && fige.corps?.degrade !== undefined, `status ${fige.status}`);
  constater("la cause distingue le silence du refus", String(fige.corps?.degrade?.cause).includes("budget"), String(fige.corps?.degrade?.cause));
  constater("le budget est tenu : rendu entre 750 et 1500 ms", duree > 750 && duree < 1500, `${Math.round(duree)} ms`);

  await commande("degeler", "charges");
  await attendre(300);
}

{
  await commande("contrat-rompu");
  await attendre(200);
  const essentiel = await appeler(PORTS.passerelle, "/donnees");

  constater("amont ESSENTIEL en 500 : 503, pas de partiel", essentiel.status === 503, `status ${essentiel.status}`);
  constater("la cause est nommée", essentiel.corps?.cause === "HTTP 500", String(essentiel.corps?.cause));
  constater("la décision est attribuée", essentiel.corps?.decide_par === "passerelle");

  await commande("contrat-retabli");
  await attendre(200);
}

/* ----------------------- devoir 3 : refuser une charge utile non conforme */

{
  await commande("forme-rompue");
  await attendre(200);

  const refusee = await appeler(PORTS.passerelle, "/donnees");
  constater("charge utile non conforme : 502 avant le client", refusee.status === 502, `status ${refusee.status}`);
  constater("l'écart est nommé champ par champ", Array.isArray(refusee.corps?.ecarts) && refusee.corps.ecarts.some((e) => e.includes("statut")) && refusee.corps.ecarts.some((e) => e.includes("etat")), JSON.stringify(refusee.corps?.ecarts));

  // Et le contre-essai, qui est le sujet : sans intermédiaire, la même charge utile
  // passe. Si celui-ci échouait un jour, ce serait que quelqu'un a mis une
  // validation dans le service — et l'essai 4 ne démontrerait plus rien.
  const direct = await appeler(PORTS.taches, "/taches");
  constater("en appel direct, la même charge utile passe en 200", direct.status === 200 && direct.corps?.taches?.[0]?.etat !== undefined && direct.corps?.taches?.[0]?.statut === undefined, `status ${direct.status}`);

  const avale = await appeler(PORTS.charges, "/charges");
  constater("et charges en tire un agrégat faux, sans rien signaler", avale.status === 200 && avale.corps?.charges?.[0]?.parStatut?.undefined !== undefined, `status ${avale.status}`);

  await commande("forme-retablie");
  await attendre(200);
}

{
  const retour = await appeler(PORTS.passerelle, "/donnees");
  constater("retour au nominal après les quatre pannes", retour.status === 200 && retour.corps?.charges?.length === 3, `status ${retour.status}`);
}

/* ------------------------------------------------------------------ verdict */

for (const constat of constats) process.stdout.write(`${constat}\n`);
process.stdout.write(`${constats.length - echecs}/${constats.length} constats\n`);

arreter(echecs === 0 ? 0 : 1);

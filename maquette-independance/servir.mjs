#!/usr/bin/env node
/**
 * Cinq « équipes », six serveurs, zéro dépendance.
 *
 * Un seul processus expose six racines statiques sur six ports. Le nombre de
 * processus n'a aucune importance pour ce qu'on démontre : ce qui compte est que
 * chaque artefact est servi depuis sa propre origine, relu sur le disque à chaque
 * requête, et qu'aucun redémarrage n'est nécessaire quand l'un d'eux est recompilé.
 *
 * Le port 5105 sert délibérément SANS en-tête CORS : c'est la panne n°2 de la
 * démonstration.
 *
 *   node servir.mjs
 */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  approuver,
  combinaisonDe,
  manifesteCourant,
  verifierArtefacts,
} from "./combinaisons.mjs";

const RACINE = dirname(fileURLToPath(import.meta.url));

const SITES = [
  // Les équipes servent leur répertoire `publie`, pas leur `dist`. Ce qui est en ligne
  // est ce qui a été publié sous une URL versionnée immuable, pas la dernière
  // compilation en date : c'est toute la différence entre recompiler et déployer.
  { port: 5100, repertoire: "shell", intitule: "shell (composition)", cors: true },
  { port: 5101, repertoire: "equipe-tableau/publie", intitule: "équipe tableau", cors: true },
  { port: 5102, repertoire: "equipe-filtres/publie", intitule: "équipe filtres", cors: true },
  { port: 5103, repertoire: "socle", intitule: "équipe socle", cors: true },
  { port: 5104, repertoire: "depot-concurrent/publie", intitule: "dépôt concurrent", cors: true },
  { port: 5105, repertoire: "equipe-sans-cors", intitule: "origine SANS CORS", cors: false, origineIsolee: true },
];

const TYPES = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function creer(site) {
  const racine = resolve(RACINE, site.repertoire);

  return createServer(async (requete, reponse) => {
    const entete = {
      // Aucun cache : la preuve centrale consiste à recompiler un artefact et à le
      // recharger. Un artefact servi depuis le cache invaliderait la démonstration.
      "Cache-Control": "no-store, max-age=0",
    };
    if (site.cors) {
      entete["Access-Control-Allow-Origin"] = "*";
      entete["Access-Control-Allow-Methods"] = "GET, OPTIONS";
    }
    // Demande une isolation PAR ORIGINE plutôt que par site. Sans cet en-tête, deux
    // origines du même site (deux ports, deux sous-domaines) partagent le même
    // groupe d'agents, donc le même fil d'exécution.
    if (site.origineIsolee) entete["Origin-Agent-Cluster"] = "?1";

    if (requete.method === "OPTIONS") {
      reponse.writeHead(204, entete);
      reponse.end();
      return;
    }

    /**
     * Enregistrement automatique d'un assemblage.
     *
     * Ce point d'entrée est ce qui fait passer la porte de déploiement de la
     * DÉCLARATION à la PREUVE. Le shell charge réellement la combinaison dans le
     * navigateur, exécute un test de fumée, et poste son verdict. Aucun humain
     * n'affirme plus que « ça marche » : c'est le navigateur qui le constate.
     *
     * Un test de fumée reste un test de fumée — il constate que la combinaison
     * démarre et que les messages passent, pas qu'elle est fonctionnellement juste.
     */
    const chemin = decodeURIComponent(new URL(requete.url ?? "/", "http://x").pathname);

    if (requete.method === "POST" && chemin === "/assemblage") {
      if (site.port !== 5100) {
        reponse.writeHead(404, entete);
        reponse.end("hors du shell");
        return;
      }

      const morceaux = [];
      for await (const morceau of requete) morceaux.push(morceau);

      try {
        const { verdict, preuve } = JSON.parse(Buffer.concat(morceaux).toString("utf8"));
        const manifeste = await manifesteCourant();
        const combinaison = combinaisonDe(manifeste);

        if (!verdict?.ok) {
          reponse.writeHead(409, { ...entete, "Content-Type": "application/json" });
          reponse.end(JSON.stringify({ enregistre: false, motif: "test de fumée en échec" }));
          console.log(`  5100  409  assemblage refusé : ${combinaison.cle}`);
          return;
        }

        const problemes = await verifierArtefacts(manifeste);
        if (problemes.length > 0) {
          reponse.writeHead(409, { ...entete, "Content-Type": "application/json" });
          reponse.end(JSON.stringify({ enregistre: false, motif: problemes.join(" ; ") }));
          return;
        }

        await approuver(combinaison, preuve);
        reponse.writeHead(200, { ...entete, "Content-Type": "application/json" });
        reponse.end(JSON.stringify({ enregistre: true, cle: combinaison.cle }));
        console.log(`  5100  200  assemblage enregistré : ${combinaison.cle}`);
      } catch (erreur) {
        reponse.writeHead(400, entete);
        reponse.end(String(erreur));
      }
      return;
    }

    const relatif = normalize(chemin === "/" ? "/index.html" : chemin).replace(/^(\.\.[/\\])+/, "");
    const fichier = join(racine, relatif);

    if (!fichier.startsWith(racine)) {
      reponse.writeHead(403, entete);
      reponse.end("interdit");
      return;
    }

    try {
      await stat(fichier);
      const contenu = await readFile(fichier);
      entete["Content-Type"] = TYPES[extname(fichier)] ?? "application/octet-stream";
      entete["Content-Length"] = String(contenu.byteLength);
      reponse.writeHead(200, entete);
      reponse.end(contenu);
      console.log(`  ${site.port}  200  ${relatif}`);
    } catch {
      entete["Content-Type"] = "text/plain; charset=utf-8";
      reponse.writeHead(404, entete);
      reponse.end(`introuvable : ${relatif}`);
      console.log(`  ${site.port}  404  ${relatif}`);
    }
  });
}

/**
 * Un port occupé ne doit pas tuer les six serveurs sur une trace d'erreur brute.
 * En salle, un processus resté en vie d'une session précédente est le scénario le
 * plus probable, et le message par défaut de Node n'aide personne.
 */
function ecouter(site) {
  return new Promise((resoudre) => {
    const serveur = creer(site);
    serveur.once("error", (erreur) => {
      if (erreur.code === "EADDRINUSE") {
        console.error(
          `\n  Le port ${site.port} est déjà occupé (${site.intitule}).\n` +
            `  Un serveur d'une session précédente tourne probablement encore.\n` +
            `  Pour le voir :     lsof -nP -iTCP:${site.port} -sTCP:LISTEN\n` +
            `  Pour tout arrêter : pkill -f servir.mjs\n`,
        );
      } else {
        console.error(`\n  Port ${site.port} : ${erreur.message}\n`);
      }
      process.exit(1);
    });
    serveur.listen(site.port, "127.0.0.1", () => resoudre({ site, serveur }));
  });
}

const serveurs = [];
for (const site of SITES) serveurs.push(await ecouter(site));

console.log("\nMaquette d'indépendance de déploiement — six origines\n");
for (const { site } of serveurs) {
  const marque = site.cors ? "" : "   ← sert sans en-tête CORS, volontairement";
  console.log(`  http://localhost:${site.port}/  ${site.intitule.padEnd(22)}${site.repertoire}${marque}`);
}
console.log("\n  Ouvrir            http://localhost:5100/");
console.log("  Coexistence       http://localhost:5100/coexistence.html");
console.log("\n  Ctrl-C pour tout arrêter.\n");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    for (const { serveur } of serveurs) serveur.close();
    process.exit(0);
  });
}

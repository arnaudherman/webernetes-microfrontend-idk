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

// L'équipe calcul publie trois fichiers INDISSOCIABLES : sans sa glu, le binaire wasm
// n'est pas chargeable ; sans le binaire, la glu échoue à l'initialisation. On vérifie
// la version RÉELLEMENT DÉPLOYÉE, lue dans le manifeste — coder une version en dur
// rendrait la recette verte sur un artefact que plus personne ne sert.
etape("les trois fichiers wasm de la version déployée", () => {
  const resultat = commande("node", [
    "-e",
    "const{readFileSync,statSync}=require('node:fs');" +
      "const m=JSON.parse(readFileSync('shell/manifeste.json','utf8'));" +
      "const v=m.fragments['mf-calcul'].version;" +
      "for(const f of ['mf-calcul.js','calcul.js','calcul_bg.wasm']){" +
      "const p='equipe-calcul/publie/'+v+'/'+f;" +
      "if(statSync(p).size<100)throw new Error(p+' est vide ou tronqué');}" +
      "console.log('version '+v+', trois fichiers présents')",
  ], MAQUETTE);
  if (!resultat.ok) return resultat;
  console.log(`         │ ${resultat.sortie.trim()}`);
  return { ok: true };
});

etape("la page de mesures est en place", () =>
  fichierNonVide("maquette-independance/shell/mesures.js", 3000),
);

for (const artefact of [
  "maquette-independance/equipe-tableau/dist/mf-tableau.js",
  "maquette-independance/equipe-filtres/dist/mf-filtres.js",
  "maquette-independance/depot-concurrent/dist/mf-tableau.js",
  "maquette-independance/socle/v3/bus.js",
  "maquette-independance/socle/v4/bus.js",
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

etape("publication des versions immuables", () => commande("node", ["publier.mjs"], MAQUETTE));

etape("manifeste cohérent avec les artefacts publiés", () => {
  const resultat = commande("node", [
    "-e",
    "const{readFileSync}=require('node:fs');const{createHash}=require('node:crypto');" +
      "const m=JSON.parse(readFileSync('shell/manifeste.json','utf8'));" +
      "const c=[['socle',m.socle],...Object.entries(m.fragments)];" +
      "if(!m.concurrent)throw new Error('entrée concurrent absente du manifeste');" +
      "c.push(['concurrent',m.concurrent]);" +
      "for(const[n,e]of c){" +
      "const p=e.url.replace(/^http:\\/\\/localhost:5101\\//,'equipe-tableau/publie/')" +
      ".replace(/^http:\\/\\/localhost:5102\\//,'equipe-filtres/publie/')" +
      ".replace(/^http:\\/\\/localhost:5106\\//,'equipe-calcul/publie/')" +
      ".replace(/^http:\\/\\/localhost:5104\\//,'depot-concurrent/publie/')" +
      ".replace(/^http:\\/\\/localhost:5103\\//,'socle/');" +
      "const h='sha384-'+createHash('sha384').update(readFileSync(p)).digest('base64');" +
      "if(h!==e.integrity)throw new Error(n+' : empreinte du manifeste != artefact '+p);}" +
      "console.log(c.length+' entrées vérifiées')",
  ], MAQUETTE);
  if (!resultat.ok) return resultat;
  console.log(`         │ ${resultat.sortie.trim()}`);
  return { ok: true };
});

etape("carte d'import alignée sur le manifeste", () => {
  const resultat = commande("node", [
    "-e",
    "const{readFileSync}=require('node:fs');" +
      "const m=JSON.parse(readFileSync('shell/manifeste.json','utf8'));" +
      "for(const f of ['index.html','coexistence.html']){" +
      "const h=readFileSync('shell/'+f,'utf8');" +
      "const b=h.slice(h.indexOf('CARTE-DEBUT'),h.indexOf('CARTE-FIN'));" +
      "const c=JSON.parse(b.slice(b.indexOf('{'),b.lastIndexOf('}')+1));" +
      "for(const e of Object.values(m.fragments))" +
      "if(c.integrity?.[e.url]!==e.integrity)throw new Error(f+' : '+e.url+' absent ou desaligne');}" +
      "console.log('deux cartes alignees')",
  ], MAQUETTE);
  if (!resultat.ok) return resultat;
  console.log(`         │ ${resultat.sortie.trim()}`);
  return { ok: true };
});

etape("le validateur de contrat : forme, valeurs, bornes, règles", () => {
  const resultat = commande("node", [
    "-e",
    "const{valider}=await import('./socle/v3/contrats.js');" +
      "const doitPasser=(e,c,q)=>{const v=valider(e,c);if(!v.valide)throw new Error(q+' refusé : '+v.ecarts.join(', '));};" +
      "const doitEchouer=(e,c,q)=>{const v=valider(e,c);if(v.valide)throw new Error(q+' accepté à tort');return v;};" +
      "doitPasser('filtre:change',{statut:'a-faire'},'v1');" +
      "doitPasser('filtre:change',{statut:'a-faire',origine:'utilisateur'},'v2');" +
      "doitEchouer('filtre:change',{etat:'a-faire'},'champ renommé');" +
      "doitEchouer('filtre:change',{statut:'en_cours'},'valeur hors ensemble');" +
      "doitEchouer('filtre:change',{statut:'a-faire',profondeurJours:400},'borne');" +
      "doitEchouer('filtre:change',{statut:'a-faire',profondeurJours:1.5},'décimal');" +
      "doitEchouer('filtre:change',{statut:'tous',profondeurJours:10},'règle inter-champs');" +
      "doitPasser('tache:estimee',{id:'T',charge:{valeur:2,unite:'jours'}},'unité');" +
      "doitEchouer('tache:estimee',{id:'T',charge:{valeur:128,unite:'jours'}},'jours suspects');" +
      "const i=valider('evenement:sans-contrat',{n:1});" +
      "if(!i.valide||i.contractualise)throw new Error('un événement sans contrat doit passer');" +
      "console.log('9 cas de validation conformes')",
    "--input-type=module",
  ], MAQUETTE);
  if (!resultat.ok) return resultat;
  console.log(`         │ ${resultat.sortie.trim()}`);
  return { ok: true };
});

etape("le verdict de publier() distingue les trois issues", () => {
  const resultat = commande("node", [
    "-e",
    "globalThis.dispatchEvent=()=>{};globalThis.CustomEvent=class{constructor(){}};" +
      "const bus=await import('./socle/v3/bus.js');" +
      "bus.abonner('filtre:change','sonde',()=>{});" +
      "const remis=bus.publier('filtre:change',{statut:'tous'},'t');" +
      "if(!remis.remis||remis.refuse)throw new Error('cas remis incorrect');" +
      "const sans=bus.publier('autre:evenement',{},'t');" +
      "if(sans.remis||sans.refuse)throw new Error('cas sans abonné incorrect');" +
      "const ref=bus.publier('filtre:change',{etat:'tous'},'t');" +
      "if(ref.refuse!=='contrat'||ref.remis)throw new Error('cas refusé incorrect');" +
      "console.log('remis / sans abonné / refusé : distingués')",
    "--input-type=module",
  ], MAQUETTE);
  if (!resultat.ok) return resultat;
  console.log(`         │ ${resultat.sortie.trim()}`);
  return { ok: true };
});

etape("la combinaison servie a été assemblée", () => {
  const resultat = commande("node", [
    "-e",
    "const m=await import('./combinaisons.mjs');" +
      "const man=await m.manifesteCourant();const c=m.combinaisonDe(man);" +
      "const p=await m.verifierArtefacts(man);" +
      "if(p.length)throw new Error(p.join(' ; '));" +
      "const a=await m.estApprouvee(c.cle);" +
      "if(!a)throw new Error('combinaison jamais assemblée : '+c.cle);" +
      "console.log(c.cle)",
    "--input-type=module",
  ], MAQUETTE);
  if (!resultat.ok) return resultat;
  console.log(`         │ ${resultat.sortie.trim()}`);
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

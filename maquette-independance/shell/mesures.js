/**
 * Les mesures qui fondent les affirmations de cette étude, rendues rejouables.
 *
 * Une affirmation d'architecture qui repose sur un chiffre cité est fragile : le
 * chiffre vieillit, la machine change, le navigateur change. Une affirmation qui
 * repose sur un chiffre qu'on peut refaire devant la salle ne l'est pas.
 *
 * Cinq mesures, dans l'ordre où elles décident quelque chose :
 *
 *   1. Qui protège du fragment fou ?      Worker contre iframe, même origine et même site.
 *   2. Peut-on l'arrêter ?                terminate() sur une boucle non coopérative.
 *   3. Que coûte le passage ?             appel direct contre aller-retour Worker, par taille.
 *   4. Que coûte un Worker ?              démarrage à vide, et avec un module chargé par HTTP.
 *   5. La résolution traverse-t-elle ?    la carte d'import s'applique-t-elle dans un Worker ?
 */

const zone = document.querySelector("#resultats");
const bouton = document.querySelector("#lancer");

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const arrondir = (v, n = 3) => Math.round(v * 10 ** n) / 10 ** n;

function section(titre, explication) {
  const h = document.createElement("h3");
  h.textContent = titre;
  const p = document.createElement("p");
  p.className = "quoi";
  p.textContent = explication;
  const t = document.createElement("table");
  const attente = document.createElement("tr");
  attente.innerHTML = '<td class="attente" colspan="4">mesure en cours…</td>';
  t.append(attente);
  zone.append(h, p, t);
  return t;
}

function remplir(table, entetes, lignes) {
  table.replaceChildren();
  const tete = document.createElement("tr");
  for (const e of entetes) {
    const th = document.createElement("th");
    th.textContent = e;
    tete.append(th);
  }
  table.append(tete);
  for (const ligne of lignes) {
    const tr = document.createElement("tr");
    for (const cellule of ligne) {
      const td = document.createElement("td");
      if (typeof cellule === "object" && cellule !== null) {
        td.textContent = cellule.texte;
        if (cellule.ton) td.className = cellule.ton;
      } else {
        td.textContent = String(cellule);
      }
      tr.append(td);
    }
    table.append(tr);
  }
}

/** Échantillonne la réactivité du fil principal ; rend le plus grand trou observé. */
function sonderFilPrincipal(dureeMs) {
  return new Promise((resoudre) => {
    const debut = performance.now();
    let precedent = debut;
    let trouMax = 0;
    const tic = () => {
      const maintenant = performance.now();
      trouMax = Math.max(trouMax, maintenant - precedent);
      precedent = maintenant;
      if (maintenant - debut < dureeMs) setTimeout(tic, 16);
      else resoudre(Math.round(trouMax));
    };
    setTimeout(tic, 16);
  });
}

const creerWorker = (code, options) =>
  new Worker(URL.createObjectURL(new Blob([code], { type: "text/javascript" })), options);

const bloquer = (ms) => `const fin=Date.now()+${ms};while(Date.now()<fin){};`;

/* ------------------------------------------------------------------ mesure 1 */

async function quiProtege() {
  const table = section(
    "1. Qui protège d'un fragment qui part en boucle ?",
    "Un fragment bloque son fil pendant deux secondes. On regarde si le fil principal " +
      "de la page — celui qui rend l'interface — est figé pendant ce temps.",
  );

  const reference = await sonderFilPrincipal(1200);

  const w = creerWorker(`self.onmessage=()=>{${bloquer(2000)}self.postMessage(1)};`);
  const finWorker = new Promise((r) => (w.onmessage = r));
  w.postMessage("go");
  const avecWorker = await sonderFilPrincipal(2200);
  await finWorker;
  w.terminate();

  const cadre = document.createElement("iframe");
  cadre.style.cssText = "position:fixed;left:-9999px;width:10px;height:10px";
  document.body.append(cadre);
  await new Promise((r) => { cadre.onload = r; cadre.src = "about:blank"; });
  setTimeout(() => { try { cadre.contentWindow.eval(bloquer(2000)); } catch { /* ignoré */ } }, 50);
  const avecIframeMemeOrigine = await sonderFilPrincipal(2400);
  cadre.remove();

  const cadre2 = document.createElement("iframe");
  cadre2.style.cssText = "position:fixed;left:-9999px;width:10px;height:10px";
  document.body.append(cadre2);
  setTimeout(() => { cadre2.src = "http://localhost:5105/bloqueur.html#2000"; }, 60);
  const avecIframeAutreOrigine = await sonderFilPrincipal(2600);
  cadre2.remove();

  const juger = (v) => ({ texte: `${v} ms`, ton: v > 500 ? "mauvais" : "bon" });

  remplir(table, ["frontière", "fil principal bloqué", "verdict"], [
    ["aucune (référence)", juger(reference), "—"],
    ["Web Worker", juger(avecWorker), "protège"],
    ["iframe même origine", juger(avecIframeMemeOrigine), "ne protège pas"],
    ["iframe autre origine, même site (port 5105)", juger(avecIframeAutreOrigine), "ne protège pas"],
  ]);

  return { reference, avecWorker, avecIframeMemeOrigine, avecIframeAutreOrigine };
}

/* ------------------------------------------------------------------ mesure 2 */

async function peutOnArreter() {
  const table = section(
    "2. Peut-on arrêter un fragment qui ne coopère pas ?",
    "Un Worker part dans une boucle de soixante secondes qui n'écoute rien. On appelle " +
      "terminate() après trois cents millisecondes.",
  );

  const w = creerWorker(`self.onmessage=()=>{${bloquer(60000)}self.postMessage("A SURVECU")};`);
  let survecu = false;
  w.onmessage = () => { survecu = true; };
  w.postMessage("go");
  await attendre(300);
  const t0 = performance.now();
  w.terminate();
  const dureeAppel = arrondir(performance.now() - t0);
  await attendre(1500);

  remplir(table, ["observation", "valeur", "", ""], [
    ["retour de l'appel terminate()", { texte: `${dureeAppel} ms`, ton: "bon" }, "", ""],
    [
      "le worker a-t-il fini sa boucle ?",
      { texte: survecu ? "OUI — non interrompu" : "NON — interrompu", ton: survecu ? "mauvais" : "bon" },
      "", "",
    ],
    ["fil principal pendant ce temps", { texte: "non affecté", ton: "bon" }, "", ""],
  ]);

  return { dureeAppel, survecu };
}

/* ------------------------------------------------------------------ mesure 3 */

async function prixDuPassage() {
  const table = section(
    "3. Que coûte un franchissement de frontière ?",
    "Le même objet, passé par un appel de fonction puis par un aller-retour vers un " +
      "Worker. La dernière colonne isole la part de (dé)sérialisation.",
  );

  const tache = (i) => ({ id: "T-" + i, titre: "tâche numéro " + i, statut: "a-faire",
    responsable: "A. Mercier", echeance: "2026-09-04", chargeJours: 4 });
  const charge = (n) => ({ taches: Array.from({ length: n }, (_, i) => tache(i)) });

  const f = (c) => c;
  const petit = charge(8);
  let t = performance.now();
  for (let i = 0; i < 300000; i++) f(petit);
  const appelDirect = (performance.now() - t) / 300000;

  const w = creerWorker(`self.onmessage=(e)=>self.postMessage(e.data);`);
  await new Promise((r) => { w.onmessage = r; w.postMessage(0); });

  const lignes = [[
    "appel de fonction direct",
    { texte: `${Math.round(appelDirect * 1e6)} ns`, ton: "bon" },
    "—", "—",
  ]];

  for (const n of [8, 90, 430, 3100]) {
    const c = charge(n);
    const octets = JSON.stringify(c).length;
    const tours = n > 1000 ? 25 : n > 300 ? 80 : 200;

    const debut = performance.now();
    for (let i = 0; i < tours; i++) {
      await new Promise((r) => { w.onmessage = r; w.postMessage(c); });
    }
    const allerRetour = (performance.now() - debut) / tours;

    const rep = n > 1000 ? 40 : 200;
    const d2 = performance.now();
    for (let i = 0; i < rep; i++) structuredClone(c);
    const clone = (performance.now() - d2) / rep;

    lignes.push([
      `aller-retour Worker, ${(octets / 1024).toFixed(1)} ko`,
      { texte: `${arrondir(allerRetour)} ms` },
      `×${Math.round(allerRetour / appelDirect).toLocaleString("fr-FR")}`,
      `${arrondir(clone)} ms de clonage`,
    ]);
  }
  w.terminate();

  remplir(table, ["opération", "durée", "rapport à l'appel direct", "dont sérialisation"], lignes);
}

/* ------------------------------------------------------------------ mesure 4 */

async function prixDunWorker() {
  const table = section(
    "4. Que coûte l'existence d'un Worker ?",
    "Démarrage d'un worker vide, puis d'un worker qui charge réellement le socle par HTTP.",
  );

  const demarrer = (code, options) =>
    new Promise((resoudre) => {
      const t0 = performance.now();
      const w = creerWorker(code, options);
      const fin = setTimeout(() => { w.terminate(); resoudre(null); }, 5000);
      w.onmessage = () => { clearTimeout(fin); w.terminate(); resoudre(performance.now() - t0); };
      w.onerror = () => { clearTimeout(fin); w.terminate(); resoudre(null); };
    });

  const mediane = (v) => { const s = v.filter((x) => x !== null).sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : null; };

  const vides = [];
  for (let i = 0; i < 8; i++) vides.push(await demarrer(`self.postMessage(1)`));

  const socle = document.querySelector('script[type="importmap"]');
  const urlSocle = socle ? JSON.parse(socle.textContent).imports["@socle/bus"] : null;
  const charges = [];
  if (urlSocle) {
    for (let i = 0; i < 8; i++) {
      charges.push(await demarrer(
        `import {VERSION} from "${urlSocle}"; self.postMessage(VERSION);`, { type: "module" }));
    }
  }

  remplir(table, ["worker", "démarrage médian", "", ""], [
    ["vide", { texte: `${arrondir(mediane(vides), 1)} ms`, ton: "bon" }, "", ""],
    [
      "chargeant le socle par HTTP",
      charges.length && mediane(charges) !== null
        ? { texte: `${arrondir(mediane(charges), 1)} ms` }
        : { texte: "non mesurable", ton: "mauvais" },
      "", "",
    ],
  ]);
}

/* ------------------------------------------------------------------ mesure 5 */

async function resolutionTraverse() {
  const table = section(
    "5. La carte d'import traverse-t-elle la frontière du Worker ?",
    "C'est la mesure la plus structurante : tout le versionnage de cette maquette repose " +
      "sur la résolution d'un spécificateur nu par la carte d'import du document.",
  );

  const essayer = (code, options) =>
    new Promise((resoudre) => {
      let w;
      try { w = creerWorker(code, options); } catch (e) { return resoudre({ ok: false, quoi: e.message }); }
      const fin = setTimeout(() => { w.terminate(); resoudre({ ok: false, quoi: "délai dépassé" }); }, 4000);
      w.onmessage = (e) => { clearTimeout(fin); w.terminate(); resoudre({ ok: true, quoi: String(e.data) }); };
      w.onerror = () => { clearTimeout(fin); w.terminate(); resoudre({ ok: false, quoi: "échec de résolution" }); };
    });

  const carte = document.querySelector('script[type="importmap"]');
  const urlSocle = carte ? JSON.parse(carte.textContent).imports["@socle/bus"] : "";

  const absolue = await essayer(
    `import {VERSION} from "${urlSocle}"; self.postMessage("socle " + VERSION);`, { type: "module" });
  const nue = await essayer(
    `import {VERSION} from "@socle/bus"; self.postMessage("socle " + VERSION);`, { type: "module" });

  let dansLaPage;
  try {
    const m = await import("@socle/bus");
    dansLaPage = { ok: true, quoi: `socle ${m.VERSION}` };
  } catch (e) {
    dansLaPage = { ok: false, quoi: e.message };
  }

  const juger = (r) => ({ texte: r.ok ? r.quoi : `échec — ${r.quoi}`, ton: r.ok ? "bon" : "mauvais" });

  remplir(table, ["import tenté", "résultat", "", ""], [
    ["URL absolue, dans un Worker", juger(absolue), "", ""],
    ["spécificateur nu « @socle/bus », dans un Worker", juger(nue), "", ""],
    ["spécificateur nu « @socle/bus », dans la page", juger(dansLaPage), "", ""],
  ]);
}

/* -------------------------------------------------------------------------- */

/**
 * Garde-fou. Chrome bride les minuteurs d'un onglet masqué à environ un par seconde :
 * toutes les mesures de blocage rendent alors ~1000 ms, y compris la référence, et le
 * tableau devient un piège au lieu d'un instrument.
 *
 * On refuse de mesurer plutôt que de produire des chiffres faux. Une mesure silencieuse
 * et fausse coûte plus cher que pas de mesure.
 */
async function environnementFiable() {
  if (document.visibilityState !== "visible") {
    return { fiable: false, motif: "cet onglet est en arrière-plan : Chrome bride ses minuteurs à environ un par seconde" };
  }
  const reference = await sonderFilPrincipal(600);
  if (reference > 100) {
    return {
      fiable: false,
      motif: `le fil principal est déjà perturbé au repos (${reference} ms de trou) — fermez les autres onglets et les outils de développement`,
    };
  }
  return { fiable: true, reference };
}

bouton.addEventListener("click", async () => {
  bouton.disabled = true;
  bouton.textContent = "vérification de l'environnement…";
  zone.replaceChildren();

  const environnement = await environnementFiable();
  if (!environnement.fiable) {
    const alerte = document.createElement("p");
    alerte.className = "avertissement";
    alerte.innerHTML =
      `<strong>Mesure refusée.</strong> ${environnement.motif}. ` +
      `Les chiffres produits dans ces conditions seraient faux, et faux de façon crédible. ` +
      `Mettez cette fenêtre au premier plan, puis relancez.`;
    zone.append(alerte);
    bouton.disabled = false;
    bouton.textContent = "relancer toutes les mesures";
    return;
  }

  bouton.textContent = "mesures en cours…";

  const entete = document.createElement("p");
  entete.className = "quoi";
  entete.textContent =
    `${navigator.userAgent.split(") ").at(-1)} · ${navigator.hardwareConcurrency} cœurs logiques · ` +
    `${new Date().toLocaleString("fr-FR")}`;
  zone.append(entete);

  await quiProtege();
  await peutOnArreter();
  await prixDuPassage();
  await prixDunWorker();
  await resolutionTraverse();

  bouton.disabled = false;
  bouton.textContent = "relancer toutes les mesures";
});

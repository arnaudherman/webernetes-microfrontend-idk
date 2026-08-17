/**
 * Les mesures qui fondent les affirmations de cette étude, rendues rejouables.
 *
 * Une affirmation d'architecture qui repose sur un chiffre cité est fragile : le
 * chiffre vieillit, la machine change, le navigateur change. Une affirmation qui
 * repose sur un chiffre qu'on peut refaire devant la salle ne l'est pas.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TROIS MESURES ONT ÉTÉ RETIRÉES DE CETTE PAGE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Elle en portait cinq. Trois ont été supprimées, avec le code qui les produisait —
 * l'isolation Worker contre iframe, le coût de démarrage d'un Worker, et la traversée
 * de la carte d'import. Motif :
 *
 *   ces trois mesures ne distinguent pas un résultat négatif d'un test qui n'a pas
 *   eu lieu.
 *
 * Deux subsistent, et elles se suffisent :
 *
 *   1. Peut-on l'arrêter ?     terminate() sur une boucle non coopérative.
 *   2. Que coûte le passage ?  aller-retour Worker, par taille de charge utile.
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

/**
 * Échantillonne la réactivité du fil principal ; rend le plus grand trou observé.
 *
 * Ne sert plus qu'au contrôle d'environnement ci-dessous : la mesure qui l'exploitait
 * pour publier un tableau a été retirée.
 */
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

async function peutOnArreter() {
  const table = section(
    "1. Peut-on arrêter un fragment qui ne coopère pas ?",
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
  ]);

  return { dureeAppel, survecu };
}

/* ------------------------------------------------------------------ mesure 2 */

async function prixDuPassage() {
  const table = section(
    "2. Que coûte un franchissement de frontière ?",
    "Le même objet, passé par un aller-retour vers un Worker, à quatre tailles. La " +
      "dernière colonne isole la part de (dé)sérialisation.",
  );

  const tache = (i) => ({ id: "T-" + i, titre: "tâche numéro " + i, statut: "a-faire",
    responsable: "A. Mercier", echeance: "2026-09-04", chargeJours: 4 });
  const charge = (n) => ({ taches: Array.from({ length: n }, (_, i) => tache(i)) });

  const w = creerWorker(`self.onmessage=(e)=>self.postMessage(e.data);`);
  await new Promise((r) => { w.onmessage = r; w.postMessage(0); });

  const lignes = [];

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
      `${arrondir(clone)} ms de clonage`,
    ]);
  }
  w.terminate();

  remplir(table, ["opération", "durée", "dont sérialisation"], lignes);
}

/* -------------------------------------------------------------------------- */

/**
 * Garde-fou. Chrome bride les minuteurs d'un onglet masqué à environ un par seconde :
 * les durées rendues deviennent alors des multiples du bridage, et le tableau devient
 * un piège au lieu d'un instrument.
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

  await peutOnArreter();
  await prixDuPassage();

  bouton.disabled = false;
  bouton.textContent = "relancer toutes les mesures";
});

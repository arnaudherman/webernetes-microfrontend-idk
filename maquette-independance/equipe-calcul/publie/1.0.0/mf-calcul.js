import { abonner, VERSION } from "@socle/bus";
import init, { version, agreger_colonnes, agreger_json } from "./calcul.js";
const RESPONSABLES = ["A. Mercier", "C. Delaunay", "S. Rahimi"];
const STATUTS = ["a-faire", "en-cours", "termine"];
function jeuDEssai(n) {
  const taches = [];
  for (let i = 0; i < n; i++) {
    taches.push({
      statut: STATUTS[i % 3],
      responsable: RESPONSABLES[i % 3],
      chargeJours: i % 13 + 1
    });
  }
  return taches;
}
function agregerEnJs(taches) {
  const par = /* @__PURE__ */ new Map();
  for (const tache of taches) {
    let ligne = par.get(tache.responsable);
    if (!ligne) {
      ligne = { responsable: tache.responsable, nbTaches: 0, chargeJours: 0 };
      par.set(tache.responsable, ligne);
    }
    ligne.nbTaches += 1;
    ligne.chargeJours += tache.chargeJours;
  }
  return [...par.values()].sort((a, b) => b.chargeJours - a.chargeJours);
}
const STYLE = `
  :host { display: block; font-family: ui-sans-serif, system-ui, sans-serif; }
  .cadre { border: 1px solid #a29d92; background: #fff; }
  .tete { padding: 5px 9px; background: #e6e4dd; border-bottom: 1px solid #cdc9c0;
          font-size: 14px; font-weight: 700; display: flex; justify-content: space-between; gap: 10px; }
  .lien { font-family: ui-monospace, Menlo, monospace; font-weight: 500; color: #5a5f68; }
  .corps { padding: 9px; }
  .boutons { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; }
  button { font-family: inherit; font-size: 14px; font-weight: 600; padding: 5px 10px;
           background: #fff; border: 1px solid #cdc9c0; cursor: pointer; }
  button:hover { border-color: #40454d; }
  button:disabled { color: #5a5f68; background: #e6e4dd; cursor: not-allowed; }
  button:focus-visible { outline: 3px solid #1145b4; outline-offset: 2px; }
  table { border-collapse: collapse; width: 100%; font-family: ui-monospace, Menlo, monospace; font-size: 14px; }
  th, td { text-align: right; padding: 2px 6px; border-bottom: 1px solid #e6e4dd; }
  th:first-child, td:first-child { text-align: left; }
  th { color: #5a5f68; font-weight: 600; }
  .rapide { color: #1145b4; font-weight: 700; }
  .note { margin: 8px 0 0; font-size: 14px; color: #5a5f68; line-height: 1.4; }
  .attente { color: #5a5f68; font-style: italic; font-size: 15px; }
`;
class MfCalcul extends HTMLElement {
  #racine;
  #pret = false;
  #versionWasm = "?";
  #mesures = [];
  #occupe = false;
  constructor() {
    super();
    this.#racine = this.attachShadow({ mode: "open" });
  }
  async connectedCallback() {
    this.#rendre();
    abonner("filtre:change", "mf-calcul", () => {
    });
    try {
      await init();
      this.#versionWasm = version();
      this.#pret = true;
    } catch (erreur) {
      this.#versionWasm = `échec : ${erreur.message}`;
    }
    this.#rendre();
  }
  async #mesurer(taille) {
    this.#occupe = true;
    this.#rendre();
    await new Promise((r) => setTimeout(r, 0));
    const taches = jeuDEssai(taille);
    const json = JSON.stringify(taches);
    const responsables = new Uint32Array(taille);
    const statuts = new Uint8Array(taille);
    const charges = new Float64Array(taille);
    for (let i = 0; i < taille; i++) {
      responsables[i] = RESPONSABLES.indexOf(taches[i].responsable);
      statuts[i] = STATUTS.indexOf(taches[i].statut);
      charges[i] = taches[i].chargeJours;
    }
    const chrono = (travail, tours2) => {
      travail();
      const debut = performance.now();
      for (let i = 0; i < tours2; i++) travail();
      return (performance.now() - debut) / tours2;
    };
    const tours = taille > 2e4 ? 5 : taille > 2e3 ? 20 : 100;
    this.#mesures = [
      ...this.#mesures.filter((m) => m.taille !== taille),
      {
        taille,
        js: chrono(() => agregerEnJs(taches), tours),
        wasmJson: chrono(() => JSON.parse(agreger_json(json)), tours),
        wasmColonnes: chrono(
          () => agreger_colonnes(responsables, statuts, charges, RESPONSABLES.length),
          tours
        )
      }
    ].sort((a, b) => a.taille - b.taille);
    this.#occupe = false;
    this.#rendre();
  }
  #rendre() {
    const style = document.createElement("style");
    style.textContent = STYLE;
    const cadre = document.createElement("div");
    cadre.className = "cadre";
    const tete = document.createElement("div");
    tete.className = "tete";
    const nom = document.createElement("span");
    nom.textContent = "calcul — logique en Rust";
    const lien = document.createElement("span");
    lien.className = "lien";
    lien.textContent = `wasm ${this.#versionWasm} · socle ${VERSION}`;
    tete.append(nom, lien);
    const corps = document.createElement("div");
    corps.className = "corps";
    if (!this.#pret) {
      const attente = document.createElement("p");
      attente.className = "attente";
      attente.textContent = "chargement du module WebAssembly…";
      corps.append(attente);
    } else {
      const boutons = document.createElement("div");
      boutons.className = "boutons";
      for (const taille of [100, 1e3, 1e4, 1e5]) {
        const bouton = document.createElement("button");
        bouton.type = "button";
        bouton.textContent = `${taille.toLocaleString("fr-FR")} tâches`;
        bouton.disabled = this.#occupe;
        bouton.addEventListener("click", () => void this.#mesurer(taille));
        boutons.append(bouton);
      }
      corps.append(boutons);
      if (this.#mesures.length > 0) {
        const table = document.createElement("table");
        table.innerHTML = "<thead><tr><th>tâches</th><th>JS</th><th>Rust / JSON</th><th>Rust / colonnes</th></tr></thead>";
        const corpsTable = document.createElement("tbody");
        for (const m of this.#mesures) {
          const meilleur = Math.min(m.js, m.wasmJson, m.wasmColonnes);
          const cellule = (valeur) => {
            const td = document.createElement("td");
            td.textContent = `${valeur < 1 ? valeur.toFixed(3) : valeur.toFixed(2)} ms`;
            if (valeur === meilleur) td.className = "rapide";
            return td;
          };
          const ligne = document.createElement("tr");
          const t = document.createElement("td");
          t.textContent = m.taille.toLocaleString("fr-FR");
          ligne.append(t, cellule(m.js), cellule(m.wasmJson), cellule(m.wasmColonnes));
          corpsTable.append(ligne);
        }
        table.append(corpsTable);
        corps.append(table);
      }
      const note = document.createElement("p");
      note.className = "note";
      note.textContent = "Le rendu de ce tableau est en JavaScript. WebAssembly n'a aucun accès au DOM : ce fragment isole le calcul, jamais l'affichage.";
      corps.append(note);
    }
    cadre.append(tete, corps);
    this.#racine.replaceChildren(style, cadre);
  }
}
customElements.define("mf-calcul", MfCalcul);

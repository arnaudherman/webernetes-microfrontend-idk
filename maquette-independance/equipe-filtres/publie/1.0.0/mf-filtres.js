import { publier, identifiant, VERSION } from "@socle/bus";
const LIBELLE = "filtres v1";
const STATUTS = ["tous", "a-faire", "en-cours", "termine"];
const STYLE = `
  :host { display: block; font-family: ui-sans-serif, system-ui, sans-serif; }
  .cadre { border: 1px solid #a29d92; background: #fff; }
  .tete { padding: 5px 9px; background: #e6e4dd; border-bottom: 1px solid #cdc9c0;
          font-size: 14px; font-weight: 700; display: flex; justify-content: space-between; gap: 10px; }
  .lien { font-family: ui-monospace, Menlo, monospace; font-weight: 500; color: #5a5f68; }
  .corps { padding: 9px; display: flex; flex-wrap: wrap; gap: 5px; }
  button { font-family: inherit; font-size: 14px; font-weight: 600; padding: 5px 10px;
           background: #fff; border: 1px solid #cdc9c0; cursor: pointer; }
  button:hover { border-color: #40454d; }
  button[aria-pressed="true"] { background: #1145b4; border-color: #1145b4; color: #fff; }
  button:focus-visible { outline: 3px solid #1145b4; outline-offset: 2px; }
  .retour { padding: 0 9px 9px; font-family: ui-monospace, Menlo, monospace; font-size: 15px; }
  .perdu { color: #a81f16; font-weight: 700; }
`;
class MfFiltres extends HTMLElement {
  #racine;
  #statut = "tous";
  #dernierRetour = void 0;
  constructor() {
    super();
    this.#racine = this.attachShadow({ mode: "open" });
  }
  connectedCallback() {
    this.#rendre();
  }
  #publier() {
    this.#dernierRetour = publier("filtre:change", { statut: this.#statut }, "mf-filtres");
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
    nom.textContent = LIBELLE;
    const lien = document.createElement("span");
    lien.className = "lien";
    lien.textContent = `lié à ${identifiant}`;
    tete.append(nom, lien);
    const corps = document.createElement("div");
    corps.className = "corps";
    for (const statut of STATUTS) {
      const bouton = document.createElement("button");
      bouton.type = "button";
      bouton.textContent = statut;
      bouton.setAttribute("aria-pressed", String(statut === this.#statut));
      bouton.addEventListener("click", () => {
        this.#statut = statut;
        this.#publier();
      });
      corps.append(bouton);
    }
    const retour = document.createElement("p");
    retour.className = "retour";
    if (this.#dernierRetour === void 0) {
      retour.textContent = `publier() n'a pas encore été appelé · socle ${VERSION}`;
    } else {
      retour.textContent = `publier() a retourné ${this.#dernierRetour} abonné(s) · socle ${VERSION}`;
      if (this.#dernierRetour === 0) retour.classList.add("perdu");
    }
    cadre.append(tete, corps, retour);
    this.#racine.replaceChildren(style, cadre);
  }
}
customElements.define("mf-filtres", MfFiltres);

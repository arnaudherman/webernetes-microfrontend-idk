import { abonner } from "@socle/bus";
class MfTableauConcurrent extends HTMLElement {
  #racine;
  #desabonnements = [];
  constructor() {
    super();
    this.#racine = this.attachShadow({ mode: "open" });
  }
  connectedCallback() {
    this.#racine.textContent = "tableau, version de l'équipe concurrente";
    this.#desabonnements.push(
      abonner("filtre:change", "mf-tableau-concurrent", () => {
      })
    );
  }
  disconnectedCallback() {
    for (const desabonner of this.#desabonnements) desabonner();
    this.#desabonnements = [];
  }
}
customElements.define("mf-tableau", MfTableauConcurrent);

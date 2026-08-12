import { abonner } from "@socle/bus";
class MfTableauConcurrent extends HTMLElement {
  connectedCallback() {
    const racine = this.attachShadow({ mode: "open" });
    racine.textContent = "tableau, version de l'équipe concurrente";
    abonner("filtre:change", "mf-tableau-concurrent", () => {
    });
  }
}
customElements.define("mf-tableau", MfTableauConcurrent);

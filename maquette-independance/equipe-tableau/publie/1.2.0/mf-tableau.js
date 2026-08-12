import { abonner, identifiant, VERSION } from "@socle/bus";
const LIBELLE = "tableau v1.1 — livré par l'équipe tableau seule";
const STYLE = `
  :host { display: block; font-family: ui-sans-serif, system-ui, sans-serif; }
  .cadre { border: 1px solid #a29d92; background: #fff; }
  .tete { padding: 5px 9px; background: #e6e4dd; border-bottom: 1px solid #cdc9c0;
          font-size: 14px; font-weight: 700; display: flex; justify-content: space-between; gap: 10px; }
  .lien { font-family: ui-monospace, Menlo, monospace; font-weight: 500; color: #5a5f68; }
  .corps { padding: 9px; }
  .attente { color: #5a5f68; font-style: italic; font-size: 15px; }
  pre { margin: 0; font-family: ui-monospace, Menlo, monospace; font-size: 15px;
        white-space: pre-wrap; word-break: break-all; }
  .compteur { margin-top: 6px; font-size: 14px; color: #5a5f68; }
`;
class MfTableau extends HTMLElement {
  #racine;
  #desabonnements = [];
  #dernier = void 0;
  #recus = 0;
  constructor() {
    super();
    this.#racine = this.attachShadow({ mode: "open" });
  }
  connectedCallback() {
    this.#rendre();
    this.#desabonnements.push(
      abonner("filtre:change", "mf-tableau", (charge) => {
        this.#dernier = charge;
        this.#recus += 1;
        this.#rendre();
      })
    );
  }
  /**
   * Un fragment retiré du document doit se désabonner. Sans cela, son gestionnaire
   * reste dans le bus : il continue de recevoir des messages, il retient l'élément
   * détaché et tout ce qu'il capture, et `publier()` compte un abonné qui n'affiche
   * plus rien. Le producteur croit être entendu alors qu'il parle à un fantôme.
   *
   * Rien dans le bus ne le fait à sa place : `abonner` rend une fonction de
   * désabonnement, et c'est à l'abonné de la garder et de l'appeler.
   */
  disconnectedCallback() {
    for (const desabonner of this.#desabonnements) desabonner();
    this.#desabonnements = [];
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
    if (this.#dernier === void 0) {
      const attente = document.createElement("p");
      attente.className = "attente";
      attente.textContent = "aucun filtre reçu";
      corps.append(attente);
    } else {
      const charge = document.createElement("pre");
      charge.textContent = JSON.stringify(this.#dernier);
      corps.append(charge);
    }
    const compteur = document.createElement("p");
    compteur.className = "compteur";
    compteur.textContent = `${this.#recus} message(s) reçu(s) · socle ${VERSION}`;
    corps.append(compteur);
    cadre.append(tete, corps);
    this.#racine.replaceChildren(style, cadre);
  }
}
customElements.define("mf-tableau", MfTableau);

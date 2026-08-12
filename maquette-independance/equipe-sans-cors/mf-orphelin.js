/**
 * Fragment publié sur une origine qui n'envoie pas d'en-tête CORS.
 *
 * Ce fichier est parfaitement valide. Il ne sera jamais exécuté : le navigateur
 * refusera le module avant de le lire, parce que l'origine 5105 ne renvoie pas
 * `Access-Control-Allow-Origin`.
 *
 * Écrit à la main, sans chaîne de construction : la panne n'a rien à voir avec la
 * compilation.
 */

class MfOrphelin extends HTMLElement {
  connectedCallback() {
    const racine = this.attachShadow({ mode: "open" });
    racine.textContent = "si vous lisez ceci, le CORS est passé";
  }
}

customElements.define("mf-orphelin", MfOrphelin);

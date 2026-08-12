import { abonner } from "@socle/bus";

/**
 * Fragment d'une équipe concurrente, qui a choisi le même nom de balise.
 *
 * Le registre d'éléments personnalisés est GLOBAL AU DOCUMENT. `customElements.define`
 * lève une `NotSupportedError` sur un nom déjà pris, et l'exception se produit au
 * chargement du module — donc l'import échoue en entier, y compris pour la partie du
 * fragment qui n'avait rien à voir avec le conflit.
 *
 * Aucune des deux équipes n'a de moyen de découvrir ce conflit avant l'exécution :
 * l'espace de noms des balises n'est arbitré par aucun mécanisme, seulement par une
 * convention que des humains appliquent ou n'appliquent pas.
 *
 * Le correctif standard — les registres à portée — est bloqué par Firefox depuis
 * mars 2026. Il n'est donc pas utilisable en production aujourd'hui.
 */

class MfTableauConcurrent extends HTMLElement {
  connectedCallback(): void {
    const racine = this.attachShadow({ mode: "open" });
    racine.textContent = "tableau, version de l'équipe concurrente";
    abonner("filtre:change", "mf-tableau-concurrent", () => {});
  }
}

customElements.define("mf-tableau", MfTableauConcurrent);

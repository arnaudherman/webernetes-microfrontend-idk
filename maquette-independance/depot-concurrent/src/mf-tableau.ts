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
 *
 * Ce fragment ne monte jamais dans cette maquette, puisque `define` lève avant. Il est
 * néanmoins écrit correctement : le Shadow DOM est attaché dans le constructeur, et
 * l'abonnement est libéré au démontage. Un fragment de démonstration qui montrerait un
 * mauvais exemple serait un mauvais fragment de démonstration.
 */
class MfTableauConcurrent extends HTMLElement {
  readonly #racine: ShadowRoot;
  #desabonnements: (() => void)[] = [];

  constructor() {
    super();
    // Dans le constructeur, pas dans connectedCallback : un élément peut être retiré
    // puis réinséré, et `attachShadow` lève s'il est appelé deux fois.
    this.#racine = this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    this.#racine.textContent = "tableau, version de l'équipe concurrente";
    this.#desabonnements.push(
      abonner("filtre:change", "mf-tableau-concurrent", () => {}),
    );
  }

  disconnectedCallback(): void {
    for (const desabonner of this.#desabonnements) desabonner();
    this.#desabonnements = [];
  }
}

customElements.define("mf-tableau", MfTableauConcurrent);

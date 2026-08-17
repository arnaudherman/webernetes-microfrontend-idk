import type { Bus, Desabonnement } from "../bus";
import type { Contrat } from "../contrat";

/**
 * Fragment « filtres », version 2.0 — celle qui rompt le contrat.
 *
 * Une seule différence avec la 1.0 : la charge utile publiée porte `etat` au lieu de
 * `statut`. Le contrat DÉCLARÉ, lui, est inchangé — il annonce toujours publier
 * `filtre:change`. C'est exactement ce qui se passe quand une équipe renomme un champ
 * dans une version mineure : le nom de l'événement ne bouge pas, sa forme si.
 *
 * Rien ne détecte cela. Ni le bus, qui ne connaît pas la forme des charges utiles. Ni
 * le compilateur, puisque aucun type n'est partagé entre les fragments. Ni l'abonné,
 * qui lit `charge.statut`, obtient `undefined`, et en conclut « aucun filtre ».
 *
 * Ce fichier duplique presque intégralement mf-filtres.ts. Cette duplication est
 * délibérée et vérifiée : `npm run verifier-frontiere` interdit qu'un fragment importe
 * le code d'un autre. C'est le prix réel de l'indépendance de déploiement, et il est
 * plus honnête de le montrer que de le masquer derrière une classe de base commune.
 */

const RESPONSABLES = ["A. Mercier", "C. Delaunay", "S. Rahimi"] as const;

const STATUTS = [
  { valeur: "tous", libelle: "tous" },
  { valeur: "a-faire", libelle: "à faire" },
  { valeur: "en-cours", libelle: "en cours" },
  { valeur: "termine", libelle: "terminé" },
] as const;

const STYLE = `
  :host { display: block; height: 100%; overflow-y: auto; }
  .groupe { padding: 10px 12px; }
  .groupe + .groupe { border-top: 1px solid var(--trait); }
  h3 {
    margin: 0 0 7px; font-family: var(--libelles); font-size: var(--taille-libelle);
    font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--encre-tenue);
  }
  .choix { display: flex; flex-direction: column; gap: 4px; }
  /* Les responsables en jetons sur une ligne : empiles pleine largeur, ils
     poussaient la carte 124 px au-dela de sa rangee et le filtre devenait
     inatteignable sans defiler. */
  .choix-jetons { flex-direction: row; flex-wrap: wrap; gap: 4px; }
  .choix-jetons button { padding: 4px 8px; }
  button {
    font-family: var(--libelles); font-size: var(--taille-libelle); font-weight: 600;
    text-align: left; padding: 5px 9px; cursor: pointer;
    background: var(--surface); color: var(--encre);
    border: 1px solid var(--trait);
  }
  button:hover { border-color: var(--encre-douce); }
  button[aria-pressed="true"] {
    background: var(--nominal); border-color: var(--nominal); color: #fff;
  }
  button:focus-visible { outline: 3px solid var(--nominal); outline-offset: 2px; }
`;

export class MfFiltresV2 extends HTMLElement {
  static readonly contrat: Contrat = {
    nom: "filtres",
    version: "2.0",
    publie: ["filtre:change"],
    consomme: [],
  };

  bus?: Bus;

  readonly #racine: ShadowRoot;
  #desabonnements: Desabonnement[] = [];
  // Cette version arrive avec un défaut différent de la 1.0. C'est banal d'une
  // version à l'autre, et cela rend l'écart immédiatement lisible : le filtre est
  // visiblement sur « en cours », et le tableau affiche pourtant tout.
  #statut: string = "en-cours";
  #responsable: string = "tous";

  constructor() {
    super();
    this.#racine = this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    this.#rendre();
    this.#publier();
  }

  disconnectedCallback(): void {
    for (const desabonner of this.#desabonnements) desabonner();
    this.#desabonnements = [];
  }

  #publier(): void {
    this.bus?.publier(
      "filtre:change",
      // La seule ligne qui change : `etat` au lieu de `statut`.
      { etat: this.#statut, responsable: this.#responsable },
      "mf-filtres",
    );
  }

  #groupe(
    titre: string,
    options: readonly { valeur: string; libelle: string }[],
    courant: string,
    choisir: (valeur: string) => void,
    disposition: "colonne" | "jetons" = "colonne",
  ): HTMLElement {
    const bloc = document.createElement("div");
    bloc.className = "groupe";

    const intitule = document.createElement("h3");
    intitule.textContent = titre;
    intitule.id = `titre-${titre}`;

    const choix = document.createElement("div");
    choix.className = disposition === "jetons" ? "choix choix-jetons" : "choix";
    choix.setAttribute("role", "group");
    choix.setAttribute("aria-labelledby", intitule.id);

    for (const option of options) {
      const bouton = document.createElement("button");
      bouton.type = "button";
      bouton.textContent = option.libelle;
      bouton.setAttribute("aria-pressed", String(option.valeur === courant));
      bouton.addEventListener("click", () => {
        choisir(option.valeur);
        this.#rendre();
        this.#publier();
      });
      choix.append(bouton);
    }

    bloc.append(intitule, choix);
    return bloc;
  }

  #rendre(): void {
    const style = document.createElement("style");
    style.textContent = STYLE;

    this.#racine.replaceChildren(
      style,
      this.#groupe("statut", STATUTS, this.#statut, (valeur) => {
        this.#statut = valeur;
      }, "jetons"),
      this.#groupe(
        "responsable",
        [
          { valeur: "tous", libelle: "tous" },
          ...RESPONSABLES.map((nom) => ({ valeur: nom, libelle: nom })),
        ],
        this.#responsable,
        (valeur) => {
          this.#responsable = valeur;
        },
        "jetons",
      ),
    );
  }
}

customElements.define("mf-filtres-v2", MfFiltresV2);

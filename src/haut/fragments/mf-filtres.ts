import type { Bus, Desabonnement } from "../bus";
import type { Contrat } from "../contrat";

/**
 * Fragment « filtres ».
 *
 * N'importe le code d'aucun autre fragment, n'accède au DOM d'aucun autre, et ne
 * connaît du reste du monde que le bus qu'on lui injecte.
 *
 * Son contrat déclare qu'il ne consomme rien. La liste des responsables est donc
 * écrite en dur ici. Ce n'est pas une facilité : c'est le coût de coordination rendu
 * visible. Deux modules doivent s'accorder sur une liste qu'aucun des deux ne possède,
 * et rien dans l'outillage ne le vérifiera.
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

export class MfFiltres extends HTMLElement {
  static readonly contrat: Contrat = {
    nom: "filtres",
    version: "1.0",
    publie: ["filtre:change"],
    consomme: [],
  };

  bus?: Bus;

  readonly #racine: ShadowRoot;
  #desabonnements: Desabonnement[] = [];
  #statut: string = "tous";
  #responsable: string = "tous";

  constructor() {
    super();
    this.#racine = this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    this.#rendre();
    // Un fragment qui publie annonce son état courant en arrivant. Ce n'est pas
    // une relecture du bus : le bus, lui, ne rejoue jamais rien.
    this.#publier();
  }

  disconnectedCallback(): void {
    for (const desabonner of this.#desabonnements) desabonner();
    this.#desabonnements = [];
  }

  #publier(): void {
    this.bus?.publier(
      "filtre:change",
      { statut: this.#statut, responsable: this.#responsable },
      "mf-filtres",
    );
  }

  #groupe(
    titre: string,
    options: readonly { valeur: string; libelle: string }[],
    courant: string,
    choisir: (valeur: string) => void,
  ): HTMLElement {
    const bloc = document.createElement("div");
    bloc.className = "groupe";

    const intitule = document.createElement("h3");
    intitule.textContent = titre;
    intitule.id = `titre-${titre}`;

    const choix = document.createElement("div");
    choix.className = "choix";
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
      }),
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
      ),
    );
  }
}

customElements.define("mf-filtres", MfFiltres);

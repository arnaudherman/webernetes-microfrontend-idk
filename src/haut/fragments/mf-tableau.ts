import type { Bus, Desabonnement } from "../bus";
import type { Contrat } from "../contrat";

/**
 * Fragment « tableau », version 1.0 — trois colonnes par statut.
 *
 * Il déclare ici, et pour lui seul, la forme qu'il attend des charges utiles reçues.
 * Aucun type n'est partagé avec l'émetteur : c'est ce qui rend l'essai 5 possible, et
 * c'est la situation réelle de deux équipes qui livrent séparément.
 */

interface TacheAttendue {
  readonly id: string;
  readonly titre: string;
  readonly statut: string;
  readonly responsable: string;
  readonly echeance: string;
  readonly chargeJours: number;
}

interface FiltreAttendu {
  readonly statut?: string;
  readonly responsable?: string;
}

const COLONNES = [
  { statut: "a-faire", libelle: "à faire" },
  { statut: "en-cours", libelle: "en cours" },
  { statut: "termine", libelle: "terminé" },
] as const;

const STYLE = `
  :host { display: flex; flex-direction: column; height: 100%; }
  .resume {
    flex: 0 0 auto; padding: 6px 12px; border-bottom: 1px solid var(--trait);
    font-family: var(--libelles); font-size: var(--taille-libelle); color: var(--encre-tenue);
  }
  .resume strong { color: var(--encre); }
  .colonnes {
    flex: 1 1 auto; display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 8px; padding: 8px; overflow-y: auto; align-content: start;
  }
  .colonne { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .colonne h3 {
    margin: 0; font-family: var(--libelles); font-size: var(--taille-libelle);
    font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--encre-tenue); border-bottom: 1px solid var(--trait); padding-bottom: 3px;
  }
  .vide { font-family: var(--libelles); font-size: var(--taille-libelle);
          color: var(--encre-tenue); font-style: italic; }
  button.tache {
    display: block; width: 100%; text-align: left; cursor: pointer;
    background: var(--surface); border: 1px solid var(--trait);
    border-left: 3px solid var(--trait-fort); padding: 5px 8px;
  }
  button.tache:hover { border-color: var(--encre-douce); }
  button.tache[aria-pressed="true"] {
    border-color: var(--nominal); border-left-color: var(--nominal);
    background: var(--nominal-voile);
  }
  button.tache:focus-visible { outline: 3px solid var(--nominal); outline-offset: 2px; }
  .identifiant { font-family: var(--donnee); font-size: var(--taille-libelle); color: var(--encre-tenue); }
  .titre { font-family: var(--libelles); font-size: var(--taille-libelle); font-weight: 600;
           color: var(--encre); line-height: 1.3; margin-top: 1px; }
  .pied { display: flex; justify-content: space-between; gap: 6px; margin-top: 3px;
          font-family: var(--donnee); font-size: var(--taille-libelle); color: var(--encre-tenue); }
`;

export class MfTableau extends HTMLElement {
  static readonly contrat: Contrat = {
    nom: "tableau",
    version: "1.0",
    publie: ["tache:selectionnee"],
    consomme: ["filtre:change", "donnees:chargees"],
  };

  bus?: Bus;

  readonly #racine: ShadowRoot;
  #desabonnements: Desabonnement[] = [];
  #taches: TacheAttendue[] = [];
  #filtre: FiltreAttendu = {};
  #selection: string | undefined;

  constructor() {
    super();
    this.#racine = this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    const bus = this.bus;
    if (bus) {
      this.#desabonnements.push(
        bus.abonner("donnees:chargees", "mf-tableau", (charge) => {
          const recu = charge as { taches?: TacheAttendue[] } | undefined;
          this.#taches = recu?.taches ?? [];
          this.#rendre();
        }),
        bus.abonner("filtre:change", "mf-tableau", (charge) => {
          this.#filtre = (charge ?? {}) as FiltreAttendu;
          this.#rendre();
        }),
      );
    }
    this.#rendre();
  }

  disconnectedCallback(): void {
    for (const desabonner of this.#desabonnements) desabonner();
    this.#desabonnements = [];
  }

  /**
   * Le filtrage lit `statut` sur la charge reçue. Si la clé est absente — parce que
   * l'émetteur a livré une version qui publie `etat` — la condition est simplement
   * fausse et le filtre ne s'applique pas. Aucune exception, aucun avertissement :
   * le tableau affiche tout et se croit juste.
   */
  #filtrees(): TacheAttendue[] {
    const { statut, responsable } = this.#filtre;
    return this.#taches.filter((tache) => {
      if (statut && statut !== "tous" && tache.statut !== statut) return false;
      if (responsable && responsable !== "tous" && tache.responsable !== responsable) return false;
      return true;
    });
  }

  #carte(tache: TacheAttendue): HTMLElement {
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "tache";
    bouton.setAttribute("aria-pressed", String(this.#selection === tache.id));

    const identifiant = document.createElement("div");
    identifiant.className = "identifiant";
    identifiant.textContent = tache.id;

    const titre = document.createElement("div");
    titre.className = "titre";
    titre.textContent = tache.titre;

    const pied = document.createElement("div");
    pied.className = "pied";
    const responsable = document.createElement("span");
    responsable.textContent = tache.responsable;
    const charge = document.createElement("span");
    charge.textContent = `${tache.chargeJours} j`;
    pied.append(responsable, charge);

    bouton.append(identifiant, titre, pied);
    bouton.addEventListener("click", () => {
      this.#selection = tache.id;
      this.bus?.publier("tache:selectionnee", tache, "mf-tableau");
      this.#rendre();
    });

    return bouton;
  }

  #rendre(): void {
    const style = document.createElement("style");
    style.textContent = STYLE;

    const affichees = this.#filtrees();

    const resume = document.createElement("p");
    resume.className = "resume";
    resume.innerHTML =
      `<strong>${affichees.length}</strong> tâche${affichees.length > 1 ? "s" : ""} ` +
      `affichée${affichees.length > 1 ? "s" : ""} sur ${this.#taches.length}`;

    const colonnes = document.createElement("div");
    colonnes.className = "colonnes";

    for (const colonne of COLONNES) {
      const bloc = document.createElement("div");
      bloc.className = "colonne";

      const intitule = document.createElement("h3");
      const siennes = affichees.filter((tache) => tache.statut === colonne.statut);
      intitule.textContent = `${colonne.libelle} · ${siennes.length}`;
      bloc.append(intitule);

      if (siennes.length === 0) {
        const vide = document.createElement("p");
        vide.className = "vide";
        vide.textContent = "—";
        bloc.append(vide);
      } else {
        bloc.append(...siennes.map((tache) => this.#carte(tache)));
      }

      colonnes.append(bloc);
    }

    this.#racine.replaceChildren(style, resume, colonnes);
  }
}

customElements.define("mf-tableau", MfTableau);

import type { Bus, Desabonnement } from "../bus";
import type { Contrat } from "../contrat";

/**
 * Fragment « tableau », version 2.0 — même contrat, rendu entièrement différent.
 *
 * Là où la 1.0 dispose trois colonnes par statut, celle-ci présente une liste dense
 * triée par échéance. Rien d'autre ne change : mêmes événements consommés, même
 * événement publié, même forme de charge utile.
 *
 * C'est précisément parce que le contrat est respecté que la substitution tient. Le
 * shell ne connaît de ce fragment que son nom de balise ; il ne sait pas, et n'a pas
 * à savoir, que le rendu a changé du tout au tout.
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

const LIBELLE_STATUT: Record<string, string> = {
  "a-faire": "à faire",
  "en-cours": "en cours",
  termine: "terminé",
};

const STYLE = `
  :host { display: flex; flex-direction: column; height: 100%; }
  .resume {
    flex: 0 0 auto; padding: 6px 12px; border-bottom: 1px solid var(--trait);
    font-family: var(--libelles); font-size: var(--taille-libelle); color: var(--encre-tenue);
  }
  .resume strong { color: var(--encre); }
  .liste { flex: 1 1 auto; overflow-y: auto; }
  .entete, button.rangee {
    display: grid; width: 100%;
    grid-template-columns: 48px minmax(0, 1fr) 78px 96px 92px 44px;
    gap: 8px; align-items: baseline; text-align: left;
    padding: 4px 12px;
  }
  .entete {
    position: sticky; top: 0; background: var(--fond-creux);
    border-bottom: 1px solid var(--trait);
    font-family: var(--libelles); font-size: var(--taille-libelle); font-weight: 700;
    letter-spacing: 0.05em; text-transform: uppercase; color: var(--encre-tenue);
  }
  button.rangee {
    background: var(--surface); border: 0; border-bottom: 1px solid var(--trait);
    cursor: pointer; font-family: var(--donnee); font-size: var(--taille-libelle);
    color: var(--encre);
  }
  button.rangee:hover { background: var(--fond-creux); }
  button.rangee[aria-pressed="true"] { background: var(--nominal-voile); box-shadow: inset 3px 0 0 var(--nominal); }
  button.rangee:focus-visible { outline: 3px solid var(--nominal); outline-offset: -3px; }
  .titre { font-family: var(--libelles); font-weight: 600; overflow: hidden;
           text-overflow: ellipsis; white-space: nowrap; }
  .discret { color: var(--encre-tenue); }
  .charge { text-align: right; }
  .vide { padding: 12px; font-family: var(--libelles); font-size: var(--taille-libelle);
          color: var(--encre-tenue); font-style: italic; }
`;

export class MfTableauV2 extends HTMLElement {
  static readonly contrat: Contrat = {
    nom: "tableau",
    version: "2.0",
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

  #filtrees(): TacheAttendue[] {
    const { statut, responsable } = this.#filtre;
    return this.#taches
      .filter((tache) => {
        if (statut && statut !== "tous" && tache.statut !== statut) return false;
        if (responsable && responsable !== "tous" && tache.responsable !== responsable) return false;
        return true;
      })
      .sort((a, b) => a.echeance.localeCompare(b.echeance));
  }

  #cellule(classe: string, texte: string): HTMLElement {
    const element = document.createElement("span");
    element.className = classe;
    element.textContent = texte;
    return element;
  }

  #rangee(tache: TacheAttendue): HTMLElement {
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "rangee";
    bouton.setAttribute("aria-pressed", String(this.#selection === tache.id));
    bouton.append(
      this.#cellule("discret", tache.id),
      this.#cellule("titre", tache.titre),
      this.#cellule("discret", LIBELLE_STATUT[tache.statut] ?? tache.statut),
      this.#cellule("", tache.responsable),
      this.#cellule("discret", tache.echeance),
      this.#cellule("charge", `${tache.chargeJours} j`),
    );
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
      `affichée${affichees.length > 1 ? "s" : ""} sur ${this.#taches.length} · triées par échéance`;

    const liste = document.createElement("div");
    liste.className = "liste";

    const entete = document.createElement("div");
    entete.className = "entete";
    entete.append(
      this.#cellule("", "id"),
      this.#cellule("", "tâche"),
      this.#cellule("", "statut"),
      this.#cellule("", "responsable"),
      this.#cellule("", "échéance"),
      this.#cellule("charge", "j"),
    );
    liste.append(entete);

    if (affichees.length === 0) {
      const vide = document.createElement("p");
      vide.className = "vide";
      vide.textContent = "aucune tâche ne correspond au filtre";
      liste.append(vide);
    } else {
      liste.append(...affichees.map((tache) => this.#rangee(tache)));
    }

    this.#racine.replaceChildren(style, resume, liste);
  }
}

customElements.define("mf-tableau-v2", MfTableauV2);

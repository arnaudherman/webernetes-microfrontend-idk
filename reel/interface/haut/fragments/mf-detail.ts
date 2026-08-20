import type { Bus, Desabonnement } from "../bus";
import type { Contrat } from "../contrat";

/**
 * Fragment « détail ».
 *
 * Il ne publie rien et ne consomme qu'un seul événement. C'est le fragment le plus
 * simple du lot, et c'est pour cela qu'il sert aux essais 6 et 7 : le démonter ne
 * casse rien, et le remonter le fait repartir vide.
 *
 * Il ne conserve aucun état hors du document. Quand il revient, il ne sait rien de ce
 * qui a été publié pendant son absence, parce que le bus ne rejoue jamais rien. Ce
 * n'est pas un défaut de ce fragment : c'est une propriété du bus, et un choix
 * d'architecture qui doit être documenté plutôt que subi.
 */

interface TacheAttendue {
  readonly id: string;
  readonly titre: string;
  readonly statut: string;
  readonly responsable: string;
  readonly echeance: string;
  readonly chargeJours: number;
}

const LIBELLE_STATUT: Record<string, string> = {
  "a-faire": "à faire",
  "en-cours": "en cours",
  termine: "terminé",
};

const STYLE = `
  :host { display: block; height: 100%; overflow-y: auto; }
  .vide {
    padding: 14px 12px; font-family: var(--texte); font-size: var(--taille-corps);
    color: var(--encre-tenue); line-height: 1.45;
  }
  .vide code { font-family: var(--donnee); font-size: var(--taille-libelle); color: var(--encre-douce); }
  .fiche { padding: 10px 12px; }
  .fiche h3 {
    margin: 0 0 8px; font-family: var(--libelles); font-size: var(--taille-corps);
    font-weight: 700; line-height: 1.3; color: var(--encre);
  }
  dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; }
  dt {
    font-family: var(--libelles); font-size: var(--taille-libelle); font-weight: 600;
    letter-spacing: 0.05em; text-transform: uppercase; color: var(--encre-tenue);
  }
  dd { margin: 0; font-family: var(--donnee); font-size: var(--taille-donnee); color: var(--encre); }
`;

export class MfDetail extends HTMLElement {
  static readonly contrat: Contrat = {
    nom: "detail",
    version: "1.0",
    publie: [],
    consomme: ["tache:selectionnee"],
  };

  bus?: Bus;

  readonly #racine: ShadowRoot;
  #desabonnements: Desabonnement[] = [];
  #tache: TacheAttendue | undefined;

  constructor() {
    super();
    this.#racine = this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    const bus = this.bus;
    if (bus) {
      this.#desabonnements.push(
        bus.abonner("tache:selectionnee", "mf-detail", (charge) => {
          this.#tache = charge as TacheAttendue | undefined;
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

  #ligne(libelle: string, valeur: string): HTMLElement[] {
    const terme = document.createElement("dt");
    terme.textContent = libelle;
    const definition = document.createElement("dd");
    definition.textContent = valeur;
    return [terme, definition];
  }

  #rendre(): void {
    const style = document.createElement("style");
    style.textContent = STYLE;

    if (!this.#tache) {
      const vide = document.createElement("p");
      vide.className = "vide";
      vide.innerHTML =
        "Aucune tâche sélectionnée. Ce fragment démarre aveugle : il attend un " +
        "<code>tache:selectionnee</code> et le bus ne rejoue pas ceux qui ont déjà eu lieu.";
      this.#racine.replaceChildren(style, vide);
      return;
    }

    const fiche = document.createElement("div");
    fiche.className = "fiche";

    const titre = document.createElement("h3");
    titre.textContent = this.#tache.titre;

    const liste = document.createElement("dl");
    liste.append(
      ...this.#ligne("identifiant", this.#tache.id),
      ...this.#ligne("statut", LIBELLE_STATUT[this.#tache.statut] ?? this.#tache.statut),
      ...this.#ligne("responsable", this.#tache.responsable),
      ...this.#ligne("échéance", this.#tache.echeance),
      ...this.#ligne("charge", `${this.#tache.chargeJours} jours`),
    );

    fiche.append(titre, liste);
    this.#racine.replaceChildren(style, fiche);
  }
}

customElements.define("mf-detail", MfDetail);

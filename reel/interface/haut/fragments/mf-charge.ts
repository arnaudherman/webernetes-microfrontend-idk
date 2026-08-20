import type { Bus, Desabonnement } from "../bus";
import type { Contrat } from "../contrat";

/**
 * Fragment « charge ».
 *
 * Il n'agrège rien lui-même : l'agrégat par responsable est calculé en amont et
 * arrive déjà constitué dans la charge utile. Ce fragment ne fait que découper cet
 * agrégat selon le filtre courant. C'est vérifiable à l'écran — le pied de module
 * affiche quel calculateur a produit les chiffres.
 */

interface Cumul {
  readonly nbTaches: number;
  readonly chargeJours: number;
}

interface ChargeAttendue {
  readonly responsable: string;
  readonly nbTaches: number;
  readonly chargeJours: number;
  readonly parStatut?: Record<string, Cumul>;
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
  .portee {
    flex: 0 0 auto; padding: 6px 12px; border-bottom: 1px solid var(--trait);
    font-family: var(--libelles); font-size: var(--taille-libelle); color: var(--encre-tenue);
  }
  .portee strong { color: var(--encre); }
  .barres { flex: 1 1 auto; overflow-y: auto; padding: 10px 12px; display: flex;
            flex-direction: column; gap: 10px; }
  .rangee { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; align-items: baseline; }
  .nom { font-family: var(--libelles); font-size: var(--taille-libelle); font-weight: 600;
         color: var(--encre); }
  .valeur { font-family: var(--donnee); font-size: var(--taille-donnee); color: var(--encre); }
  .piste { grid-column: 1 / -1; height: 12px; background: var(--fond-creux);
           border: 1px solid var(--trait); }
  .remplissage { height: 100%; background: var(--nominal); }
  .detail { grid-column: 1 / -1; font-family: var(--donnee); font-size: var(--taille-libelle);
            color: var(--encre-tenue); }
  .pied { flex: 0 0 auto; padding: 5px 12px; border-top: 1px solid var(--trait);
          font-family: var(--donnee); font-size: var(--taille-libelle); color: var(--encre-tenue);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .vide { padding: 14px 12px; font-family: var(--texte); font-size: var(--taille-corps);
          color: var(--encre-tenue); }
`;

export class MfCharge extends HTMLElement {
  static readonly contrat: Contrat = {
    nom: "charge",
    version: "1.0",
    publie: [],
    consomme: ["filtre:change", "donnees:chargees"],
  };

  bus?: Bus;

  readonly #racine: ShadowRoot;
  #desabonnements: Desabonnement[] = [];
  #charges: ChargeAttendue[] = [];
  #agregePar: string | undefined;
  #filtre: FiltreAttendu = {};

  constructor() {
    super();
    this.#racine = this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    const bus = this.bus;
    if (bus) {
      this.#desabonnements.push(
        bus.abonner("donnees:chargees", "mf-charge", (charge) => {
          const recu = charge as
            | { charges?: ChargeAttendue[]; meta?: { agrege_par?: string } }
            | undefined;
          this.#charges = recu?.charges ?? [];
          this.#agregePar = recu?.meta?.agrege_par;
          this.#rendre();
        }),
        bus.abonner("filtre:change", "mf-charge", (charge) => {
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

  #retenues(): { responsable: string; jours: number; taches: number }[] {
    const { statut, responsable } = this.#filtre;
    const parStatut = statut !== undefined && statut !== "tous" ? statut : undefined;

    return this.#charges
      .filter((ligne) => !responsable || responsable === "tous" || ligne.responsable === responsable)
      .map((ligne) => {
        const tranche = parStatut ? ligne.parStatut?.[parStatut] : undefined;
        return {
          responsable: ligne.responsable,
          jours: parStatut ? (tranche?.chargeJours ?? 0) : ligne.chargeJours,
          taches: parStatut ? (tranche?.nbTaches ?? 0) : ligne.nbTaches,
        };
      })
      .sort((a, b) => b.jours - a.jours);
  }

  #rendre(): void {
    const style = document.createElement("style");
    style.textContent = STYLE;

    if (this.#charges.length === 0) {
      const vide = document.createElement("p");
      vide.className = "vide";
      vide.textContent = "En attente de l'agrégat.";
      this.#racine.replaceChildren(style, vide);
      return;
    }

    const { statut } = this.#filtre;
    const portee = document.createElement("p");
    portee.className = "portee";
    portee.innerHTML =
      statut && statut !== "tous"
        ? `charge <strong>${LIBELLE_STATUT[statut] ?? statut}</strong>, en jours`
        : "charge <strong>totale</strong>, en jours";

    const retenues = this.#retenues();
    const maximum = Math.max(1, ...retenues.map((ligne) => ligne.jours));

    const barres = document.createElement("div");
    barres.className = "barres";

    for (const ligne of retenues) {
      const rangee = document.createElement("div");
      rangee.className = "rangee";

      const nom = document.createElement("span");
      nom.className = "nom";
      nom.textContent = ligne.responsable;

      const valeur = document.createElement("span");
      valeur.className = "valeur";
      valeur.textContent = `${ligne.jours} j`;

      const piste = document.createElement("div");
      piste.className = "piste";
      piste.setAttribute("role", "img");
      piste.setAttribute(
        "aria-label",
        `${ligne.responsable} : ${ligne.jours} jours sur ${ligne.taches} tâches`,
      );
      const remplissage = document.createElement("div");
      remplissage.className = "remplissage";
      remplissage.style.width = `${Math.round((ligne.jours / maximum) * 100)}%`;
      piste.append(remplissage);

      const detail = document.createElement("span");
      detail.className = "detail";
      detail.textContent = `${ligne.taches} tâche${ligne.taches > 1 ? "s" : ""}`;

      rangee.append(nom, valeur, piste, detail);
      barres.append(rangee);
    }

    const pied = document.createElement("p");
    pied.className = "pied";
    pied.textContent = this.#agregePar
      ? `agrégat calculé en amont · ${this.#agregePar}`
      : "agrégat calculé en amont";

    this.#racine.replaceChildren(style, portee, barres, pied);
  }
}

customElements.define("mf-charge", MfCharge);

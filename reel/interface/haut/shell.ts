import type { Bus } from "./bus";
import { contratDe, type Fragment } from "./contrat";

/**
 * Le shell.
 *
 * Il ne connaît des fragments que leurs noms de balise. Il les instancie, leur injecte
 * le bus, et affiche le contrat qu'ils déclarent. Il n'importe le code d'aucun d'eux,
 * ne connaît ni leur état ni leur rendu, et ne peut pas atteindre leur DOM : chaque
 * fragment vit derrière son propre Shadow DOM.
 *
 * C'est ce qui rend l'essai 8 possible : remplacer une implémentation par une autre
 * ne demande au shell que de changer un nom de balise.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI LE CHROME VISUEL EST INJECTÉ, ET PAS IMPORTÉ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ce fichier vit sous `reel/` : c'est ce qui tournerait si le shell était monté en
 * production, sans salle ni public. Le rendu de la carte de module (affichage du
 * contrat, marqueurs monté/démonté) est un artefact de démonstration — voir
 * `demo/frontend/haut/cadre-module.ts`. Un shell réel ne dessine rien ; il monte des
 * fragments et laisse quelque chose d'autre décider de ce qui se voit à l'écran.
 *
 * `creerEmplacement` est donc un paramètre, pas un import. Sans lui, `Shell` reste
 * entièrement fonctionnel — déclarer, monter, démonter, remplacer, positions — sur un
 * simple `<div>` sans aucun chrome. `demo/frontend/main.ts` est le seul endroit qui
 * lui passe `creerCadre`.
 */

/**
 * Ce que le shell attend d'un emplacement visuel. `Cadre` (dans `cadre-module.ts`, côté
 * démo) a exactement cette forme et la satisfait par typage structurel — sans qu'aucun
 * import ne traverse la frontière réel → démo.
 */
interface EmplacementVisuel {
  readonly racine: HTMLElement;
  readonly hote: HTMLElement;
  afficherContrat(contrat: import("./contrat").Contrat): void;
  marquerDemonte(nomBalise: string): void;
  marquerMonte(): void;
}

type CreerEmplacement = (cle: string) => EmplacementVisuel;

/** Emplacement nu : un `<div>` sans chrome, méthodes no-op. Le shell reste utilisable seul. */
const EMPLACEMENT_NU: CreerEmplacement = (cle) => {
  const racine = document.createElement("div");
  racine.dataset["module"] = cle;
  return {
    racine,
    hote: racine,
    afficherContrat() {},
    marquerDemonte() {},
    marquerMonte() {},
  };
};

interface Emplacement {
  readonly cle: string;
  readonly cadre: EmplacementVisuel;
  nomBalise: string;
  element?: Fragment;
}

export class Shell {
  readonly #conteneur: HTMLElement;
  readonly #bus: Bus;
  readonly #creerEmplacement: CreerEmplacement;
  readonly #emplacements = new Map<string, Emplacement>();

  constructor(conteneur: HTMLElement, bus: Bus, creerEmplacement: CreerEmplacement = EMPLACEMENT_NU) {
    this.#conteneur = conteneur;
    this.#bus = bus;
    this.#creerEmplacement = creerEmplacement;
  }

  /**
   * Déclare un emplacement sans y monter quoi que ce soit. Déclarer et monter sont
   * deux gestes distincts, parce que l'ORDRE de montage est une décision
   * d'architecture : le bus ne rejoue rien, un consommateur monté après une
   * publication l'a définitivement manquée.
   */
  declarer(cle: string, nomBalise: string): void {
    const cadre = this.#creerEmplacement(cle);
    const emplacement: Emplacement = { cle, cadre, nomBalise };
    this.#emplacements.set(cle, emplacement);
    this.#conteneur.append(cadre.racine);

    const contrat = contratDe(nomBalise);
    if (!contrat) throw new Error(`Aucun contrat déclaré par <${nomBalise}>.`);
    cadre.afficherContrat(contrat);
    cadre.marquerDemonte(nomBalise);
  }

  clesDeclarees(): readonly string[] {
    return [...this.#emplacements.keys()];
  }

  monter(cle: string): void {
    const emplacement = this.#emplacements.get(cle);
    if (!emplacement || emplacement.element) return;

    const contrat = contratDe(emplacement.nomBalise);
    if (!contrat) throw new Error(`Aucun contrat déclaré par <${emplacement.nomBalise}>.`);

    const element = document.createElement(emplacement.nomBalise) as Fragment;
    // Le bus est injecté avant l'insertion : le fragment le trouve dès son
    // connectedCallback et n'a jamais à aller le chercher lui-même.
    element.bus = this.#bus;

    emplacement.element = element;
    emplacement.cadre.afficherContrat(contrat);
    emplacement.cadre.hote.replaceChildren(element);
    emplacement.cadre.marquerMonte();
  }

  /**
   * Retire le fragment du document. Son `disconnectedCallback` se désabonne du bus.
   * Aucun autre fragment n'est prévenu, et le bus ne signale rien : les messages qui
   * lui étaient destinés partiront désormais vers zéro abonné.
   */
  demonter(cle: string): void {
    const emplacement = this.#emplacements.get(cle);
    if (!emplacement?.element) return;
    emplacement.element.remove();
    emplacement.element = undefined;
    emplacement.cadre.marquerDemonte(emplacement.nomBalise);
  }

  /** Remplace l'implémentation d'un emplacement par une autre balise. */
  remplacer(cle: string, nomBalise: string): void {
    const emplacement = this.#emplacements.get(cle);
    if (!emplacement) return;
    const etaitMonte = emplacement.element !== undefined;
    if (etaitMonte) this.demonter(cle);
    emplacement.nomBalise = nomBalise;
    if (etaitMonte) this.monter(cle);
  }

  estMonte(cle: string): boolean {
    return this.#emplacements.get(cle)?.element !== undefined;
  }

  nomBaliseDe(cle: string): string | undefined {
    return this.#emplacements.get(cle)?.nomBalise;
  }

  /** Position horizontale du centre de chaque module, pour le rail du bus. */
  positions(): Map<string, DOMRect> {
    const positions = new Map<string, DOMRect>();
    for (const [cle, emplacement] of this.#emplacements) {
      positions.set(cle, emplacement.cadre.racine.getBoundingClientRect());
    }
    return positions;
  }
}

import type { Bus } from "./bus";
import { creerCadre, type Cadre } from "./cadre-module";
import { contratDe, type Fragment } from "./contrat";

/**
 * Le shell.
 *
 * Il ne connaît des fragments que leurs noms de balise. Il les instancie, leur injecte
 * le bus, et affiche le contrat qu'ils déclarent. Il n'importe le code d'aucun d'eux,
 * ne connaît ni leur état ni leur rendu, et ne peut pas atteindre leur DOM : chaque
 * fragment vit derrière son propre Shadow DOM.
 *
 * C'est ce qui rend l'essai 6 possible : remplacer une implémentation par une autre
 * ne demande au shell que de changer un nom de balise.
 */

interface Emplacement {
  readonly cle: string;
  readonly cadre: Cadre;
  nomBalise: string;
  element?: Fragment;
}

export class Shell {
  readonly #conteneur: HTMLElement;
  readonly #bus: Bus;
  readonly #emplacements = new Map<string, Emplacement>();

  constructor(conteneur: HTMLElement, bus: Bus) {
    this.#conteneur = conteneur;
    this.#bus = bus;
  }

  /**
   * Déclare un emplacement sans y monter quoi que ce soit. Déclarer et monter sont
   * deux gestes distincts, parce que l'ORDRE de montage est une décision
   * d'architecture : le bus ne rejoue rien, un consommateur monté après une
   * publication l'a définitivement manquée.
   */
  declarer(cle: string, nomBalise: string): void {
    const cadre = creerCadre(cle);
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

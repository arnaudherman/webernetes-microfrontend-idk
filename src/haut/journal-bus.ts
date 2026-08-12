import type { Trace } from "./bus";

/**
 * Journal du bus.
 *
 * Il consigne ce que le bus sait, et le bus ne sait pas grand-chose : quel événement,
 * émis par qui, remis à combien d'abonnés, avec quelle charge utile. Il n'y a ni code
 * d'état, ni durée, ni chaîne d'acheminement, ni réessai — non par paresse, mais
 * parce que rien de tout cela n'existe.
 *
 * Ce journal n'est jamais fusionné avec celui du cluster.
 *
 * Une ligne « 0 abonné » n'est pas peinte en rouge. Ce n'est pas une erreur : c'est un
 * fait, et personne dans le système ne le considère comme anormal. Lui donner
 * l'apparence d'une alerte serait prêter au bus une vigilance qu'il n'a pas.
 */

export interface LigneBus {
  readonly cle: string;
  readonly horodatage: number;
  readonly evenement: string;
  readonly source: string;
  readonly abonnes: readonly string[];
  readonly charge: string;
}

const PLAFOND = 300;
const LONGUEUR_CHARGE = 150;

const lignes: LigneBus[] = [];
const observateurs = new Set<(lignes: readonly LigneBus[]) => void>();

let compteurCle = 0;
let publies = 0;
let perdus = 0;

export function journalBus(): readonly LigneBus[] {
  return lignes;
}

/** Messages publiés depuis le chargement de la page. */
export function messagesPublies(): number {
  return publies;
}

/** Messages partis vers zéro abonné. Aucun d'eux n'a produit le moindre signal. */
export function messagesPerdus(): number {
  return perdus;
}

export function observerJournalBus(
  observateur: (lignes: readonly LigneBus[]) => void,
): () => void {
  observateurs.add(observateur);
  observateur(lignes);
  return () => observateurs.delete(observateur);
}

function serialiser(charge: unknown): string {
  let texte: string;
  try {
    texte = JSON.stringify(charge) ?? String(charge);
  } catch {
    return "[charge non sérialisable]";
  }
  if (texte.length <= LONGUEUR_CHARGE) return texte;
  return `${texte.slice(0, LONGUEUR_CHARGE)}… (${texte.length} caractères)`;
}

/** Le traceur remis au bus par le shell. */
export function tracer(trace: Trace): void {
  compteurCle += 1;
  publies += 1;
  if (trace.abonnes.length === 0) perdus += 1;

  lignes.push({
    cle: `b${compteurCle}`,
    horodatage: trace.horodatage,
    evenement: trace.evenement,
    source: trace.source,
    abonnes: trace.abonnes,
    charge: serialiser(trace.charge),
  });

  if (lignes.length > PLAFOND) lignes.splice(0, lignes.length - PLAFOND);
  for (const observateur of observateurs) observateur(lignes);
}

/* ------------------------------------------------------------------ rendu ---- */

function heure(horodatage: number): string {
  const date = new Date(horodatage);
  const deuxChiffres = (valeur: number, taille = 2) => String(valeur).padStart(taille, "0");
  return (
    `${deuxChiffres(date.getHours())}:${deuxChiffres(date.getMinutes())}:` +
    `${deuxChiffres(date.getSeconds())}.${deuxChiffres(date.getMilliseconds(), 3)}`
  );
}

function cellule(classe: string, texte: string): HTMLElement {
  const element = document.createElement("span");
  element.className = classe;
  element.textContent = texte;
  return element;
}

function ligneJournal(ligne: LigneBus): HTMLLIElement {
  const element = document.createElement("li");
  element.className = "ligne ligne-message";
  element.dataset["cle"] = ligne.cle;

  const abonnes = cellule(
    "abonnes",
    ligne.abonnes.length === 0
      ? "0 abonné"
      : `${ligne.abonnes.length} abonné${ligne.abonnes.length > 1 ? "s" : ""} · ${ligne.abonnes.join(", ")}`,
  );
  if (ligne.abonnes.length === 0) abonnes.dataset["perdu"] = "oui";

  element.append(
    cellule("heure", heure(ligne.horodatage)),
    cellule("evenement-nom", ligne.evenement),
    cellule("source", `← ${ligne.source}`),
    abonnes,
    cellule("charge-utile", ligne.charge),
  );

  return element;
}

export function rendreJournalBus(hote: HTMLElement): () => void {
  const entete = document.createElement("header");
  entete.className = "journal-tete";
  const titre = document.createElement("h2");
  titre.className = "titre-zone";
  titre.textContent = "journal du bus";
  const legende = document.createElement("p");
  legende.className = "journal-legende";
  legende.textContent = "horodatage · événement · source · abonnés atteints · charge utile";
  entete.append(titre, legende);

  const liste = document.createElement("ol");
  liste.className = "journal-lignes donnee";
  liste.setAttribute("aria-live", "off");

  hote.replaceChildren(entete, liste);

  let derniereCle: string | undefined;

  return observerJournalBus((toutes) => {
    if (toutes.length === 0) {
      liste.replaceChildren();
      derniereCle = undefined;
      return;
    }

    const depuis = derniereCle ? toutes.findIndex((ligne) => ligne.cle === derniereCle) + 1 : 0;
    const enBas = liste.scrollTop + liste.clientHeight >= liste.scrollHeight - 24;

    for (const ligne of toutes.slice(depuis)) liste.append(ligneJournal(ligne));
    while (liste.childElementCount > PLAFOND) liste.firstElementChild?.remove();

    derniereCle = toutes.at(-1)?.cle;
    if (enBas) liste.scrollTop = liste.scrollHeight;
  });
}

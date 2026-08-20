import { observerJournalBus, PLAFOND, type LigneBus } from "../../../reel/interface/haut/journal-bus";

/**
 * Rendu à l'écran du journal du bus.
 *
 * Consomme `observerJournalBus` (réel) sans qu'aucune ligne de `journal-bus.ts` ne
 * connaisse l'existence de cet écran. Une ligne « 0 abonné » n'est pas peinte en
 * rouge ici non plus : ce n'est pas une erreur, c'est un fait, et lui donner
 * l'apparence d'une alerte prêterait au bus une vigilance qu'il n'a pas.
 */

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

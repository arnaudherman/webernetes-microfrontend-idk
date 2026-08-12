import { nombreTraversees, observerTraversee } from "./passerelle";

/**
 * La frontière.
 *
 * Une ligne en travers de la page, étiquetée des deux côtés, avec le point de
 * traversée matérialisé dessus. Ce point est le seul endroit du dépôt où une donnée
 * passe du cluster à l'interface : il s'illumine pendant toute la durée de l'appel,
 * et vire à la couleur de panne si l'appel échoue ou revient en erreur.
 */

const ETIQUETTE_HAUT = "modularité de l'interface · micro-frontends · sujet de l'étude";
const ETIQUETTE_BAS = "modularité serveur · simulée par Webernetes · hors sujet de l'étude";

export function rendreFrontiere(hote: HTMLElement): () => void {
  hote.classList.add("frontiere");

  const haut = document.createElement("p");
  haut.className = "frontiere-etiquette frontiere-etiquette-haut";
  haut.textContent = ETIQUETTE_HAUT;

  const bas = document.createElement("p");
  bas.className = "frontiere-etiquette frontiere-etiquette-bas";
  bas.textContent = ETIQUETTE_BAS;

  const point = document.createElement("div");
  point.className = "frontiere-point";

  const pastille = document.createElement("span");
  pastille.className = "frontiere-pastille";
  pastille.setAttribute("aria-hidden", "true");

  const appel = document.createElement("code");
  appel.className = "frontiere-appel donnee";
  appel.textContent = 'cluster.fetch("http://node-1:31000")';

  const compteur = document.createElement("span");
  compteur.className = "frontiere-compteur donnee";
  compteur.textContent = "0 traversée";

  const annonce = document.createElement("p");
  annonce.className = "hors-ecran";
  annonce.setAttribute("role", "status");

  point.append(pastille, appel, compteur);

  const ligne = document.createElement("div");
  ligne.className = "frontiere-ligne";
  ligne.append(point);

  hote.replaceChildren(haut, ligne, bas, annonce);

  let enVol = 0;

  const detacher = observerTraversee((evenement) => {
    if (evenement.phase === "depart") {
      enVol += 1;
      point.dataset["etat"] = "en-vol";
      return;
    }

    enVol = Math.max(0, enVol - 1);
    const enErreur = evenement.erreur !== undefined || (evenement.status ?? 0) >= 400;

    if (enVol === 0) {
      point.dataset["etat"] = enErreur ? "panne" : "repos";
    }

    const total = nombreTraversees();
    compteur.textContent = `${total} traversée${total > 1 ? "s" : ""}`;

    annonce.textContent = enErreur
      ? `traversée en erreur : ${evenement.erreur ?? evenement.status}`
      : `traversée ${evenement.status} en ${Math.round(evenement.dureeMs ?? 0)} millisecondes`;
  });

  point.dataset["etat"] = "repos";
  return detacher;
}

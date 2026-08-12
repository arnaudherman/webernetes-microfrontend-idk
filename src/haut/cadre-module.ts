import type { Contrat } from "./contrat";

/**
 * Le cadre d'un module.
 *
 * Mobilier du shell, pas micro-frontend : il porte à l'écran le contrat déclaré par
 * le fragment qu'il héberge, et l'emplacement où ce fragment est monté. Le contrat
 * doit être lisible en projection, c'est un objet d'architecture.
 */

export interface Cadre {
  readonly racine: HTMLElement;
  readonly hote: HTMLElement;
  afficherContrat(contrat: Contrat): void;
  marquerDemonte(nomBalise: string): void;
  marquerMonte(): void;
}

function jeton(classe: string, texte: string): HTMLElement {
  const element = document.createElement("span");
  element.className = classe;
  element.textContent = texte;
  return element;
}

export function creerCadre(cle: string): Cadre {
  const racine = document.createElement("section");
  racine.className = "module";
  racine.dataset["module"] = cle;

  const entete = document.createElement("header");
  entete.className = "module-tete";

  const identite = document.createElement("p");
  identite.className = "module-identite donnee";

  const flux = document.createElement("dl");
  flux.className = "module-contrat donnee";

  entete.append(identite, flux);

  const hote = document.createElement("div");
  hote.className = "module-hote";

  racine.append(entete, hote);

  function ligneFlux(libelle: string, evenements: readonly string[], sens: string): HTMLElement[] {
    const terme = document.createElement("dt");
    terme.textContent = libelle;
    const definition = document.createElement("dd");
    if (evenements.length === 0) {
      definition.append(jeton("evenement-neant", "rien"));
    } else {
      for (const evenement of evenements) {
        definition.append(jeton(`evenement evenement-${sens}`, evenement));
      }
    }
    return [terme, definition];
  }

  return {
    racine,
    hote,

    afficherContrat(contrat) {
      identite.textContent = `${contrat.nom}:${contrat.version}`;
      flux.replaceChildren(
        ...ligneFlux("publie", contrat.publie, "sortant"),
        ...ligneFlux("consomme", contrat.consomme, "entrant"),
      );
    },

    marquerDemonte(nomBalise) {
      racine.dataset["etat"] = "demonte";
      const message = document.createElement("p");
      message.className = "module-demonte";
      message.textContent = `<${nomBalise}> est démonté. Le shell n'en sait rien de plus.`;
      hote.replaceChildren(message);
    },

    marquerMonte() {
      racine.dataset["etat"] = "monte";
    },
  };
}

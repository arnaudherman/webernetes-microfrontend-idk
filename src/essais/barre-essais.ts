import {
  armerPanneServeur,
  panneServeurArmee,
  retablirServeur,
  supprimerUnPodTaches,
} from "../bas/essais-bas";
import type { Bus } from "../haut/bus";
import {
  basculerContratFront,
  basculerImplementationTableau,
  contratFrontRompu,
  demonterDetail,
  detailEstMonte,
  remonterDetail,
  tableauEnV2,
} from "../haut/essais-haut";
import type { Rail } from "../haut/rail";
import type { Shell } from "../haut/shell";
import { chargerDonnees } from "../frontiere/passerelle";
import { declarerContratFrontRompu } from "../synthese/compteurs";
import * as textes from "./observations";

/**
 * La barre d'essais.
 *
 * Fixée en bas de fenêtre, elle reste atteignable quelle que soit la position de
 * défilement : l'enchaînement essai 5 puis essai 2 doit pouvoir se jouer sans
 * rechargement et sans faire défiler la page. C'est la comparaison décisive.
 *
 * Ce module est l'un des trois autorisés à voir les deux moitiés. Il ne fait que
 * déclencher : aucune donnée ne le traverse.
 */

export interface ContexteEssais {
  readonly bus: Bus;
  readonly shell: Shell;
  readonly rail?: Rail;
}

interface DefinitionEssai {
  readonly numero: number;
  readonly cote: "bas" | "haut";
  libelle(contexte: ContexteEssais): string;
  arme?(contexte: ContexteEssais): boolean;
  actif?(contexte: ContexteEssais): boolean;
  jouer(contexte: ContexteEssais): Promise<textes.Observation> | textes.Observation;
}

let panneArmee = false;

const ESSAIS: DefinitionEssai[] = [
  {
    numero: 1,
    cote: "bas",
    libelle: () => "supprimer un pod taches",
    async jouer() {
      const { nom, noeud } = await supprimerUnPodTaches();
      return textes.suppressionPod(nom, noeud);
    },
  },
  {
    numero: 2,
    cote: "bas",
    libelle: () => (panneArmee ? "rétablir le contrat serveur" : "casser le contrat serveur"),
    arme: () => panneArmee,
    async jouer(contexte) {
      if (panneArmee) {
        await retablirServeur();
      } else {
        await armerPanneServeur();
      }
      panneArmee = await panneServeurArmee();
      // On redemande les données : c'est le shell qui découvre la panne, comme il le
      // ferait à n'importe quel rafraîchissement.
      await chargerDonnees(contexte.bus);
      return panneArmee ? textes.CONTRAT_SERVEUR_ROMPU : textes.CONTRAT_SERVEUR_RETABLI;
    },
  },
  {
    numero: 3,
    cote: "haut",
    libelle: () => "démonter mf-detail",
    actif: (contexte) => detailEstMonte(contexte.shell),
    jouer(contexte) {
      demonterDetail(contexte.shell);
      contexte.rail?.repositionner();
      return textes.FRAGMENT_DEMONTE;
    },
  },
  {
    numero: 4,
    cote: "haut",
    libelle: () => "remonter mf-detail",
    actif: (contexte) => !detailEstMonte(contexte.shell),
    jouer(contexte) {
      remonterDetail(contexte.shell);
      contexte.rail?.repositionner();
      return textes.FRAGMENT_REMONTE;
    },
  },
  {
    numero: 5,
    cote: "haut",
    libelle: (contexte) =>
      contratFrontRompu(contexte.shell) ? "rétablir le contrat front" : "casser le contrat front",
    arme: (contexte) => contratFrontRompu(contexte.shell),
    jouer(contexte) {
      const rompu = basculerContratFront(contexte.shell);
      contexte.rail?.repositionner();
      // Ce compteur n'est pas une détection : c'est l'opérateur qui sait ce qu'il
      // vient de faire. Rien dans le système n'aurait pu le lui apprendre.
      if (rompu) declarerContratFrontRompu();
      return rompu ? textes.CONTRAT_FRONT_ROMPU : textes.CONTRAT_FRONT_RETABLI;
    },
  },
  {
    numero: 6,
    cote: "haut",
    libelle: (contexte) =>
      tableauEnV2(contexte.shell) ? "revenir à mf-tableau 1.0" : "remplacer mf-tableau par 2.0",
    async jouer(contexte) {
      const enV2 = basculerImplementationTableau(contexte.shell);
      contexte.rail?.repositionner();
      // Le fragment neuf arrive vide : le bus ne rejoue rien. Il faut redemander les
      // données au cluster pour le peupler.
      await chargerDonnees(contexte.bus);
      return enV2 ? textes.TABLEAU_REMPLACE : textes.TABLEAU_RESTAURE;
    },
  },
];

export function rendreBarreEssais(hote: HTMLElement, contexte: ContexteEssais): () => void {
  hote.classList.add("barre-essais");

  const boutons = new Map<number, HTMLButtonElement>();
  let occupee = false;

  const zoneObservation = document.createElement("div");
  zoneObservation.className = "observation";
  zoneObservation.setAttribute("role", "status");
  zoneObservation.setAttribute("aria-live", "polite");

  const titre = document.createElement("p");
  titre.className = "observation-titre";
  const verdict = document.createElement("p");
  verdict.className = "observation-verdict prose";
  const detail = document.createElement("p");
  detail.className = "observation-detail prose";
  zoneObservation.append(titre, verdict, detail);

  function afficher(observation: textes.Observation): void {
    zoneObservation.dataset["ton"] = observation.ton;
    titre.textContent = observation.titre;
    verdict.textContent = observation.verdict;
    detail.textContent = observation.detail;
  }

  function rafraichir(): void {
    for (const essai of ESSAIS) {
      const bouton = boutons.get(essai.numero);
      if (!bouton) continue;
      bouton.querySelector(".essai-libelle")!.textContent = essai.libelle(contexte);
      bouton.disabled = occupee || (essai.actif ? !essai.actif(contexte) : false);
      if (essai.arme?.(contexte)) bouton.dataset["arme"] = "oui";
      else delete bouton.dataset["arme"];
    }
  }

  function groupe(cote: "bas" | "haut", intitule: string): HTMLElement {
    const bloc = document.createElement("section");
    bloc.className = `groupe-essais groupe-${cote}`;

    const entete = document.createElement("h2");
    entete.className = "titre-zone";
    entete.textContent = intitule;

    const grille = document.createElement("div");
    grille.className = "essais-boutons";

    for (const essai of ESSAIS.filter((candidat) => candidat.cote === cote)) {
      const bouton = document.createElement("button");
      bouton.type = "button";
      bouton.className = "bouton essai";

      const numero = document.createElement("span");
      numero.className = "essai-numero";
      numero.textContent = String(essai.numero);

      const libelle = document.createElement("span");
      libelle.className = "essai-libelle";
      libelle.textContent = essai.libelle(contexte);

      bouton.append(numero, libelle);
      bouton.addEventListener("click", () => {
        void (async () => {
          occupee = true;
          rafraichir();
          try {
            afficher(await essai.jouer(contexte));
          } catch (erreur) {
            afficher(textes.echec(erreur instanceof Error ? erreur.message : String(erreur)));
          } finally {
            occupee = false;
            rafraichir();
          }
        })();
      });

      boutons.set(essai.numero, bouton);
      grille.append(bouton);
    }

    bloc.append(entete, grille);
    return bloc;
  }

  hote.replaceChildren(
    groupe("bas", "sous la frontière · modularité serveur"),
    groupe("haut", "au-dessus de la frontière · modularité de l'interface"),
    zoneObservation,
  );

  afficher(textes.OBSERVATION_INITIALE);
  rafraichir();

  return () => {
    hote.replaceChildren();
    boutons.clear();
  };
}

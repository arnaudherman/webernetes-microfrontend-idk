import {
  armerFormeRompue,
  armerPanneServeur,
  degelerCharges,
  etatBas,
  figerCharges,
  relancerCharges,
  retablirForme,
  retablirServeur,
  tuerCharges,
} from "../bas/essais-bas";
import { observerProcessus } from "../bas/etat-processus";
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
import { chargerDonnees, modeCourant, observerMode } from "../frontiere/traversee";
import { declarerContratFrontRompu } from "../synthese/compteurs";
import * as textes from "./observations";

/**
 * La barre d'essais.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA NUMÉROTATION EST UN OBJET D'ARCHITECTURE, PAS UN ORDRE D'ARRIVÉE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Les essais 1 à 4 se jouent sous la frontière, les essais 5 à 8 au-dessus. La
 * numérotation MONTE À TRAVERS LA LIGNE, et elle est continue de part et d'autre.
 *
 * Ce découpage place les essais 4 et 5 côte à côte, et ce n'est pas un hasard :
 * c'est la même faute — un champ renommé, contrat déclaré inchangé — jouée une fois
 * sous la frontière et une fois au-dessus. Deux boutons voisins, séparés uniquement
 * par la ligne. C'est la comparaison décisive, et elle doit pouvoir se jouer sans
 * rechargement et sans faire défiler la page : d'où la barre fixée en bas de fenêtre.
 *
 * Ce module est l'un des quatre autorisés à voir les deux moitiés. Il ne fait que
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

/**
 * L'état de la moitié basse, relu après chaque essai.
 *
 * On ne se fie pas à une copie locale de ce qu'on croit avoir déclenché : la vérité
 * est dans les processus, et la console la relit pour nous. Quand `taches` est mort
 * ou figé, ses drapeaux sont ILLISIBLES — et la barre le dit, plutôt que d'afficher
 * « contrat intact » sans en rien savoir.
 */
let etat: {
  /** La console a répondu au moins une fois. Tant que c'est faux, on ne sait RIEN. */
  connue: boolean;
  contratRompu: boolean;
  formeRompue: boolean;
  lisible: boolean;
  chargesVivant: boolean;
  /**
   * Il répond aux sondes — ce qui n'est pas la même chose que d'exister. Un
   * processus qui démarre est vivant avant d'écouter, exactement comme un processus
   * figé reste vivant après avoir cessé de répondre. Voir `attendreCharges`.
   */
  chargesRepond: boolean;
  chargesFige: boolean;
} = {
  // `chargesVivant` valait `true` au départ : une supposition, prise pour un fait.
  // Les essais du bas paraissaient donc disponibles avant que la console ait répondu,
  // et cliquer le premier rendait « L'essai a échoué · Failed to fetch ». Un bouton
  // qui promet une action qu'il ne peut pas tenir est exactement le défaut que cette
  // démonstration dénonce. On part maintenant de l'ignorance.
  connue: false,
  contratRompu: false,
  formeRompue: false,
  lisible: false,
  chargesVivant: false,
  chargesRepond: false,
  chargesFige: false,
};

/**
 * Comment redire la dernière observation dans l'autre mode.
 *
 * Trois essais du bas racontent une histoire différente selon la position de la
 * frontière. Basculer le sélecteur recharge les données mais ne rejoue pas l'essai :
 * sans ce rappel, la zone d'observation garderait le texte de l'ancien mode, et
 * l'écran se contredirait lui-même — « refus 502, l'écart est nommé » affiché
 * au-dessus d'une ligne d'état qui annonce « 200 en 16 ms ».
 *
 * C'est précisément la faute que la démonstration met en scène : un consommateur qui
 * continue d'afficher une valeur que plus personne ne produit. On ne peut pas se la
 * permettre dans le dispositif qui la dénonce.
 */
let redire: ((mode: "passerelle" | "direct") => textes.Observation) | undefined;

async function relire(): Promise<void> {
  const lu = await etatBas();
  const charges = lu.processus.find((processus) => processus.nom === "charges");
  etat = {
    connue: true,
    contratRompu: lu.contratRompu,
    formeRompue: lu.formeRompue,
    lisible: lu.lisible,
    chargesVivant: charges?.vivant ?? false,
    chargesRepond: charges?.repond ?? false,
    chargesFige: charges?.fige ?? false,
  };
}

/** La console ne répond plus : on repasse à l'ignorance plutôt que de garder l'ancien état. */
function oublier(): void {
  etat = {
    ...etat,
    connue: false,
    lisible: false,
    chargesVivant: false,
    chargesRepond: false,
    chargesFige: false,
  };
}

/**
 * L'état des processus est POUSSÉ, il n'a pas à être redemandé.
 *
 * La console diffuse `{ t: "processus" }` sur son flux à chaque changement, et
 * `etat-processus` le relaie déjà : c'est pour cela que les cartes de la moitié basse
 * réagissent en 0 ms. Les libellés des boutons, eux, attendaient le prochain tour de
 * la boucle de relecture. Mesuré, par une panne déclenchée hors interface : la carte
 * passait à « absent » en 0 ms pendant que le bouton mettait 834 ms, puis 1910 ms au
 * retour. Jusqu'à deux secondes pendant lesquelles le bouton proposait une action que
 * la réalité ne permettait plus — exactement ce que le commentaire de `etat` un peu
 * plus haut refuse.
 *
 * On ne remplace pas la boucle pour autant, on la double. Elle garde deux rôles que
 * la poussée ne tient pas : les drapeaux `contratRompu` / `formeRompue` / `lisible`,
 * qui ne sont pas diffusés, et la détection du silence de la console — un flux mort
 * ne pousse rien, et ne rien recevoir n'est pas une information.
 */
function surPoussee(processus: readonly { nom: string; vivant: boolean; repond: boolean; fige: boolean }[]): void {
  const charges = processus.find((candidat) => candidat.nom === "charges");
  if (!charges) return;
  etat = {
    ...etat,
    chargesVivant: charges.vivant,
    chargesRepond: charges.repond,
    chargesFige: charges.fige,
  };
}

/**
 * Garde-fou : ne pas redemander les données avant que `charges` réponde.
 *
 * La console attend désormais l'écoute avant d'accuser réception d'un démarrage
 * (`attendreEcoute`, dans `console.mjs`), et ce garde-fou devrait donc toujours
 * sortir au premier tour. Il est là quand même, et pour une raison précise : la
 * page ne CONTRÔLE pas la console. Elle lui parle par le réseau, la console peut
 * avoir été relancée, tourner sur une machine plus lente, ou être une version qui
 * n'a pas ce correctif. Recharger avant que l'amont réponde produit un 200 partiel
 * dont plus rien ne sort — c'est un état qui ne se répare pas tout seul, et un
 * garde-fou de dix lignes vaut mieux qu'un écran figé sur une panne périmée.
 *
 * On interroge `repond` et pas seulement `vivant` : un processus qui démarre est
 * vivant avant d'écouter. C'est le même écart que l'essai 3 met en scène par
 * l'autre bout, avec un processus figé qui reste vivant après avoir cessé de
 * répondre.
 *
 * Le renoncement est SILENCIEUX et rend la main : au-delà du délai, on recharge
 * quand même. Un amont qui ne revient pas est un fait que la démonstration doit
 * montrer — 200 partiel, cause nommée — pas une chose qu'on masque en n'affichant
 * rien du tout.
 */
async function attendreCharges(delaiMaxMs = 3000): Promise<boolean> {
  const debut = performance.now();
  for (;;) {
    if (etat.connue && etat.chargesVivant && etat.chargesRepond) return true;
    if (performance.now() - debut > delaiMaxMs) return false;
    await new Promise((resoudre) => setTimeout(resoudre, 100));
    await relire();
  }
}

const ESSAIS: DefinitionEssai[] = [
  {
    numero: 1,
    cote: "bas",
    // On ne dit « relancer » qu'une fois SU que le service est mort. Tant que la
    // console n'a pas répondu, le libellé reste l'action principale et le bouton
    // est inactif.
    libelle: () => (etat.connue && !etat.chargesVivant ? "relancer charges" : "tuer le service charges"),
    arme: () => etat.connue && !etat.chargesVivant,
    actif: () => etat.connue,
    async jouer(contexte) {
      const tuer = etat.chargesVivant;
      if (tuer) await tuerCharges();
      else await relancerCharges();
      await relire();

      // Après une RELANCE seulement : on attend que le service réponde. Recharger
      // dans les quelques dizaines de millisecondes qui séparent le processus de son
      // port produisait un 200 partiel sans agrégat, et l'écran y restait figé.
      //
      // Rien de tel après un ARRÊT : là, le refus est le résultat, il est immédiat,
      // et il faut le montrer tout de suite.
      if (!tuer) await attendreCharges();

      // On redemande les données : c'est la page qui découvre la panne, comme elle le
      // ferait à n'importe quel rafraîchissement.
      await chargerDonnees(contexte.bus);
      redire = tuer ? textes.serviceTue : undefined;
      return tuer ? textes.serviceTue(modeCourant()) : textes.SERVICE_RELANCE;
    },
  },
  {
    numero: 2,
    cote: "bas",
    libelle: () => (etat.contratRompu ? "rétablir le contrat serveur" : "casser le contrat serveur"),
    arme: () => etat.contratRompu,
    actif: () => etat.lisible,
    async jouer(contexte) {
      if (etat.contratRompu) await retablirServeur();
      else await armerPanneServeur();
      await relire();
      await chargerDonnees(contexte.bus);
      return etat.contratRompu ? textes.CONTRAT_SERVEUR_ROMPU : textes.CONTRAT_SERVEUR_RETABLI;
    },
  },
  {
    numero: 3,
    cote: "bas",
    libelle: () => (etat.connue && etat.chargesFige ? "dégeler charges" : "figer charges (SIGSTOP)"),
    arme: () => etat.connue && etat.chargesFige,
    actif: () => etat.connue && etat.chargesVivant,
    async jouer(contexte) {
      const figer = !etat.chargesFige;
      if (figer) await figerCharges();
      else await degelerCharges();
      await relire();

      // On n'ATTEND PAS le chargement. En mode direct, il n'aboutira peut-être jamais :
      // personne n'a écrit de budget de délai, et `fetch` n'expire pas de lui-même.
      // Attendre ici gèlerait la barre et empêcherait de cliquer « dégeler » — la
      // démonstration se prendrait elle-même au piège qu'elle veut montrer.
      void chargerDonnees(contexte.bus);
      redire = figer ? textes.serviceFige : undefined;
      return figer ? textes.serviceFige(modeCourant()) : textes.SERVICE_DEGELE;
    },
  },
  {
    // Le premier des deux essais décisifs. Son voisin immédiat est le 5, de l'autre
    // côté de la ligne : même faute, autre placement de frontière.
    numero: 4,
    cote: "bas",
    libelle: () =>
      etat.formeRompue ? "rétablir la forme servie" : "servir une charge utile non conforme",
    arme: () => etat.formeRompue,
    actif: () => etat.lisible,
    async jouer(contexte) {
      if (etat.formeRompue) await retablirForme();
      else await armerFormeRompue();
      await relire();
      await chargerDonnees(contexte.bus);
      redire = etat.formeRompue ? textes.formeRompue : undefined;
      return etat.formeRompue ? textes.formeRompue(modeCourant()) : textes.FORME_RETABLIE;
    },
  },
  {
    // Le second. Il ouvre la moitié haute parce que c'est là que la comparaison se
    // joue, pas parce que c'est le plus simple à montrer.
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
    libelle: () => "démonter mf-detail",
    actif: (contexte) => detailEstMonte(contexte.shell),
    jouer(contexte) {
      demonterDetail(contexte.shell);
      contexte.rail?.repositionner();
      return textes.FRAGMENT_DEMONTE;
    },
  },
  {
    numero: 7,
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
    numero: 8,
    cote: "haut",
    libelle: (contexte) =>
      tableauEnV2(contexte.shell) ? "revenir à mf-tableau 1.0" : "remplacer mf-tableau par 2.0",
    async jouer(contexte) {
      const enV2 = basculerImplementationTableau(contexte.shell);
      contexte.rail?.repositionner();
      // Le fragment neuf arrive vide : le bus ne rejoue rien. Il faut redemander les
      // données aux services pour le peupler.
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
            // Chaque essai repart d'une ardoise nette : seuls ceux dont le texte
            // dépend du mode réarment `redire`, à la fin de leur `jouer`.
            redire = undefined;
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

  // Voir `surPoussee` : les libellés suivent le flux de la console, au lieu
  // d'attendre le prochain tour de boucle. C'est ce qui les fait passer de 2 s de
  // retard à 0.
  const detacherProcessus = observerProcessus((processus) => {
    surPoussee(processus);
    if (!occupee) rafraichir();
  });

  // L'état réel des processus est relu régulièrement, pas déduit de ce qu'on croit
  // avoir déclenché : la console peut avoir été relancée, un service être mort de
  // lui-même, un essai avoir été joué depuis un autre onglet. Les libellés des
  // boutons doivent dire ce qui EST, pas ce qu'on a demandé.
  let vivante = true;
  void (async () => {
    while (vivante) {
      try {
        await relire();
        if (!occupee) rafraichir();
      } catch {
        // La console ne répond pas. On n'écrit rien — le journal collecté l'affiche
        // déjà — mais on OUBLIE : garder le dernier état connu ferait présenter comme
        // vrai quelque chose qu'on ne peut plus vérifier.
        oublier();
        if (!occupee) rafraichir();
      }
      await new Promise((resoudre) => setTimeout(resoudre, 2000));
    }
  })();

  // Basculer le sélecteur ne rejoue pas l'essai : on redit donc son observation dans
  // le nouveau mode, sans quoi l'écran garderait un texte que les données ne portent
  // plus. Les boutons, eux, ne changent pas — c'est leur récit qui change.
  const detacherMode = observerMode((mode) => {
    if (redire) afficher(redire(mode));
    rafraichir();
  });

  return () => {
    vivante = false;
    detacherMode();
    detacherProcessus();
    hote.replaceChildren();
    boutons.clear();
  };
}

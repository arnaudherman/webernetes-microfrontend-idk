import type { Trace } from "./bus";
import type { Shell } from "./shell";

/**
 * Le rail du bus.
 *
 * Une piste horizontale reliant les quatre modules. Chaque message publié fait
 * circuler une impulsion de l'émetteur vers chacun de ses abonnés. Un message sans
 * abonné parcourt le rail jusqu'au bout et se dissipe : pas d'erreur, pas de rebond,
 * pas de trace. C'est exactement ce qui se passe dans le bus.
 *
 * Le traitement graphique est volontairement différent de la vue des services : ici
 * pas de cartes ni d'adresses, une simple ligne et des points en mouvement.
 *
 * L'identifiant d'abonné choisi par un fragment (`mf-tableau`) et la clé
 * d'emplacement connue du shell (`tableau`) sont reliés par une convention de nommage
 * que rien ne vérifie. C'est un contrat de plus, non typé, tenu par personne — le
 * même genre exactement que celui que l'essai 5 met en défaut.
 *
 * Ce module ne sait PAS dans quel mode tourne la frontière, et ne doit pas le savoir :
 * `src/haut` n'a pas une ligne de différence entre les deux positions. L'étiquette
 * d'entrée nomme donc la frontière, jamais ce qu'il y a derrière.
 */

const DUREE_MS = 650;
const RAYON = 6.5;

function cleDepuisAbonne(identifiant: string): string {
  return identifiant.replace(/^mf-/, "");
}

export interface Rail {
  surTrace(trace: Trace): void;
  repositionner(): void;
  detacher(): void;
}

export function rendreRail(hote: HTMLElement, shell: Shell, ordre: readonly string[]): Rail {
  hote.replaceChildren();

  const piste = document.createElement("div");
  piste.className = "rail-piste";

  const legende = document.createElement("span");
  legende.className = "rail-legende";
  legende.textContent = "bus d'événements — aucun accusé de réception";

  const entree = document.createElement("span");
  entree.className = "rail-entree";
  entree.textContent = "← la frontière";

  hote.append(piste, entree, legende);

  const stations = new Map<string, HTMLElement>();

  for (const cle of ordre) {
    const station = document.createElement("div");
    station.className = "rail-station";
    station.dataset["cle"] = cle;

    const pastille = document.createElement("span");
    pastille.className = "rail-pastille";

    const nom = document.createElement("span");
    nom.className = "rail-nom";
    nom.textContent = cle;

    station.append(pastille, nom);
    hote.append(station);
    stations.set(cle, station);
  }

  const abscisses = new Map<string, number>();

  function repositionner(): void {
    const cadre = hote.getBoundingClientRect();
    for (const [cle, rectangle] of shell.positions()) {
      const x = rectangle.left + rectangle.width / 2 - cadre.left;
      abscisses.set(cle, x);
      const station = stations.get(cle);
      if (station) {
        station.style.left = `${x}px`;
        station.dataset["monte"] = shell.estMonte(cle) ? "oui" : "non";
      }
    }
  }

  const observateurTaille = new ResizeObserver(() => repositionner());
  observateurTaille.observe(hote);
  window.addEventListener("resize", repositionner);
  repositionner();

  const reduitLeMouvement = window.matchMedia("(prefers-reduced-motion: reduce)");

  function marquer(cle: string | undefined, role: string): void {
    if (!cle) return;
    const station = stations.get(cle);
    if (!station) return;
    station.dataset["role"] = role;
    setTimeout(() => delete station.dataset["role"], DUREE_MS + 120);
  }

  function impulsion(depart: number, arrivee: number, perdue: boolean): void {
    const point = document.createElement("div");
    point.className = "rail-impulsion";
    if (perdue) point.dataset["perdue"] = "oui";
    point.style.left = `${-RAYON}px`;
    hote.append(point);

    const animation = point.animate(
      [
        { transform: `translateX(${depart}px)`, opacity: 1 },
        { transform: `translateX(${arrivee}px)`, opacity: perdue ? 0 : 1 },
      ],
      { duration: DUREE_MS, easing: perdue ? "linear" : "ease-in-out", fill: "forwards" },
    );

    const retirer = () => point.remove();
    animation.finished.then(retirer, retirer);
  }

  return {
    surTrace(trace) {
      repositionner();

      // Une source qui ne correspond à aucune station vient de l'extérieur du bus :
      // elle est entrée par la frontière, et son impulsion part du bord gauche.
      //
      // Cette ligne testait un nom en dur — `trace.source === "passerelle"` — alors
      // que la source publiée s'appelait déjà autrement. La branche était morte et le
      // rendu juste par accident. C'est le mécanisme de l'essai 5 survenu ici même :
      // un champ renommé, un consommateur silencieux, une sortie plausible. On
      // interroge donc les stations réellement présentes, pas une chaîne écrite à la
      // main : renommer la source ne peut plus casser ce rail en silence.
      const cle = cleDepuisAbonne(trace.source);
      const cleSource = stations.has(cle) ? cle : undefined;
      const depart = cleSource ? (abscisses.get(cleSource) ?? 0) : 0;
      marquer(cleSource, "source");

      const cibles = trace.abonnes
        .map(cleDepuisAbonne)
        .map((cle) => {
          marquer(cle, "abonne");
          return abscisses.get(cle);
        })
        .filter((x): x is number => x !== undefined);

      if (reduitLeMouvement.matches) return;

      if (cibles.length === 0) {
        // Personne n'écoute : le message parcourt le rail et se dissipe à son
        // extrémité. Aucune erreur n'est levée, nulle part.
        impulsion(depart, hote.getBoundingClientRect().width, true);
        return;
      }

      for (const cible of cibles) impulsion(depart, cible, false);
    },

    repositionner,

    detacher() {
      observateurTaille.disconnect();
      window.removeEventListener("resize", repositionner);
      hote.replaceChildren();
    },
  };
}

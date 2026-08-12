/**
 * Le bus d'événements de l'interface.
 *
 * Il est minimal et explicite, et c'est délibéré : tout ce que la moitié haute
 * possède comme mécanisme d'intégration tient dans ce fichier. Il n'y a pas de
 * code d'état, pas de délai d'expiration, pas de réessai, pas de trace de bout en
 * bout. La comparaison avec la moitié basse ne tient que si l'on résiste à la
 * tentation d'ajouter ici ce que HTTP fournit gratuitement en dessous.
 *
 * Deux méthodes, et rien d'autre :
 *   abonner(evenement, idAbonne, handler) -> fonction de désabonnement
 *   publier(evenement, charge, source)    -> nombre d'abonnés atteints
 *
 * La charge utile est copiée par `structuredClone` avant d'être remise à chaque
 * abonné : aucun état n'est partagé par référence entre deux fragments.
 *
 * Aucun try/catch autour des abonnés. Une exception dans un fragment remonterait
 * donc à l'émetteur. C'est volontaire : ajouter une isolation ici reviendrait à
 * reconstruire à la main la moitié de ce que le réseau donne d'office, et à masquer
 * précisément ce que la démonstration veut rendre visible.
 */

export type Desabonnement = () => void;

export type Gestionnaire = (charge: unknown) => void;

export interface Bus {
  abonner(evenement: string, idAbonne: string, gestionnaire: Gestionnaire): Desabonnement;
  publier(evenement: string, charge: unknown, source: string): number;
}

/** Ce que le shell observe du bus. Les fragments n'y ont pas accès. */
export interface Trace {
  readonly horodatage: number;
  readonly evenement: string;
  readonly source: string;
  readonly abonnes: readonly string[];
  readonly charge: unknown;
}

/**
 * Le traceur est injecté par le shell à la construction. Les fragments reçoivent
 * un bus qui n'expose que `abonner` et `publier` : l'observabilité de la frontière
 * front est une affaire de shell, pas de fragment.
 */
export function creerBus(tracer: (trace: Trace) => void): Bus {
  const abonnements = new Map<string, Map<string, Gestionnaire>>();

  return {
    abonner(evenement, idAbonne, gestionnaire) {
      let pourCetEvenement = abonnements.get(evenement);
      if (!pourCetEvenement) {
        pourCetEvenement = new Map();
        abonnements.set(evenement, pourCetEvenement);
      }
      pourCetEvenement.set(idAbonne, gestionnaire);
      return () => {
        pourCetEvenement.delete(idAbonne);
      };
    },

    publier(evenement, charge, source) {
      const destinataires = [...(abonnements.get(evenement)?.entries() ?? [])];

      // La trace part AVANT la remise, pour que le rail puisse animer le message
      // pendant son trajet plutôt qu'après.
      tracer({
        horodatage: Date.now(),
        evenement,
        source,
        abonnes: destinataires.map(([identifiant]) => identifiant),
        charge,
      });

      for (const [, gestionnaire] of destinataires) gestionnaire(structuredClone(charge));

      return destinataires.length;
    },
  };
}

import ports from "./adresses.json";

/**
 * Les adresses de la moitié basse, côté navigateur.
 *
 * Les numéros de port vivent dans `adresses.json`, lu ici par le navigateur et par
 * les quatre processus. Une seule source : un port changé d'un côté et pas de
 * l'autre produirait une panne qui ressemblerait à celle qu'on démontre.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI 127.0.0.1 ET NON `localhost`
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Les serveurs écoutent sur 127.0.0.1. Sur une machine où `localhost` se résout
 * d'abord en `::1`, une URL en `localhost` échouerait avec un refus de connexion —
 * c'est-à-dire exactement la panne de l'essai 1, mais pour une raison qui n'a rien
 * à voir avec la démonstration. On écrit donc l'adresse littérale des deux côtés.
 */

export type NomService = "console" | "taches" | "charges" | "passerelle";

export const PORTS: Readonly<Record<NomService, number>> = ports;

export const HOTE = "127.0.0.1";

function origine(service: NomService): string {
  return `http://${HOTE}:${PORTS[service]}`;
}

export const ORIGINES: Readonly<Record<NomService, string>> = {
  console: origine("console"),
  taches: origine("taches"),
  charges: origine("charges"),
  passerelle: origine("passerelle"),
};

/**
 * Les seules origines que la page a le droit de contacter. Le garde-réseau refuse
 * tout le reste, y compris une faute de frappe sur un port.
 */
export const ORIGINES_AUTORISEES: readonly string[] = Object.values(ORIGINES);

/* ------------------------------------------------------------------ les chemins */

/** Via la passerelle : un seul appel, la composition est faite côté réseau. */
export const URL_DONNEES_PASSERELLE = `${ORIGINES.passerelle}/donnees`;

/** En appels directs : deux appels, la composition remonte dans le navigateur. */
export const URL_TACHES_DIRECT = `${ORIGINES.taches}/taches`;
export const URL_CHARGES_DIRECT = `${ORIGINES.charges}/charges`;

/** Le flux de journal collecté, et la surface de commande de la console. */
export const URL_JOURNAL = `${ORIGINES.console}/journal`;
export const URL_COMMANDE = `${ORIGINES.console}/commande`;

// @ts-check
import ports from "../adresses.json" with { type: "json" };

/**
 * Les adresses de la moitié basse, côté processus.
 *
 * Même fichier de ports que `../adresses.ts`, lu par le navigateur. Voir ce
 * fichier-là pour la raison pour laquelle on écrit `127.0.0.1` et jamais
 * `localhost`.
 */

/** @typedef {"console" | "taches" | "charges" | "passerelle"} NomService */

export const PORTS = /** @type {Readonly<Record<NomService, number>>} */ (ports);

export const HOTE = "127.0.0.1";

/** @param {NomService} service */
export function origine(service) {
  return `http://${HOTE}:${PORTS[service]}`;
}

/**
 * Les origines depuis lesquelles la page peut appeler les services. Le serveur de
 * développement de Vite en fait partie, et c'est la seule raison pour laquelle CORS
 * intervient : la page et les services ne partagent pas d'origine.
 */
export const ORIGINES_PAGE = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

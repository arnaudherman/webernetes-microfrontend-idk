import { healthCheckHeader } from "@ngrok/webernetes";
import type { HttpHeader, HttpRequest } from "@ngrok/webernetes";

/**
 * Aides sur les en-têtes HTTP simulés.
 *
 * Deux pièges vérifiés dans le paquet :
 *  - les valeurs d'en-tête sont des TABLEAUX de chaînes, jamais des chaînes ;
 *  - la casse des noms est préservée telle que fournie, il faut donc comparer
 *    sans tenir compte de la casse.
 */

/**
 * Identifiant de corrélation posé par le réseau simulé sur chaque requête.
 * La constante existe dans le paquet (`src/cluster/cni/network.ts`) mais n'est pas
 * exportée : elle est recopiée ici. Le fournir soi-même dans une requête lève.
 */
export const IDENTIFIANT_REQUETE = "X-Webernetes-Request-Id";

export function entete(entetes: HttpHeader | undefined, nom: string): string | undefined {
  if (!entetes) return undefined;
  const recherche = nom.toLowerCase();
  for (const [cle, valeurs] of Object.entries(entetes)) {
    if (cle.toLowerCase() === recherche) return valeurs[0];
  }
  return undefined;
}

/**
 * Vrai pour le trafic des sondes du kubelet, qui représente environ 35 % des
 * requêtes du cluster. Sans ce filtre, le journal est illisible.
 */
export function estSonde(requete: HttpRequest): boolean {
  return entete(requete.header, healthCheckHeader) !== undefined;
}

export function identifiant(requete: HttpRequest): string | undefined {
  return entete(requete.header, IDENTIFIANT_REQUETE);
}

import { defineConfig } from "vite";

/**
 * Aucune configuration n'est nécessaire pour faire tourner ce projet, et il n'y a
 * plus une seule dépendance d'exécution : la moitié haute est du DOM et des éléments
 * personnalisés, la moitié basse tourne dans quatre processus Node qui n'utilisent
 * que `node:http`.
 *
 * Ce fichier ne fixe donc qu'une cible de compilation.
 *
 * Historique : le seuil d'alerte de taille de Rollup était relevé ici tant que la
 * moitié basse tournait sur une simulation embarquée. L'artefact est retombé à
 * quelques dizaines de kilo-octets le jour où cette dépendance est sortie du code
 * pour redevenir une source citée, et le seuil n'a plus lieu d'être touché.
 *
 * Aucun proxy de développement, et c'est délibéré. Faire passer les services par
 * Vite éviterait CORS, et convertirait un `ECONNREFUSED` en 500 émis par Vite :
 * l'essai 1 perdrait précisément ce qu'il doit montrer, et le mode « appels directs »
 * ne serait plus direct.
 */
export default defineConfig({
  build: {
    target: "es2022",
  },
});

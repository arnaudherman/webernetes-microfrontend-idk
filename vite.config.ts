import { defineConfig } from "vite";

/**
 * Aucune configuration n'est NÉCESSAIRE pour faire tourner ce projet : `@ngrok/webernetes`
 * s'installe et se bundle sans alias, sans polyfill et sans plugin. Ce fichier ne sert
 * qu'à taire un avertissement.
 *
 * Le paquet pèse environ 525 ko minifié, ce qui dépasse le seuil d'alerte par défaut de
 * Rollup. Un cluster Kubernetes complet dans un onglet coûte ce prix-là ; le découper en
 * morceaux n'apporterait rien à une démonstration qui tourne en local.
 */
export default defineConfig({
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 700,
  },
});

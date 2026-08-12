import { defineConfig } from "vite";

/**
 * Chaîne de construction de l'équipe « tableau ». Elle n'a connaissance d'aucune
 * autre équipe.
 *
 * Deux réglages ne sont pas négociables :
 *
 *   formats: ["es"]           Les défauts de Vite produisent aussi `umd` ou `cjs`,
 *                             et ni l'un ni l'autre n'est chargeable par un
 *                             `import()` natif du navigateur.
 *
 *   external: ["@socle/bus"]  Sans cette ligne, le socle est recopié dans l'artefact.
 *                             Chaque fragment aurait alors son propre bus, et le bus
 *                             cesserait d'être partagé — sans que rien ne le signale.
 *                             C'est le point de jonction entre la construction et la
 *                             résolution à l'exécution.
 *
 * `minify: false` est un choix de démonstration : on doit pouvoir lire dans
 * l'artefact que le spécificateur nu a survécu à la compilation.
 */
export default defineConfig({
  build: {
    target: "es2022",
    minify: false,
    lib: {
      entry: "src/mf-tableau.ts",
      formats: ["es"],
      fileName: () => "mf-tableau.js",
    },
    rollupOptions: {
      external: ["@socle/bus"],
      output: { entryFileNames: "mf-tableau.js" },
    },
  },
});

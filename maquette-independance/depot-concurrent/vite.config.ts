import { defineConfig } from "vite";

/** Une autre équipe, un autre dépôt, une autre chaîne de construction — et le même
 *  nom de balise. Aucune des deux équipes n'a de moyen de le savoir avant l'exécution. */
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

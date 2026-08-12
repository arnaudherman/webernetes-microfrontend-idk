import { defineConfig } from "vite";

/** Chaîne de construction de l'équipe « filtres ». Voir equipe-tableau/vite.config.ts. */
export default defineConfig({
  build: {
    target: "es2022",
    minify: false,
    lib: {
      entry: "src/mf-filtres.ts",
      formats: ["es"],
      fileName: () => "mf-filtres.js",
    },
    rollupOptions: {
      external: ["@socle/bus"],
      output: { entryFileNames: "mf-filtres.js" },
    },
  },
});

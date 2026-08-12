import { defineConfig } from "vite";

/** L'équipe « calcul » compile son Rust en wasm, puis bundle la glu wasm-bindgen
 *  dans son artefact. Seul le binaire .wasm reste un fichier séparé, chargé par URL
 *  absolue : c'est la seule façon de le servir depuis l'origine de l'équipe sans
 *  dépendre du chemin de bundle. */
export default defineConfig({
  build: {
    target: "es2022",
    minify: false,
    lib: { entry: "src/mf-calcul.ts", formats: ["es"], fileName: () => "mf-calcul.js" },
    rollupOptions: { external: ["@socle/bus", "./calcul.js"], output: { entryFileNames: "mf-calcul.js" } },
  },
});

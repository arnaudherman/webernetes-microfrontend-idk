/**
 * Déclaration de types de la glu générée par wasm-bindgen.
 *
 * `./calcul.js` n'existe pas dans les sources : il est produit par `wasm-pack` dans
 * `pkg/`, exclu du dépôt, puis publié à côté du fragment dans son répertoire de
 * version. Le fragment l'importe par un chemin relatif qui n'est valable qu'à
 * l'exécution — TypeScript ne peut donc pas le résoudre depuis les sources.
 *
 * Ce fichier redit à la main ce que wasm-bindgen génère déjà dans `pkg/calcul.d.ts`.
 * C'est une duplication, et elle a un coût réel : si la signature Rust change sans que
 * cette déclaration suive, le compilateur validera un appel qui échouera à l'exécution.
 *
 * C'est exactement le même problème que celui de l'étude, un cran plus bas : une
 * frontière entre deux langages, décrite par un contrat que rien ne confronte
 * automatiquement aux deux côtés.
 */
/**
 * Initialise le module WebAssembly. Sans argument, la glu résout le binaire
 * relativement à sa propre URL.
 */
export default function init(
  entree?: { module_or_path: string | URL } | string | URL,
): Promise<unknown>;

/** Agrège une liste de tâches sérialisée en JSON, et rend du JSON. */
export function agreger_json(entree: string): string;

/**
 * Agrège à partir de tableaux typés parallèles : aucune chaîne ne traverse la
 * frontière, aucun JSON n'est analysé. Rend cinq valeurs par responsable.
 */
export function agreger_colonnes(
  responsables: Uint32Array,
  statuts: Uint8Array,
  charges: Float64Array,
  nb_responsables: number,
): Float64Array;

/** Version de la caisse Rust, telle que déclarée dans Cargo.toml. */
export function version(): string;

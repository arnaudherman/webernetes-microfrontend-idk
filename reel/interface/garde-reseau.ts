import { ORIGINES_AUTORISEES } from "./bas/adresses";

/**
 * Garde-reseau.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QU'IL PROUVAIT, ET CE QU'IL PROUVE MAINTENANT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Il prouvait que la page n'emettait AUCUNE requete : tout tournait dans l'onglet, et
 * la garde refusait tout ce qui n'etait pas la meme origine. Cette affirmation est
 * morte avec la simulation, et il aurait ete malhonnete de la laisser.
 *
 * Ce qu'il prouve desormais est plus precis, et se verifie a l'ecran :
 *
 *   1. la page ne contacte QUE les quatre origines declarees dans `bas/adresses.json` —
 *      console 7100, taches 7101, charges 7102, passerelle 7200 ;
 *   2. ces quatre origines sont sur 127.0.0.1, donc RIEN NE SORT DE LA MACHINE. La
 *      demonstration tourne en salle de reunion sans connexion, comme avant ;
 *   3. tout le trafic de la page passe par un point unique et compte. C'est pour tenir
 *      cette troisieme propriete que le journal collecte est lu avec `fetch` plutot
 *      qu'avec `EventSource`, qui aurait echappe a la garde.
 *
 * Et il garde son utilite d'origine, deplacee : une faute de frappe sur un port
 * n'envoie plus une requete au hasard, elle est refusee et comptee. Le compteur de
 * la synthese affiche ces refus. S'il bouge, c'est qu'un module s'adresse a quelque
 * chose qui n'est pas declare — ce qui est exactement le genre de derive qu'un
 * dispositif de demonstration doit rendre impossible a ignorer.
 */

const MARQUEUR = Symbol.for("frontiere.garde-reseau");

const PROTOCOLES_SANS_RESEAU = new Set(["data:", "blob:"]);

export interface RequeteBloquee {
  readonly horodatage: number;
  readonly url: string;
  readonly methode: string;
}

const bloquees: RequeteBloquee[] = [];

let fetchNatif: typeof globalThis.fetch | undefined;

function urlDeLEntree(entree: RequestInfo | URL): string {
  if (typeof entree === "string") return entree;
  if (entree instanceof URL) return entree.href;
  return entree.url;
}

function methodeDeLEntree(entree: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof entree !== "string" && !(entree instanceof URL)) return entree.method.toUpperCase();
  return "GET";
}

/**
 * Remplace `globalThis.fetch`. Idempotent : deux appels ne superposent pas deux gardes,
 * ce qui compte sous le rechargement a chaud de Vite.
 */
export function installerGardeReseau(): void {
  const courant = globalThis.fetch as typeof globalThis.fetch & { [MARQUEUR]?: true };
  if (courant[MARQUEUR] === true) return;

  fetchNatif = courant.bind(globalThis);

  const garde = (async (entree: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const brute = urlDeLEntree(entree);

    let destination: URL;
    try {
      destination = new URL(brute, globalThis.location.href);
    } catch {
      throw new TypeError(`garde-reseau : URL illisible ${JSON.stringify(brute)}`);
    }

    // L'origine de la page elle-meme reste autorisee : c'est Vite qui sert les modules
    // et son canal de rechargement a chaud.
    const autorisee =
      destination.origin === globalThis.location.origin ||
      ORIGINES_AUTORISEES.includes(destination.origin) ||
      PROTOCOLES_SANS_RESEAU.has(destination.protocol);

    if (!autorisee) {
      bloquees.push({
        horodatage: Date.now(),
        url: destination.href,
        methode: methodeDeLEntree(entree, init),
      });
      throw new TypeError(
        `garde-reseau : sortie refusee vers ${destination.origin}. ` +
          `La page ne s'adresse qu'aux quatre services declares, tous sur 127.0.0.1.`,
      );
    }

    return await fetchNatif!(entree, init);
  }) as typeof globalThis.fetch & { [MARQUEUR]?: true };

  garde[MARQUEUR] = true;
  globalThis.fetch = garde;
}

/** Nombre de sorties refusees depuis le chargement de la page. Affiche dans la synthese. */
export function requetesBloquees(): readonly RequeteBloquee[] {
  return bloquees;
}

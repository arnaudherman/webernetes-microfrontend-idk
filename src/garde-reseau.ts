/**
 * Garde-reseau.
 *
 * Webernetes route les noms qu'il connait a l'interieur du cluster simule. Un nom
 * qu'il ne resout pas n'echoue pas : il est traite comme une cible externe et part
 * dans le `fetch` du navigateur (src/cluster/cni/network.ts:1009 du paquet). Une
 * faute de frappe sur un nom de Service suffit donc a produire une vraie requete
 * sortante. Aucune option de `ClusterOptions` ne desactive ce repli.
 *
 * La demonstration doit tourner en salle de reunion sans connexion, et doit pouvoir
 * prouver a l'ecran qu'elle n'emet rien. On remplace donc `globalThis.fetch` par une
 * garde qui rejette tout ce qui ne vise pas la meme origine, avant de construire le
 * moindre cluster.
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

    const memeOrigine =
      destination.origin === globalThis.location.origin ||
      PROTOCOLES_SANS_RESEAU.has(destination.protocol);

    if (!memeOrigine) {
      bloquees.push({
        horodatage: Date.now(),
        url: destination.href,
        methode: methodeDeLEntree(entree, init),
      });
      throw new TypeError(
        `garde-reseau : sortie refusee vers ${destination.origin}. ` +
          `La demonstration n'emet aucune requete hors de son propre onglet.`,
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

// @ts-check
import { Agent, createServer, request } from "node:http";
import { ORIGINES_PAGE } from "./adresses.mjs";

/**
 * Le socle commun aux trois services.
 *
 * Il ne contient AUCUNE règle métier et aucune décision d'architecture : uniquement
 * ce qu'il faut pour qu'un processus Node serve du HTTP à un navigateur et rende
 * compte de ce qu'il a fait. Tout ce qui relève d'une décision — dégrader, refuser,
 * corréler — est écrit dans `passerelle.mjs`, en un seul endroit et à la vue de tous.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LE JOURNAL PART SUR LA SORTIE STANDARD
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Chaque service écrit une ligne NDJSON par requête sur `stdout`, et rien d'autre.
 * C'est la console qui les collecte, parce qu'elle est le processus parent : elle
 * lit un tube, pas une API. Un service n'a donc aucun moyen de savoir qu'il est
 * observé, ne dépend pas de son observateur, et continue d'écrire jusqu'à sa
 * dernière ligne — y compris pendant qu'on le tue.
 */

export const EN_TETE_CORRELATION = "x-correlation-id";
export const EN_TETE_APPELANT = "x-appelant";
export const EN_TETE_SONDE = "x-sonde";
export const EN_TETE_DEGRADATION = "x-degradation";

/**
 * Sans cet en-tête, `X-Correlation-Id` traverse le réseau mais reste INVISIBLE dans
 * le navigateur : la spécification CORS masque tous les en-têtes de réponse qui ne
 * sont pas explicitement exposés. Le premier devoir de la passerelle serait alors
 * réel et indémontrable.
 */
const EXPOSES = [EN_TETE_CORRELATION, EN_TETE_DEGRADATION].join(", ");

/**
 * @typedef {object} LigneJournal
 * @property {"service"} origine
 * @property {string} service
 * @property {number} horodatage
 * @property {"requete" | "note"} nature
 * @property {string} [methode]
 * @property {string} [chemin]
 * @property {number} [status]
 * @property {number} [dureeMs]
 * @property {string} [id]        Identifiant de corrélation, quand il y en a un.
 * @property {string} [de]        Qui a appelé : un service, ou le navigateur.
 * @property {string} [message]
 * @property {"normal" | "attention"} [niveau]
 */

/**
 * Émet une ligne de journal. Le `\n` final est ce qui rend le flux lisible ligne à
 * ligne par le parent, y compris si le processus meurt au milieu de la suivante.
 *
 * @param {Omit<LigneJournal, "origine" | "horodatage">} ligne
 */
export function journaliser(ligne) {
  process.stdout.write(`${JSON.stringify({ origine: "service", horodatage: Date.now(), ...ligne })}\n`);
}

/**
 * @typedef {object} Reponse
 * @property {number} status
 * @property {unknown} [corps]              Sérialisé en JSON si présent.
 * @property {string} [texte]               Corps brut, si l'on ne veut pas de JSON.
 * @property {Record<string, string>} [entetes]
 */

/**
 * @typedef {object} Requete
 * @property {string} chemin
 * @property {URLSearchParams} parametres
 * @property {string} methode
 * @property {string} id                    Corrélation reçue, ou fabriquée ici.
 * @property {string} de                    Appelant déclaré, « navigateur » par défaut.
 */

/**
 * Un identifiant court : il doit tenir dans une colonne de journal projetée en salle.
 * Huit caractères suffisent largement pour distinguer les requêtes d'une session.
 */
export function nouvelIdentifiant() {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * Démarre un service HTTP.
 *
 * @param {object} options
 * @param {string} options.nom
 * @param {number} options.port
 * @param {(requete: Requete) => Promise<Reponse> | Reponse} options.router
 */
export function servir({ nom, port, router }) {
  const serveur = createServer((requete, reponse) => {
    const debut = performance.now();
    const url = new URL(requete.url ?? "/", `http://${requete.headers.host ?? "127.0.0.1"}`);
    const entrant = requete.headers;

    const id = String(entrant[EN_TETE_CORRELATION] ?? "") || nouvelIdentifiant();
    const de = String(entrant[EN_TETE_APPELANT] ?? "") || "navigateur";
    // Les sondes de la console tournent à 1 Hz et représenteraient l'essentiel du
    // trafic journalisé. On les marque à l'émission et on ne les raconte pas : un
    // journal projeté en salle doit tenir dans un écran, et une sonde qui réussit
    // n'apprend rien. Seules les TRANSITIONS produisent une ligne, côté console.
    const estSonde = entrant[EN_TETE_SONDE] !== undefined;

    const origineAppelante = String(entrant["origin"] ?? "");
    const entetes = {
      // La page est servie par Vite, les services par eux-mêmes : deux origines,
      // donc CORS. On n'ouvre qu'aux origines de la page, pas à `*` — la
      // démonstration parle de frontières, elle peut bien tenir la sienne.
      "Access-Control-Allow-Origin": ORIGINES_PAGE.includes(origineAppelante)
        ? origineAppelante
        : ORIGINES_PAGE[0],
      "Access-Control-Expose-Headers": EXPOSES,
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/json; charset=utf-8",
      [EN_TETE_CORRELATION]: id,
    };

    void (async () => {
      /** @type {Reponse} */
      let resultat;
      try {
        resultat = await router({
          chemin: url.pathname,
          parametres: url.searchParams,
          methode: requete.method ?? "GET",
          id,
          de,
        });
      } catch (erreur) {
        resultat = {
          status: 500,
          corps: { erreur: "défaillance interne", detail: String(erreur), service: nom, id },
        };
      }

      const corps =
        resultat.texte !== undefined
          ? resultat.texte
          : resultat.corps === undefined
            ? ""
            : JSON.stringify(resultat.corps);

      reponse.writeHead(resultat.status, { ...entetes, ...resultat.entetes });
      reponse.end(corps);

      if (!estSonde) {
        journaliser({
          service: nom,
          nature: "requete",
          methode: requete.method ?? "GET",
          chemin: url.pathname,
          status: resultat.status,
          dureeMs: Math.round(performance.now() - debut),
          id,
          de,
          niveau: resultat.status >= 400 ? "attention" : "normal",
        });
      }
    })();
  });

  serveur.on("error", (/** @type {NodeJS.ErrnoException} */ erreur) => {
    if (erreur.code === "EADDRINUSE") {
      process.stderr.write(
        `Le port ${port} est déjà occupé (service ${nom}).\n` +
          `  Pour le voir :     lsof -nP -iTCP:${port} -sTCP:LISTEN\n` +
          `  Pour tout arrêter : pkill -f "src/bas/services"\n`,
      );
    } else {
      process.stderr.write(`Service ${nom}, port ${port} : ${erreur.message}\n`);
    }
    process.exit(1);
  });

  serveur.listen(port, "127.0.0.1", () => {
    journaliser({ service: nom, nature: "note", message: `à l'écoute sur 127.0.0.1:${port}` });
  });

  // SIGTERM est le signal de l'essai « tuer le service ». On le laisse tuer : un
  // arrêt gracieux qui draine les connexions produirait une panne polie, alors que
  // l'essai a besoin d'un refus de connexion franc.
  process.on("SIGTERM", () => {
    journaliser({ service: nom, nature: "note", message: "SIGTERM reçu, arrêt", niveau: "attention" });
    process.exit(0);
  });

  return serveur;
}

/**
 * @typedef {object} Resultat
 * @property {boolean} ok
 * @property {number} [status]
 * @property {unknown} [corps]
 * @property {string} [cause]     Qualification de la panne, quand il y en a une.
 * @property {number} dureeMs
 */

/**
 * Le client HTTP des services.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI `node:http` ET NON `fetch`
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Mesuré sur cette machine, Node 26 : le `fetch` global stalle environ deux secondes
 * dès qu'il RÉUTILISE une connexion persistante vers un serveur `node:http`. Une
 * requête sur deux, à cadence d'une par seconde. `curl` et `node:http` avec le même
 * serveur : trois millisecondes, sans exception.
 *
 * Ce n'est pas un détail de performance, c'est une question d'intégrité. Les sondes
 * de la console tournent à 1 Hz : avec `fetch`, elles inventaient une panne sur deux,
 * et le journal affichait « ne répond plus » pour un service en parfait état. Un
 * dispositif dont la thèse est que le réseau qualifie honnêtement les pannes ne peut
 * pas se permettre un observateur qui en fabrique.
 *
 * Bénéfice secondaire, et il est réel : `node:http` remet le code d'erreur
 * directement sur l'erreur (`err.code`), là où `fetch` l'enterre dans `.cause.code`
 * et remplace le délai par un `TimeoutError` anonyme.
 */
const agent = new Agent({ keepAlive: true, maxSockets: 8 });

/**
 * Appelle un service en amont, sans jamais lever.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * C'EST ICI QUE VIT LA QUALIFICATION DES PANNES
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Node distingue les causes : `ECONNREFUSED` quand personne n'écoute, un délai
 * dépassé quand le processus est vivant mais muet, `ENOTFOUND` quand le nom n'existe
 * pas. Le navigateur, lui, rend `TypeError: Failed to fetch` pour les trois — et pour
 * un refus CORS par-dessus le marché. Il le fait exprès : dire à une page pourquoi un
 * appel a échoué reviendrait à lui laisser sonder le réseau de la machine.
 *
 * Conséquence directe pour l'étude : déplacer une frontière de service vers le
 * navigateur ne coûte pas seulement le code d'état, il coûte la CAUSE. Un
 * intermédiaire côté réseau est le dernier endroit où elle est encore lisible, et
 * c'est mesurable en jouant le même essai dans les deux modes.
 *
 * @param {string} url
 * @param {object} options
 * @param {string} options.id
 * @param {string} options.appelant
 * @param {number} options.budgetMs
 * @param {Record<string, string>} [options.entetes]
 * @returns {Promise<Resultat>}
 */
export function appeler(url, { id, appelant, budgetMs, entetes = {} }) {
  return new Promise((resoudre) => {
    const debut = performance.now();
    const cible = new URL(url);
    const duree = () => Math.round(performance.now() - debut);

    let repondu = false;
    /** @param {Resultat} resultat */
    const rendre = (resultat) => {
      if (repondu) return;
      repondu = true;
      resoudre(resultat);
    };

    const requete = request(
      {
        agent,
        host: cible.hostname,
        port: cible.port,
        path: `${cible.pathname}${cible.search}`,
        headers: { [EN_TETE_CORRELATION]: id, [EN_TETE_APPELANT]: appelant, ...entetes },
      },
      (reponse) => {
        let texte = "";
        reponse.setEncoding("utf8");
        reponse.on("data", (morceau) => {
          texte += morceau;
        });
        reponse.on("end", () => {
          const status = reponse.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            rendre({ ok: false, status, cause: `HTTP ${status}`, dureeMs: duree() });
            return;
          }
          try {
            rendre({ ok: true, status, corps: JSON.parse(texte), dureeMs: duree() });
          } catch {
            rendre({ ok: false, status, cause: "réponse illisible : JSON invalide", dureeMs: duree() });
          }
        });
      },
    );

    // Silence du socket : c'est la panne d'un processus VIVANT mais figé. Elle ne
    // ressemble à rien d'autre, et c'est la seule que `fetch` ne sait pas nommer.
    requete.setTimeout(budgetMs, () => {
      requete.destroy(Object.assign(new Error("budget"), { code: "BUDGET_DEPASSE" }));
    });

    requete.on("error", (erreur) => rendre({ ok: false, cause: qualifier(erreur), dureeMs: duree() }));
    requete.end();
  });
}

/** @param {NodeJS.ErrnoException} erreur */
function qualifier(erreur) {
  if (erreur.code === "BUDGET_DEPASSE") return "budget de délai dépassé";
  if (erreur.code) return erreur.code;
  return `${erreur.name}: ${erreur.message}`;
}

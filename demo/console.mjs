#!/usr/bin/env node
// @ts-check
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { origine, ORIGINES_PAGE, PORTS } from "../reel/pods/_socle/adresses.mjs";
import { appeler, EN_TETE_SONDE } from "../reel/pods/_socle/socle-service.mjs";

/**
 * La console.
 *
 * Elle lance les trois services, collecte leur journal, observe leur état, et
 * exécute les commandes de la barre d'essais.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ELLE N'EST PAS DANS L'ARCHITECTURE ÉTUDIÉE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * C'est l'établi, pas un composant. Elle occupe la place de la main de l'opérateur
 * et du collecteur de journaux, deux choses qui existent dans tout système réel mais
 * dont aucune ne participe à la comparaison. L'écran l'étiquette comme telle : si on
 * la laissait passer pour un élément de l'architecture, on prêterait à la moitié
 * basse une pièce qu'elle n'a pas.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEUX ORIGINES DE LIGNES, JAMAIS CONFONDUES
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La console déclenche les pannes ET collecte le journal. Si les lignes étaient
 * indistinctes, on pourrait légitimement soupçonner le journal de raconter ce que la
 * console a décidé plutôt que ce qui s'est produit. Chaque ligne porte donc son
 * origine, et l'écran les distingue :
 *
 *   origine « service »  — rapporté par le processus concerné, sur SA sortie
 *                          standard. La console n'y touche pas, elle transporte.
 *   origine « console »  — constaté ou décidé ici. Trois natures :
 *                            commande  ce que la console a demandé
 *                            systeme   un fait du système d'exploitation qu'elle a
 *                                      observé — une sortie de processus, un signal
 *                            note      son propre fonctionnement
 *
 * Une même panne produit donc jusqu'à trois lignes de deux origines : l'intention de
 * la console, le compte rendu du service, puis le fait système. Elles se corroborent
 * ou se contredisent, et c'est vérifiable à l'écran.
 *
 * Un cas mérite d'être remarqué en salle : quand on tue un service, sa dernière
 * ligne est de SON origine — il rapporte lui-même avoir reçu SIGTERM — et la ligne
 * suivante est de la nôtre. La console voit la mort comme fait système, ce qu'aucun
 * observateur HTTP ne peut voir : c'est ce que la version simulée ne savait pas faire.
 */

const RACINE = dirname(fileURLToPath(import.meta.url));
const DEPOT = resolve(RACINE, "..");

const AVEC_VITE = process.argv.includes("--avec-vite");

/**
 * Les trois services. La console n'en fait pas partie.
 *
 * @type {readonly { nom: import("../reel/pods/_socle/adresses.mjs").NomService, port: number, fichier: string }[]}
 *
 * `fichier` est désormais relatif à la racine du dépôt (`DEPOT`), pas à ce fichier
 * (`RACINE`) : les trois services ne sont plus siblings de la console. `taches` pointe
 * sur le hook de démo, jamais sur le pod réel directement — c'est le hook qui compose
 * le routeur réel avec les routes d'injection de panne.
 */
const SERVICES = [
  { nom: "taches", port: PORTS.taches, fichier: "demo/hooks/taches.mjs" },
  { nom: "charges", port: PORTS.charges, fichier: "reel/pods/charges/service.mjs" },
  { nom: "passerelle", port: PORTS.passerelle, fichier: "reel/pods/passerelle/service.mjs" },
];

const PLAFOND_JOURNAL = 300;
const PERIODE_SONDE_MS = 1000;
const BUDGET_SONDE_MS = 400;

/*
 * Combien de temps la commande `demarrer` attend que le service écoute. Voir
 * `attendreEcoute`. Mesuré : 78 ms entre le retour de `spawn` et la première
 * connexion acceptée. 3 secondes est donc large de deux ordres de grandeur — c'est
 * voulu, parce que dépasser ce délai n'échoue pas : la commande rend `pret: false`,
 * ce qui est un fait exploitable, alors qu'un délai trop court rendrait ce fait faux.
 *
 * Le pas de 20 ms n'est pas la période des sondes : ces sondes-là sont ponctuelles,
 * bornées à un démarrage, et ne tournent pas en fond.
 */
const DELAI_ECOUTE_MS = 3000;
const PAS_ECOUTE_MS = 20;

/** Vite, quand on l'a lancé d'ici. Il n'est pas un service et n'entre dans aucune vue. */
/** @type {import("node:child_process").ChildProcess[]} */
const enfantsAnnexes = [];

/* ------------------------------------------------------------------ le journal */

/**
 * @typedef {object} Ligne
 * @property {string} [cle]
 * @property {"service" | "console"} origine
 * @property {string} [service]
 * @property {number} [horodatage]
 * @property {"requete" | "note" | "commande" | "systeme"} nature
 * @property {string} [methode]
 * @property {string} [chemin]
 * @property {number} [status]
 * @property {number} [dureeMs]
 * @property {string} [id]
 * @property {string} [de]
 * @property {string} [message]
 * @property {"normal" | "attention"} [niveau]
 */

let compteurCle = 0;
/** @type {Ligne[]} */
const journal = [];
/** @type {Set<import("node:http").ServerResponse>} */
const abonnes = new Set();

/** @param {unknown} message */
function diffuser(message) {
  const ligne = `${JSON.stringify(message)}\n`;
  for (const flux of abonnes) flux.write(ligne);
}

/** @param {Ligne} ligne */
function pousser(ligne) {
  compteurCle += 1;
  /** @type {Ligne} */
  const complete = { horodatage: Date.now(), ...ligne, cle: `l${compteurCle}` };
  journal.push(complete);
  if (journal.length > PLAFOND_JOURNAL) journal.splice(0, journal.length - PLAFOND_JOURNAL);
  diffuser({ t: "journal", ligne: complete });
  echo(complete);
  return complete;
}

/**
 * Ligne constatée ou décidée ici. Voir l'en-tête : l'origine n'est pas décorative,
 * c'est ce qui empêche de confondre ce que la console a voulu avec ce qui a eu lieu.
 *
 * @param {"commande" | "systeme" | "note"} nature
 * @param {string} message
 * @param {Partial<Ligne>} [extra]
 */
function ligneConsole(nature, message, extra = {}) {
  return pousser({ ...extra, origine: "console", nature, message });
}

/**
 * Rendu compact sur le terminal, pour qui regarde le terminal plutôt que la page.
 *
 * @param {Ligne} ligne
 */
function echo(ligne) {
  const marque = ligne.origine === "console" ? "»" : " ";
  if (ligne.nature === "requete") {
    const cible = `${ligne.methode} ${ligne.chemin}`.padEnd(22);
    console.log(
      `  ${marque} ${String(ligne.service).padEnd(11)} ${String(ligne.status).padEnd(4)} ${cible} ` +
        `${String(ligne.dureeMs).padStart(4)} ms  ${ligne.de} → ${ligne.service}  id=${ligne.id}`,
    );
    return;
  }
  console.log(`  ${marque} ${String(ligne.service ?? "console").padEnd(11)}      ${ligne.message ?? ""}`);
}

/* -------------------------------------------------------------- les processus */

/**
 * @typedef {object} EtatProcessus
 * @property {import("../reel/pods/_socle/adresses.mjs").NomService} nom
 * @property {number} port
 * @property {number} [pid]
 * @property {boolean} vivant       Le processus existe.
 * @property {boolean} repond       Il répond aux sondes. Ce n'est pas la même chose.
 * @property {boolean} fige         SIGSTOP envoyé, SIGCONT pas encore.
 * @property {number} [depuis]
 * @property {number} requetes
 * @property {number} [dernierStatus]
 * @property {import("node:child_process").ChildProcess} [enfant]
 * @property {boolean} arretVoulu   Distingue une sortie commandée d'une sortie subie.
 */

/** @type {Map<string, EtatProcessus>} */
const etats = new Map();

for (const service of SERVICES) {
  etats.set(service.nom, {
    nom: service.nom,
    port: service.port,
    pid: undefined,
    vivant: false,
    repond: false,
    fige: false,
    depuis: undefined,
    requetes: 0,
    dernierStatus: undefined,
    enfant: undefined,
    arretVoulu: false,
  });
}

function instantaneProcessus() {
  return [...etats.values()].map(({ enfant: _enfant, depuis, ...reste }) => ({
    ...reste,
    depuisMs: depuis === undefined ? undefined : Date.now() - depuis,
  }));
}

function diffuserProcessus() {
  diffuser({ t: "processus", horodatage: Date.now(), processus: instantaneProcessus() });
}

/**
 * Lit un flux de sortie ligne à ligne. Les services écrivent du NDJSON sur leur
 * sortie standard ; tout ce qui n'est pas du JSON valide est du texte que quelqu'un
 * a écrit sans le vouloir, et il vaut mieux le voir que le perdre.
 */
function lireLignes(/** @type {import("node:stream").Readable} */ flux, /** @type {(ligne: string) => void} */ surLigne) {
  let reste = "";
  flux.setEncoding("utf8");
  flux.on("data", (/** @type {string} */ morceau) => {
    reste += morceau;
    const lignes = reste.split("\n");
    reste = lignes.pop() ?? "";
    for (const ligne of lignes) if (ligne.trim() !== "") surLigne(ligne);
  });
}

/** @param {string} nom */
function demarrerService(nom) {
  const service = SERVICES.find((candidat) => candidat.nom === nom);
  const etat = etats.get(nom);
  if (!service || !etat) throw new Error(`service inconnu : ${nom}`);
  if (etat.enfant) return false;

  // `service.fichier` est relatif à la racine du dépôt (voir la définition de
  // SERVICES) : taches/charges/passerelle ne sont plus siblings de ce fichier.
  const enfant = spawn(process.execPath, [join(DEPOT, service.fichier)], {
    stdio: ["ignore", "pipe", "pipe"],
    cwd: DEPOT,
  });

  etat.enfant = enfant;
  etat.pid = enfant.pid;
  etat.vivant = true;
  etat.fige = false;
  etat.depuis = Date.now();
  etat.arretVoulu = false;

  lireLignes(enfant.stdout, (/** @type {string} */ brute) => {
    try {
      /** @type {Ligne} */
      const ligne = JSON.parse(brute);
      if (ligne.nature === "requete") {
        etat.requetes += 1;
        etat.dernierStatus = ligne.status;
        diffuserProcessus();
      }
      pousser(ligne);
    } catch {
      pousser({ origine: "service", service: nom, nature: "note", message: brute });
    }
  });

  lireLignes(enfant.stderr, (/** @type {string} */ brute) => {
    pousser({ origine: "service", service: nom, nature: "note", niveau: "attention", message: brute });
  });

  enfant.on("exit", (code, signal) => {
    etat.enfant = undefined;
    etat.pid = undefined;
    etat.vivant = false;
    etat.repond = false;
    etat.fige = false;
    etat.depuis = undefined;
    // Fait système, pas rapport de service : le processus est mort, il ne peut plus
    // rien dire de lui-même. C'est précisément ce qu'aucun observateur HTTP ne voit.
    ligneConsole(
      "systeme",
      etat.arretVoulu
        ? `processus sorti — code ${code}, signal ${signal}`
        : `processus sorti SANS commande — code ${code}, signal ${signal}`,
      { service: nom, niveau: "attention" },
    );
    diffuserProcessus();
  });

  ligneConsole("commande", `processus lancé — pid ${enfant.pid}, port ${service.port}`, { service: nom });
  diffuserProcessus();
  return true;
}

/**
 * @param {string} nom
 * @param {NodeJS.Signals} signal
 * @param {string} intitule
 */
function signaler(nom, signal, intitule) {
  const etat = etats.get(nom);
  if (!etat?.enfant) throw new Error(`le service ${nom} ne tourne pas`);

  if (signal === "SIGTERM") etat.arretVoulu = true;
  if (signal === "SIGSTOP") etat.fige = true;
  if (signal === "SIGCONT") etat.fige = false;

  etat.enfant.kill(signal);
  ligneConsole("commande", `${intitule} — ${signal} envoyé au pid ${etat.pid}`, {
    service: nom,
    niveau: signal === "SIGCONT" ? "normal" : "attention",
  });
  diffuserProcessus();
}

/* ------------------------------------------------------------------ les sondes */

/**
 * L'état d'un processus ne suffit pas : un processus figé par SIGSTOP est VIVANT et
 * ne répond pas. La distinction entre « mort » et « vivant mais muet » n'existe que
 * si on interroge le réseau, et c'est toute la différence entre l'essai 1 et
 * l'essai 3.
 *
 * Les sondes sont marquées, et les services ne les journalisent pas : sans ce
 * filtre, elles représenteraient l'essentiel des lignes. Seules les TRANSITIONS
 * produisent une ligne.
 */
async function sonder() {
  for (const service of SERVICES) {
    const etat = etats.get(service.nom);
    if (!etat) continue;

    let repond = false;
    if (etat.enfant) {
      const sonde = await appeler(`${origine(service.nom)}/sante`, {
        id: "sonde",
        appelant: "console",
        budgetMs: BUDGET_SONDE_MS,
        entetes: { [EN_TETE_SONDE]: "1" },
      });
      repond = sonde.ok;
    }

    if (repond !== etat.repond) {
      etat.repond = repond;
      ligneConsole(
        "systeme",
        repond
          ? "répond de nouveau aux sondes"
          : etat.fige
            ? "ne répond plus aux sondes — processus vivant, figé"
            : "ne répond plus aux sondes",
        { service: service.nom, niveau: repond ? "normal" : "attention" },
      );
      diffuserProcessus();
    }
  }
}

/**
 * Attend qu'un service fraîchement lancé RÉPONDE, et pas seulement qu'il existe.
 *
 * `spawn` rend la main dès que le processus est créé. Mesuré sur cette machine :
 * `demarrer` répondait au bout de 39 ms, et `charges` n'acceptait sa première
 * connexion qu'à 116 ms. Soit 78 ms pendant lesquels la console affirmait
 * « démarré » à propos d'un port fermé.
 *
 * Ces 78 ms coûtaient l'essai 1. La page rechargeait ses données aussitôt la
 * commande revenue, la passerelle prenait un ECONNREFUSED, dégradait en 200 partiel
 * sans agrégat — et `mf-charge` restait sur « En attente de l'agrégat. »
 * indéfiniment, parce que rien ne recharge après coup. L'écran annonçait alors
 * « service relancé » en ton nominal au-dessus d'une ligne d'état qui disait
 * ECONNREFUSED : le dispositif se contredisait sur le seul essai dont le résultat
 * est un retour au normal.
 *
 * La console est le PARENT des processus : elle sait qu'un enfant existe sans avoir
 * à le demander. Elle ne sait pas qu'il écoute — ça, il faut le lui demander par le
 * réseau. C'est la distinction `vivant` / `repond` que l'essai 3 met en scène, et
 * elle vaut aussi pour un démarrage.
 *
 * @param {string} nom
 * @param {number} [delaiMaxMs]
 */
async function attendreEcoute(nom, delaiMaxMs = DELAI_ECOUTE_MS) {
  // Résolu par la liste, comme `demarrerService` : `origine` n'accepte pas n'importe
  // quelle chaîne, et c'est très bien ainsi.
  const service = SERVICES.find((candidat) => candidat.nom === nom);
  if (!service) return false;

  const debut = Date.now();
  for (;;) {
    const sonde = await appeler(`${origine(service.nom)}/sante`, {
      id: "sonde",
      appelant: "console",
      budgetMs: BUDGET_SONDE_MS,
      entetes: { [EN_TETE_SONDE]: "1" },
    });

    if (sonde.ok) {
      // La transition « répond de nouveau aux sondes » est écrite par `sonder`, et
      // par lui seul. La réécrire ici ferait deux chemins pour un même fait, et le
      // jour où l'un des deux changerait, le journal mentirait à moitié.
      await sonder();
      return true;
    }

    if (Date.now() - debut > delaiMaxMs) return false;
    await new Promise((resoudre) => setTimeout(resoudre, PAS_ECOUTE_MS));
  }
}

/* ------------------------------------------------------------- les commandes */

/**
 * Les commandes passent en GET avec des paramètres d'URL, ce qui n'est pas très beau
 * pour des actions qui modifient l'état. C'est délibéré : un POST en
 * `application/json` déclencherait un préambule CORS `OPTIONS` sur chaque essai, et
 * doublerait les lignes du journal projeté. Le journal doit rester lisible en salle.
 */
/**
 * @param {string} action
 * @param {string} service
 */
async function executer(action, service) {
  switch (action) {
    case "arreter":
      signaler(service, "SIGTERM", "arrêt demandé");
      return { fait: action, service };

    // `pret` n'est pas `demarre`, et les deux sont rendus : le premier dit que le
    // service répond, le second qu'un processus a été créé. Quand `pret` vaut faux,
    // le processus tourne et n'écoute pas encore — l'appelant sait alors qu'il tient
    // une réponse incomplète plutôt que de le déduire d'un silence.
    case "demarrer": {
      const demarre = demarrerService(service);
      const pret = demarre ? await attendreEcoute(service) : true;
      return { fait: action, service, demarre, pret };
    }

    case "figer":
      signaler(service, "SIGSTOP", "gel demandé");
      return { fait: action, service };

    case "degeler":
      signaler(service, "SIGCONT", "dégel demandé");
      return { fait: action, service };

    // Ces quatre-là ne sont pas des signaux : la console relaie une demande au
    // service, par le réseau. Elle journalise son INTENTION ; le service journalise
    // ce qu'il a fait. Les deux lignes doivent se corroborer, et si elles ne le font
    // pas c'est une information.
    case "contrat-rompu":
    case "contrat-retabli":
    case "forme-rompue":
    case "forme-retablie": {
      ligneConsole("commande", `demandé à taches : ${action}`, { service: "taches" });
      const reponse = await appeler(`${origine("taches")}/${action}`, {
        id: "commande",
        appelant: "console",
        budgetMs: 2000,
      });
      if (!reponse.ok) throw new Error(`taches n'a pas pris la commande : ${reponse.cause}`);
      return { fait: action, service: "taches", reponse: reponse.corps };
    }

    case "etat": {
      const lu = await appeler(`${origine("taches")}/etat`, {
        id: "sonde",
        appelant: "console",
        budgetMs: BUDGET_SONDE_MS,
        entetes: { [EN_TETE_SONDE]: "1" },
      });
      // `lisible: false` quand taches est mort ou figé. On le dit plutôt que de
      // renvoyer `false` sur les deux drapeaux : ce serait une réponse inventée, et
      // la barre d'essais afficherait « contrat intact » sans en rien savoir.
      const drapeaux = lu.ok
        ? /** @type {{ contratRompu: boolean, formeRompue: boolean }} */ (lu.corps)
        : { contratRompu: false, formeRompue: false };
      return { ...drapeaux, lisible: lu.ok, processus: instantaneProcessus() };
    }

    default:
      throw new Error(`action inconnue : ${action}`);
  }
}

/* ------------------------------------------------------------------- le serveur */

const serveur = createServer(async (requete, reponse) => {
  const url = new URL(requete.url ?? "/", `http://127.0.0.1:${PORTS.console}`);
  const origineAppelante = String(requete.headers["origin"] ?? "");
  const entetes = {
    "Access-Control-Allow-Origin": ORIGINES_PAGE.includes(origineAppelante)
      ? origineAppelante
      : ORIGINES_PAGE[0],
    "Cache-Control": "no-store, max-age=0",
  };

  if (url.pathname === "/sante") {
    reponse.writeHead(200, { ...entetes, "Content-Type": "application/json" });
    reponse.end(JSON.stringify({ service: "console", vivant: true }));
    return;
  }

  // Instantané ponctuel, pour le terminal (`curl`) et pour la mise au point. La page
  // ne l'appelle pas : elle reçoit le même instantané par le flux `/journal`, poussé
  // à chaque changement. Le noter ici évite de croire à un consommateur qui n'existe pas.
  if (url.pathname === "/processus") {
    reponse.writeHead(200, { ...entetes, "Content-Type": "application/json" });
    reponse.end(JSON.stringify({ processus: instantaneProcessus() }));
    return;
  }

  if (url.pathname === "/commande") {
    try {
      const resultat = await executer(
        url.searchParams.get("action") ?? "",
        url.searchParams.get("service") ?? "",
      );
      reponse.writeHead(200, { ...entetes, "Content-Type": "application/json" });
      reponse.end(JSON.stringify(resultat));
    } catch (erreur) {
      reponse.writeHead(409, { ...entetes, "Content-Type": "application/json" });
      reponse.end(JSON.stringify({ erreur: String(erreur instanceof Error ? erreur.message : erreur) }));
    }
    return;
  }

  if (url.pathname === "/journal") {
    // Réponse jamais close : la page la lit au fur et à mesure avec un
    // `ReadableStream`. On n'utilise pas `EventSource`, qui ne passe pas par
    // `globalThis.fetch` et échapperait donc au garde-réseau de la page — sa
    // couverture cesserait d'être totale, et c'est une propriété qu'on affiche.
    reponse.writeHead(200, {
      ...entetes,
      "Content-Type": "application/x-ndjson; charset=utf-8",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    reponse.write(
      `${JSON.stringify({ t: "processus", horodatage: Date.now(), processus: instantaneProcessus() })}\n`,
    );
    for (const ligne of journal) reponse.write(`${JSON.stringify({ t: "journal", ligne })}\n`);

    abonnes.add(reponse);
    requete.on("close", () => abonnes.delete(reponse));
    return;
  }

  reponse.writeHead(404, { ...entetes, "Content-Type": "text/plain; charset=utf-8" });
  reponse.end(`introuvable : ${url.pathname}`);
});

serveur.on("error", (/** @type {NodeJS.ErrnoException} */ erreur) => {
  if (erreur.code === "EADDRINUSE") {
    console.error(
      `\n  Le port ${PORTS.console} est déjà occupé (console).\n` +
        `  Une session précédente tourne probablement encore.\n` +
        `  Pour la voir :     lsof -nP -iTCP:${PORTS.console} -sTCP:LISTEN\n` +
        `  Pour tout arrêter : pkill -f "reel/pods" ; pkill -f "demo/"\n`,
    );
  } else {
    console.error(`\n  Console, port ${PORTS.console} : ${erreur.message}\n`);
  }
  process.exit(1);
});

serveur.listen(PORTS.console, "127.0.0.1", () => {
  console.log("\nLa frontière — moitié basse, quatre processus\n");
  console.log(`  http://127.0.0.1:${PORTS.console}/   console        établi : journal, sondes, commandes`);
  for (const service of SERVICES) {
    console.log(`  http://127.0.0.1:${service.port}/   ${service.nom.padEnd(14)} ${service.fichier}`);
  }
  console.log("");

  for (const service of SERVICES) demarrerService(service.nom);
  setInterval(() => void sonder(), PERIODE_SONDE_MS).unref();

  if (AVEC_VITE) {
    const vite = spawn(process.execPath, [join(DEPOT, "node_modules", "vite", "bin", "vite.js")], {
      stdio: ["ignore", "inherit", "inherit"],
      cwd: DEPOT,
    });
    enfantsAnnexes.push(vite);
  } else {
    console.log("  La page :  npm run dev   dans un second terminal\n");
  }

  console.log("  Ctrl-C pour tout arrêter.\n");
});

/* ------------------------------------------------------------------- l'arrêt */

let arretEnCours = false;

function toutArreter() {
  if (arretEnCours) return;
  arretEnCours = true;

  for (const etat of etats.values()) {
    if (!etat.enfant) continue;
    // Un processus figé n'entendrait pas SIGTERM : il faut d'abord le réveiller,
    // sinon Ctrl-C laisse un processus arrêté derrière lui, et le port avec.
    if (etat.fige) etat.enfant.kill("SIGCONT");
    etat.enfant.kill("SIGTERM");
  }
  for (const annexe of enfantsAnnexes) annexe.kill("SIGTERM");

  serveur.close();
  setTimeout(() => process.exit(0), 150).unref();
}

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, toutArreter);
process.on("exit", toutArreter);

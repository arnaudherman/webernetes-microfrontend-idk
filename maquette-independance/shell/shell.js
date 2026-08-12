/**
 * Le shell de composition.
 *
 * Il n'est pas compilé : il est servi tel quel. Il ne connaît aucune équipe — il lit
 * un manifeste qui associe un nom de balise à une URL d'artefact, et charge chaque URL
 * par un `import()` dynamique.
 *
 * Le manifeste est du CODE MAISON. Aucune spécification du web ne le définit. C'est la
 * première des choses qui restent à construire.
 */

const zoneFragments = document.querySelector("#fragments");
const zoneCarte = document.querySelector("#carte-import");
const journalChargement = document.querySelector("#journal-chargement");
const journalBus = document.querySelector("#journal-bus");

function heure() {
  const maintenant = new Date();
  const deux = (valeur, taille = 2) => String(valeur).padStart(taille, "0");
  return `${deux(maintenant.getHours())}:${deux(maintenant.getMinutes())}:${deux(
    maintenant.getSeconds(),
  )}.${deux(maintenant.getMilliseconds(), 3)}`;
}

function noter(journal, niveau, marque, texte) {
  const ligne = document.createElement("li");
  ligne.dataset.niveau = niveau;

  const quand = document.createElement("span");
  quand.className = "heure";
  quand.textContent = heure();

  const etiquette = document.createElement("span");
  etiquette.className = "marque";
  etiquette.textContent = marque;

  const contenu = document.createElement("span");
  contenu.className = "texte";
  contenu.textContent = texte;

  ligne.append(quand, etiquette, contenu);
  journal.append(ligne);
  journal.parentElement.scrollTop = journal.parentElement.scrollHeight;
}

/* --------------------------------------------------- la carte d'import active */

const balise = document.querySelector('script[type="importmap"]');
zoneCarte.textContent = JSON.stringify(JSON.parse(balise.textContent), null, 2);

/* ------------------------------------------------- trace des messages du bus */

globalThis.addEventListener("socle:trace", (evenement) => {
  const { type, evenement: nom, source, abonnes, charge, socle, ecarts } = evenement.detail;

  if (type === "abonnement") {
    noter(journalBus, "ok", "abonne", `${evenement.detail.idAbonne} → ${nom}   [${socle.identifiant}]`);
    return;
  }

  // Une charge utile qui ne respecte pas le contrat n'est remise à personne, et le
  // motif exact est dit. C'est ce que l'essai 5 de la démonstration principale n'a pas.
  if (type === "refus") {
    noter(
      journalBus,
      "echec",
      "REFUSÉ",
      `${nom} ← ${source}   ${JSON.stringify(charge)}   ${ecarts.join(" · ")}`,
    );
    return;
  }

  const perdu = abonnes.length === 0;
  noter(
    journalBus,
    perdu ? "perdu" : "ok",
    perdu ? "0 abonné" : `${abonnes.length} abonné${abonnes.length > 1 ? "s" : ""}`,
    `${nom} ← ${source}   ${JSON.stringify(charge)}   [${socle.identifiant}]`,
  );
});

/* ------------------------------------------------------------- diagnostic */

/**
 * Le navigateur rend le MÊME `TypeError: Failed to fetch dynamically imported module`
 * pour une origine injoignable, un refus CORS, un 404, un 500 et une empreinte
 * d'intégrité incorrecte. C'est une protection, pas un diagnostic : l'application
 * ne peut pas distinguer un artefact corrompu d'un serveur mal configuré.
 *
 * Rien dans la plateforme ne comble ce trou. Ce qui suit est du code maison, et c'est
 * précisément le genre de code que « l'observabilité de la frontière front est un
 * prérequis, pas une amélioration ultérieure » veut dire concrètement : une trentaine
 * de lignes par frontière, à écrire, tester et maintenir.
 *
 * Deux limites, à énoncer plutôt qu'à masquer :
 *  - le diagnostic est une SECONDE requête. Une panne transitoire peut donc réussir
 *    ici alors que l'import a échoué, et inversement ;
 *  - `crypto.subtle` exige un contexte sécurisé. localhost en est un, un serveur
 *    interne en http nu n'en est pas un : le contrôle d'empreinte y serait impossible.
 */
async function diagnostiquer(url, integriteAttendue) {
  const origine = new URL(url).origin;

  let reponse;
  try {
    reponse = await fetch(url, { cache: "no-store" });
  } catch (erreur) {
    // La requête n'a pas abouti. Est-ce l'origine qui est morte, ou le partage
    // d'origine qui est refusé ? Une requête opaque tranche.
    try {
      await fetch(url, { mode: "no-cors", cache: "no-store" });
      return {
        cause: "CORS",
        detail: `${origine} répond, mais refuse le partage d'origine — en-tête Access-Control-Allow-Origin absent`,
      };
    } catch {
      return { cause: "origine", detail: `${origine} est injoignable — ${erreur.message}` };
    }
  }

  if (!reponse.ok) {
    return { cause: `HTTP ${reponse.status}`, detail: `le serveur a répondu ${reponse.status} sur ${url}` };
  }

  const octets = await reponse.arrayBuffer();

  if (!integriteAttendue) {
    return {
      cause: "module",
      detail: "artefact joignable, aucune empreinte déclarée — l'échec vient du module lui-même",
    };
  }

  if (!globalThis.isSecureContext || !globalThis.crypto?.subtle) {
    return { cause: "indéterminée", detail: "contexte non sécurisé : empreinte non vérifiable" };
  }

  const condense = await crypto.subtle.digest("SHA-384", octets);
  const obtenu = `sha384-${btoa(String.fromCharCode(...new Uint8Array(condense)))}`;

  if (obtenu !== integriteAttendue) {
    return {
      cause: "intégrité",
      detail:
        `l'artefact a été modifié après publication — ` +
        `attendu ${integriteAttendue.slice(7, 23)}… , obtenu ${obtenu.slice(7, 23)}…`,
    };
  }

  return {
    cause: "module",
    detail: "artefact joignable et intact : l'échec vient du module (syntaxe, ou import non résolu)",
  };
}

/* ------------------------------------------------------- chargement initial */

let manifesteCharge;

async function charger() {
  let manifeste;
  try {
    const reponse = await fetch("./manifeste.json", { cache: "no-store" });
    manifeste = await reponse.json();
  } catch (erreur) {
    noter(journalChargement, "echec", "manifeste", String(erreur));
    return;
  }

  manifesteCharge = manifeste;
  const fragments = Object.entries(manifeste.fragments ?? {});

  noter(
    journalChargement,
    "ok",
    "manifeste",
    `socle ${manifeste.socle?.version ?? "?"} · ` +
      fragments.map(([balise, f]) => `${balise} ${f.version}`).join(" · "),
  );

  for (const [nomBalise, fragment] of fragments) {
    // Le try/catch est le SEUL endroit du dispositif où une panne de frontière
    // devient observable. Sans lui, un fragment absent disparaît en silence.
    try {
      await import(fragment.url);
      noter(journalChargement, "ok", `v${fragment.version}`, `<${nomBalise}>  ${fragment.url}`);
      monter(nomBalise);
    } catch (erreur) {
      noter(
        journalChargement,
        "echec",
        "échec",
        `<${nomBalise}> ${fragment.version}  ${erreur.name} : ${erreur.message}`,
      );
      const verdict = await diagnostiquer(fragment.url, fragment.integrity);
      noter(journalChargement, "echec", verdict.cause, verdict.detail);
    }
  }

  await enregistrerAssemblage(manifeste);
}

function monter(nomBalise) {
  if (!customElements.get(nomBalise)) {
    noter(journalChargement, "echec", "absent", `<${nomBalise}> n'est pas enregistré`);
    return;
  }
  zoneFragments.append(document.createElement(nomBalise));
}

/* ------------------------------------------------- test de fumée d'assemblage */

/**
 * Le test de fumée qui transforme la porte de déploiement d'une DÉCLARATION en une
 * PREUVE. Il charge, il publie, il constate — puis il poste son verdict au serveur,
 * qui enregistre l'assemblage.
 *
 * Quatre contrôles, dans l'ordre du plus décisif au plus fin :
 *   1. tous les fragments déclarés sont montés ;
 *   2. il n'existe qu'UNE instance du socle — c'est ce contrôle qui attrape le piège
 *      de la coexistence de versions, celui qui casse le partage d'état en silence ;
 *   3. une charge conforme publiée sur un événement contractualisé est acceptée ;
 *   4. elle atteint au moins un abonné.
 *
 * Ce que ce test ne fait PAS : vérifier que la combinaison est fonctionnellement
 * juste. Un test de fumée constate qu'elle démarre et que les messages passent.
 */
async function testerAssemblage(manifeste) {
  const controles = [];
  const fragments = Object.keys(manifeste.fragments ?? {});

  const manquants = fragments.filter((balise) => !document.querySelector(balise));
  controles.push({
    nom: "fragments montés",
    ok: manquants.length === 0,
    detail: manquants.length === 0 ? `${fragments.length} montés` : `absents : ${manquants.join(", ")}`,
  });

  const instances = globalThis.__instancesSocle ?? [];
  controles.push({
    nom: "instance unique du socle",
    ok: instances.length === 1,
    detail: instances.map((i) => i.identifiant).join(" + ") || "aucune",
  });

  let bus;
  try {
    bus = await import("@socle/bus");
  } catch (erreur) {
    controles.push({ nom: "socle importable", ok: false, detail: erreur.message });
    return { ok: false, controles };
  }

  const sonde = bus.publier("filtre:change", { statut: "tous" }, "assemblage");
  // Le socle 3.0 rend un verdict ; les versions antérieures rendaient un entier.
  const refuse = typeof sonde === "object" ? sonde.refuse : false;
  const atteints = typeof sonde === "object" ? sonde.abonnes.length : sonde;

  controles.push({
    nom: "charge conforme acceptée",
    ok: !refuse,
    detail: refuse ? (sonde.ecarts ?? []).join(" · ") : "contrat respecté",
  });
  controles.push({
    nom: "au moins un abonné atteint",
    ok: atteints > 0,
    detail: `${atteints} abonné(s)`,
  });

  return { ok: controles.every((c) => c.ok), controles };
}

async function enregistrerAssemblage(manifeste) {
  const verdict = await testerAssemblage(manifeste);

  for (const controle of verdict.controles) {
    noter(journalChargement, controle.ok ? "ok" : "echec", controle.ok ? "vérifié" : "ÉCHEC",
      `${controle.nom} — ${controle.detail}`);
  }

  if (!verdict.ok) {
    noter(journalChargement, "echec", "assemblage", "test de fumée en échec : rien n'a été enregistré");
    return;
  }

  const preuve =
    `test de fumée du shell, ${verdict.controles.length} contrôles — ` +
    navigator.userAgent.split(") ").at(-1);

  try {
    const reponse = await fetch("/assemblage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict, preuve }),
    });
    const corps = await reponse.json();
    noter(
      journalChargement,
      corps.enregistre ? "ok" : "echec",
      corps.enregistre ? "assemblé" : "refusé",
      corps.enregistre ? corps.cle : corps.motif,
    );
  } catch (erreur) {
    noter(journalChargement, "echec", "assemblage", `enregistrement impossible : ${erreur.message}`);
  }
}

/* -------------------------------------------------------------------- essais */

document.querySelector("#recenser").addEventListener("click", () => {
  const instances = globalThis.__instancesSocle ?? [];
  noter(
    journalChargement,
    instances.length > 1 ? "perdu" : "ok",
    `${instances.length} instance${instances.length > 1 ? "s" : ""}`,
    instances.map((instance) => `${instance.identifiant} ← ${instance.url}`).join("   |   ") ||
      "aucune",
  );
});

document.querySelector("#concurrent").addEventListener("click", async () => {
  const url = manifesteCharge?.concurrent?.url;
  if (!url) {
    noter(journalChargement, "echec", "manifeste", "aucune entrée « concurrent » dans le manifeste");
    return;
  }
  try {
    await import(url);
    noter(journalChargement, "ok", "chargé", `dépôt concurrent  ${url}`);
  } catch (erreur) {
    noter(
      journalChargement,
      "echec",
      "échec",
      `dépôt concurrent  ${erreur.name} : ${erreur.message}`,
    );
  }
});

document.querySelector("#sans-cors").addEventListener("click", async () => {
  const url = manifesteCharge?.sansCors?.url;
  if (!url) {
    noter(journalChargement, "echec", "manifeste", "aucune entrée « sansCors » dans le manifeste");
    return;
  }
  try {
    await import(url);
    noter(journalChargement, "ok", "chargé", `origine sans CORS  ${url}`);
  } catch (erreur) {
    noter(
      journalChargement,
      "echec",
      "échec",
      `origine sans CORS  ${erreur.name} : ${erreur.message}`,
    );
    const verdict = await diagnostiquer(url, undefined);
    noter(journalChargement, "echec", verdict.cause, verdict.detail);
  }
});

document.querySelector("#recharger").addEventListener("click", () => {
  globalThis.location.reload();
});

await charger();

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
  const { type, evenement: nom, source, abonnes, charge, socle } = evenement.detail;

  if (type === "abonnement") {
    noter(journalBus, "ok", "abonne", `${evenement.detail.idAbonne} → ${nom}   [${socle.identifiant}]`);
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

/* ------------------------------------------------------- chargement initial */

async function charger() {
  let manifeste;
  try {
    const reponse = await fetch("./manifeste.json", { cache: "no-store" });
    manifeste = await reponse.json();
  } catch (erreur) {
    noter(journalChargement, "echec", "manifeste", String(erreur));
    return;
  }

  noter(
    journalChargement,
    "ok",
    "manifeste",
    `${Object.keys(manifeste).length} fragment(s) déclaré(s)`,
  );

  for (const [nomBalise, url] of Object.entries(manifeste)) {
    // Le try/catch est le SEUL endroit du dispositif où une panne de frontière
    // devient observable. Sans lui, un fragment absent disparaît en silence.
    try {
      await import(url);
      noter(journalChargement, "ok", "chargé", `<${nomBalise}>  ${url}`);
      monter(nomBalise);
    } catch (erreur) {
      noter(
        journalChargement,
        "echec",
        "échec",
        `<${nomBalise}>  ${erreur.name} : ${erreur.message}`,
      );
    }
  }
}

function monter(nomBalise) {
  if (!customElements.get(nomBalise)) {
    noter(journalChargement, "echec", "absent", `<${nomBalise}> n'est pas enregistré`);
    return;
  }
  zoneFragments.append(document.createElement(nomBalise));
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
  const url = "http://localhost:5104/mf-tableau.js";
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
  const url = "http://localhost:5105/mf-orphelin.js";
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
  }
});

document.querySelector("#recharger").addEventListener("click", () => {
  globalThis.location.reload();
});

await charger();

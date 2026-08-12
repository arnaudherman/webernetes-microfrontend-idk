/**
 * Le registre des contrats — version 3.0, publiée par l'ÉQUIPE SOCLE.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUI POSSÈDE LE SCHÉMA ?
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Si le schéma était déclaré par le PRODUCTEUR, la vérification ne vaudrait rien :
 * une équipe qui renomme `statut` en `etat` renommerait aussi son schéma, et le
 * contrôle passerait. Le contrat ne serait qu'un miroir du code qu'il contraint.
 *
 * Le schéma vit donc dans le socle partagé. Conséquence : faire évoluer un contrat
 * devient une livraison du socle. La vérification ne supprime pas la coordination,
 * elle la déplace — du moment où la panne se produit vers le moment où le contrat
 * change. C'est un bien meilleur moment, mais ce n'est pas gratuit.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE LA 3.0 VÉRIFIE EN PLUS DE LA FORME
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * La 1.0 ne voyait que présence, type primitif et champ inattendu. Elle laissait donc
 * passer le bug le plus fréquent dans la vraie vie : une valeur bien typée mais
 * illégale. `{ statut: "en_cours" }` — trait de soulignement au lieu du tiret — est une
 * chaîne, présente, sans champ surnuméraire. La 1.0 l'accepte. Le consommateur ne
 * filtre alors plus rien, et se croit juste.
 *
 * La 3.0 ajoute quatre contrôles :
 *
 *   valeurs   ensemble fermé de valeurs légales
 *   borne     minimum et maximum pour les nombres
 *   entier    refus des décimaux là où ils n'ont pas de sens
 *   regles    prédicats portant sur PLUSIEURS champs à la fois
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QU'AUCUN VALIDATEUR N'ATTRAPERA JAMAIS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Une unité changée en silence. `chargeJours: 16` où 16 désigne des heures traverse
 * tous les contrôles ci-dessus : c'est un nombre, dans les bornes, entier.
 *
 * La seule parade est de faire porter l'unité PAR LA DONNÉE plutôt que par son nom —
 * `{ valeur: 16, unite: "heures" }` avec `unite` en ensemble fermé. Ce n'est pas une
 * limite de l'outillage : c'est une décision de modélisation. Un validateur ne peut
 * vérifier que ce que quelqu'un a pris la peine d'écrire.
 */

export const VERSION_CONTRATS = "3.0";

const STATUTS = ["tous", "a-faire", "en-cours", "termine"];
const UNITES = ["jours", "heures"];

export const CONTRATS = {
  /**
   * Contrat VERSIONNÉ — c'est ce qui rend la coordination non bloquante.
   *
   * `actives` déclare la fenêtre de migration : une charge est acceptée si elle
   * satisfait N'IMPORTE LAQUELLE des versions actives. Les producteurs migrent quand
   * ils veulent, les consommateurs aussi, chacun à sa cadence.
   *
   * Le motif est celui, éprouvé, d'élargir / migrer / retirer :
   *   1. ÉLARGIR  publier la version 2, ouvrir la fenêtre à ["1", "2"]
   *   2. MIGRER   chaque équipe passe à la 2 quand elle le décide
   *   3. RETIRER  fermer la fenêtre à ["2"] — et là seulement, la 1 est refusée
   *
   * Ce que cela change, et c'est tout le propos : la coordination n'est plus un
   * rendez-vous où tout le monde doit livrer en même temps. Elle devient une fenêtre
   * de temps, déclarée, visible, et que quelqu'un ferme explicitement.
   *
   * Ce que cela ne change pas : quelqu'un doit toujours décider d'ouvrir et de fermer
   * la fenêtre, et surveiller qui n'a pas migré. La coordination est étalée, pas
   * supprimée.
   */
  "filtre:change": {
    actives: ["1", "2"],
    versions: {
      1: {
        requis: {
          statut: { type: "string", valeurs: STATUTS },
        },
        optionnels: {
          responsable: { type: "string" },
          profondeurJours: { type: "number", entier: true, borne: { min: 0, max: 365 } },
        },
        regles: [
          {
            nom: "profondeur-sans-objet",
            verifie: (charge) => !("profondeurJours" in charge) || charge.statut !== "tous",
            message: "profondeurJours n'a pas de sens avec statut « tous »",
          },
        ],
      },
      2: {
        requis: {
          statut: { type: "string", valeurs: STATUTS },
          origine: { type: "string", valeurs: ["utilisateur", "systeme"] },
        },
        optionnels: {
          responsable: { type: "string" },
          profondeurJours: { type: "number", entier: true, borne: { min: 0, max: 365 } },
        },
        regles: [
          {
            nom: "profondeur-sans-objet",
            verifie: (charge) => !("profondeurJours" in charge) || charge.statut !== "tous",
            message: "profondeurJours n'a pas de sens avec statut « tous »",
          },
        ],
      },
    },
  },

  // L'unité est portée par la donnée, pas par le nom du champ : c'est la seule façon
  // de rendre vérifiable un changement d'unité.
  "tache:estimee": {
    requis: {
      id: { type: "string" },
      charge: {
        type: "object",
        forme: {
          valeur: { type: "number", borne: { min: 0, max: 1000 } },
          unite: { type: "string", valeurs: UNITES },
        },
      },
    },
    regles: [
      {
        nom: "estimation-en-jours-plafonnee",
        verifie: (c) => c.charge?.unite !== "jours" || c.charge?.valeur <= 30,
        message: "une estimation en jours au-delà de 30 est probablement en heures",
      },
    ],
  },
};

function verifierValeur(cle, valeur, regle, ecarts) {
  if (regle.type === "object") {
    if (typeof valeur !== "object" || valeur === null || Array.isArray(valeur)) {
      ecarts.push(`${cle} : attendu objet, reçu ${Array.isArray(valeur) ? "tableau" : typeof valeur}`);
      return;
    }
    for (const [sousCle, sousRegle] of Object.entries(regle.forme ?? {})) {
      if (!(sousCle in valeur)) ecarts.push(`champ requis absent : ${cle}.${sousCle}`);
      else verifierValeur(`${cle}.${sousCle}`, valeur[sousCle], sousRegle, ecarts);
    }
    for (const sousCle of Object.keys(valeur)) {
      if (!(sousCle in (regle.forme ?? {}))) ecarts.push(`champ inattendu : ${cle}.${sousCle}`);
    }
    return;
  }

  if (typeof valeur !== regle.type) {
    ecarts.push(`${cle} : attendu ${regle.type}, reçu ${typeof valeur}`);
    return;
  }

  if (regle.valeurs && !regle.valeurs.includes(valeur)) {
    ecarts.push(`${cle} : valeur « ${valeur} » hors de l'ensemble ${regle.valeurs.join(" | ")}`);
  }

  if (regle.entier && !Number.isInteger(valeur)) {
    ecarts.push(`${cle} : entier attendu, reçu ${valeur}`);
  }

  if (regle.borne) {
    const { min, max } = regle.borne;
    if (min !== undefined && valeur < min) ecarts.push(`${cle} : ${valeur} inférieur au minimum ${min}`);
    if (max !== undefined && valeur > max) ecarts.push(`${cle} : ${valeur} supérieur au maximum ${max}`);
  }
}

export function valider(evenement, charge) {
  const contrat = CONTRATS[evenement];

  // Vérification explicite, par événement. Un événement sans contrat passe : une
  // vérification implicite serait ingouvernable.
  if (!contrat) return { valide: true, contractualise: false, ecarts: [] };

  if (typeof charge !== "object" || charge === null || Array.isArray(charge)) {
    return {
      valide: false,
      contractualise: true,
      ecarts: [
        `charge utile attendue : objet, reçue : ${Array.isArray(charge) ? "tableau" : typeof charge}`,
      ],
    };
  }

  // Contrat versionné : la charge est acceptée si elle satisfait n'importe laquelle
  // des versions de la fenêtre de migration. On rapporte laquelle.
  if (contrat.versions) {
    const echecs = [];
    for (const version of contrat.actives) {
      const resultat = validerContreVersion(contrat.versions[version], charge);
      if (resultat.valide) {
        return { valide: true, contractualise: true, ecarts: [], version };
      }
      echecs.push(`v${version} : ${resultat.ecarts.join(" · ")}`);
    }
    return {
      valide: false,
      contractualise: true,
      ecarts: [
        `aucune version active ne convient (fenêtre : ${contrat.actives.map((v) => `v${v}`).join(", ")})`,
        ...echecs,
      ],
    };
  }

  return { ...validerContreVersion(contrat, charge), contractualise: true };
}

function validerContreVersion(contrat, charge) {
  const ecarts = [];

  for (const [cle, regle] of Object.entries(contrat.requis)) {
    if (!(cle in charge)) ecarts.push(`champ requis absent : ${cle}`);
    else verifierValeur(cle, charge[cle], regle, ecarts);
  }

  for (const [cle, regle] of Object.entries(contrat.optionnels ?? {})) {
    if (cle in charge) verifierValeur(cle, charge[cle], regle, ecarts);
  }

  const connus = new Set([
    ...Object.keys(contrat.requis),
    ...Object.keys(contrat.optionnels ?? {}),
  ]);
  for (const cle of Object.keys(charge)) {
    if (!connus.has(cle)) ecarts.push(`champ inattendu : ${cle}`);
  }

  // Les règles ne sont évaluées que si la forme tient : un prédicat sur une charge
  // malformée produirait un message trompeur.
  if (ecarts.length === 0) {
    for (const regle of contrat.regles ?? []) {
      if (!regle.verifie(charge)) ecarts.push(`règle « ${regle.nom} » : ${regle.message}`);
    }
  }

  return { valide: ecarts.length === 0, ecarts };
}

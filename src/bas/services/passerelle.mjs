// @ts-check
import { origine, PORTS } from "./adresses.mjs";
import {
  appeler,
  EN_TETE_DEGRADATION,
  journaliser,
  servir,
} from "./socle-service.mjs";

/**
 * La passerelle.
 *
 * Elle fait EXACTEMENT trois choses, et le fait qu'elles soient trois est le sujet.
 * Une passerelle qui relaie des octets ne prouve rien : elle serait un tuyau, et un
 * tuyau ne se compare à rien. Ce qu'on compare, ce sont trois décisions prises à un
 * endroit nommé — et l'absence de cet endroit au-dessus de la frontière.
 *
 *   1. CORRÉLER    poser un identifiant qui traverse les deux services
 *   2. DÉGRADER    décider quoi rendre quand un amont manque, selon lequel manque
 *   3. REFUSER     arrêter une charge utile non conforme avant le client
 *
 * Elle ne descend jamais dans le navigateur. C'est l'absence de son équivalent
 * au-dessus de la frontière qui est le résultat de l'étude, pas sa présence ici.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI ELLE APPELLE `taches` DIRECTEMENT, ALORS QUE `charges` L'APPELLE AUSSI
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ça ressemble à un N+1, et la question sera posée. Ce n'en est pas un : les deux
 * appels ne demandent pas la même chose.
 *
 *   - la page a besoin de la LISTE BRUTE des tâches — c'est `mf-tableau` et
 *     `mf-detail` qui l'affichent, ligne à ligne ;
 *   - elle a aussi besoin de l'AGRÉGAT par responsable — c'est `mf-charge`.
 *
 * `charges` ne rend que l'agrégat. Il ne réexpose pas la liste dont il est parti, et
 * il n'a pas à le faire : republier la donnée d'un autre service en ferait un second
 * propriétaire de la même vérité. La passerelle demande donc chacune des deux choses
 * à celui qui la possède, et les deux appels partent EN PARALLÈLE — le coût est le
 * plus lent des deux, pas leur somme.
 *
 * Effet de bord recherché : `taches` reçoit deux requêtes portant le même
 * identifiant de corrélation, l'une venue d'ici, l'autre venue de `charges`. Le
 * journal collecté montre un arbre, et l'identifiant cesse d'être décoratif.
 */

/**
 * Le budget au-delà duquel un amont est considéré comme absent.
 *
 * C'est une DÉCISION, et c'est le genre de décision qu'on est obligé de prendre
 * quand on écrit un intermédiaire — il faut bien répondre quelque chose. En appels
 * directs depuis le navigateur, personne n'est obligé de la prendre : `fetch`
 * n'expire jamais de lui-même, et une page qui attend un service figé attend
 * indéfiniment. L'essai 3 rend cet écart visible.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SUR QUOI CE NOMBRE EST ASSIS — ET SUR QUOI IL NE L'EST PAS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Mesure, 300 appels sur la boucle locale (13 août 2026, `node:http`) :
 *
 *   taches   /taches    p50 0,20 ms   p99 0,51 ms   max 4,76 ms
 *   charges  /charges   p50 0,52 ms   p99 1,23 ms   max 1,93 ms   (inclut son propre saut)
 *
 * Un budget dérivé du service se poserait donc vers 50 ms — disons quarante fois le
 * p99, de quoi absorber une pause du ramasse-miettes sans jamais se déclencher à
 * tort. 800 ms, c'est six cent cinquante fois le p99 : ce nombre ne vient PAS de la
 * mesure.
 *
 * Il est calibré sur la salle. Quand on clique « figer », l'attente doit être vue —
 * en dessous de 300 ms elle passe pour de la lenteur — et rester sous la seconde,
 * sans quoi l'auditoire croit à un blocage. C'est une durée de PRÉSENTATION, au même
 * titre que le plancher d'animation de la pastille, et elle est étiquetée comme telle
 * pour la même raison : le dispositif affiche des chiffres mesurés, il ne peut pas se
 * permettre d'en glisser un qui ne l'est pas sans le dire.
 *
 * Ce qu'il faut retenir pour l'étude, et qui survit au choix du nombre : en vrai, ce
 * budget se dérive de la distribution de latence de l'amont ET de l'échéance dont
 * dispose l'appelant — deux informations qu'un intermédiaire côté réseau possède, et
 * qu'un fragment dans un onglet ne possède pas.
 */
const BUDGET_AMONT_MS = 800;

const URL_TACHES = `${origine("taches")}/taches`;
const URL_CHARGES = `${origine("charges")}/charges`;

/* ------------------------------------------------ devoir 3 : la forme attendue */

/**
 * La forme que la passerelle exige de ses amonts.
 *
 * Ce schéma est la réponse à « qui possède le contrat ». Il ne vit ni chez
 * l'émetteur — l'équipe qui renomme un champ renommerait aussi son schéma, et le
 * contrôle passerait — ni chez le destinataire, qui n'est pas en position de
 * refuser. Il vit à la frontière, chez celui qui n'est ni l'un ni l'autre.
 *
 * Le prix est réel et il faut l'annoncer : faire évoluer le contrat devient une
 * livraison de la passerelle, donc un point de synchronisation entre les équipes.
 * La vérification ne supprime pas la coordination, elle la déplace — du moment où
 * la panne se produit vers le moment où le contrat change.
 */
/**
 * @typedef {"string" | "number" | "boolean" | "object" | readonly unknown[]} Attendu
 * @typedef {{ requis: Record<string, Attendu>, facultatifs: readonly string[] }} Forme
 */

/** @type {Forme} */
const FORME_TACHE = {
  requis: {
    id: "string",
    titre: "string",
    statut: ["a-faire", "en-cours", "termine"],
    responsable: "string",
    echeance: "string",
    chargeJours: "number",
  },
  facultatifs: [],
};

/** @type {Forme} */
const FORME_CHARGE = {
  requis: {
    responsable: "string",
    nbTaches: "number",
    chargeJours: "number",
    parStatut: "object",
  },
  facultatifs: [],
};

/**
 * Compare un objet à une forme et nomme les écarts.
 *
 * La formulation des messages est celle du validateur de la maquette d'indépendance
 * — « champ requis absent : statut · champ inattendu : etat ». C'est volontaire :
 * c'est le même écart, constaté deux couches plus bas, et la salle doit reconnaître
 * la phrase.
 *
 * @param {unknown} valeur
 * @param {Forme} forme
 * @param {string} ou
 * @returns {string[]}
 */
function ecartsDeForme(valeur, forme, ou) {
  if (typeof valeur !== "object" || valeur === null) return [`${ou} : ce n'est pas un objet`];

  /** @type {string[]} */
  const ecarts = [];
  const objet = /** @type {Record<string, unknown>} */ (valeur);
  const presents = new Set(Object.keys(objet));

  for (const [champ, attendu] of Object.entries(forme.requis)) {
    if (!presents.has(champ)) {
      ecarts.push(`${ou} : champ requis absent : ${champ}`);
      continue;
    }
    presents.delete(champ);

    const recu = objet[champ];
    if (Array.isArray(attendu)) {
      if (!attendu.includes(recu)) {
        ecarts.push(`${ou} : ${champ} hors ensemble : ${JSON.stringify(recu)}`);
      }
    } else if (attendu === "object") {
      if (typeof recu !== "object" || recu === null) ecarts.push(`${ou} : ${champ} n'est pas un objet`);
    } else if (typeof recu !== attendu) {
      ecarts.push(`${ou} : ${champ} attendu ${attendu}, reçu ${typeof recu}`);
    }
  }

  for (const champ of forme.facultatifs) presents.delete(champ);
  for (const champ of presents) ecarts.push(`${ou} : champ inattendu : ${champ}`);

  return ecarts;
}

/**
 * Valide une collection. On s'arrête aux quatre premiers écarts : le reste est du bruit.
 *
 * @param {unknown} elements
 * @param {Forme} forme
 * @param {string} nom
 * @returns {string[]}
 */
function validerCollection(elements, forme, nom) {
  if (!Array.isArray(elements)) return [`${nom} : la collection est absente ou n'est pas un tableau`];

  /** @type {string[]} */
  const ecarts = [];
  for (const [index, element] of elements.entries()) {
    ecarts.push(...ecartsDeForme(element, forme, `${nom}[${index}]`));
    if (ecarts.length >= 4) break;
  }
  return ecarts.slice(0, 4);
}

/* ---------------------------------------------------------------- le composeur */

servir({
  nom: "passerelle",
  port: PORTS.passerelle,
  async router({ chemin, id }) {
    if (chemin === "/sante") {
      return { status: 200, corps: { service: "passerelle", vivant: true, budgetAmontMs: BUDGET_AMONT_MS } };
    }

    if (chemin !== "/donnees") {
      return { status: 404, corps: { erreur: "chemin inconnu", chemin } };
    }

    // Devoir 1 — l'identifiant est posé par le socle et propagé aux deux appels.
    const options = { id, appelant: "passerelle", budgetMs: BUDGET_AMONT_MS };
    const [tachesAmont, chargesAmont] = await Promise.all([
      appeler(URL_TACHES, options),
      appeler(URL_CHARGES, options),
    ]);

    // Devoir 2 — l'amont ESSENTIEL. Sans la liste, il n'y a rien à composer, et
    // rendre 200 avec un tableau vide serait mentir par omission de la pire façon :
    // en donnant à la page toutes les apparences du succès.
    if (!tachesAmont.ok) {
      journaliser({
        service: "passerelle",
        nature: "note",
        niveau: "attention",
        id,
        message: `503 — amont essentiel taches indisponible : ${tachesAmont.cause}`,
      });
      return {
        status: 503,
        corps: {
          erreur: "amont essentiel indisponible",
          amont: "taches",
          cause: tachesAmont.cause,
          decide_par: "passerelle",
          id,
        },
      };
    }

    // Devoir 3 — la conformité, avant que quoi que ce soit n'atteigne le client.
    const ecarts = validerCollection(
      /** @type {any} */ (tachesAmont.corps)?.taches,
      FORME_TACHE,
      "taches",
    );
    if (ecarts.length > 0) {
      journaliser({
        service: "passerelle",
        nature: "note",
        niveau: "attention",
        id,
        message: `502 — charge utile non conforme depuis taches · ${ecarts.join(" · ")}`,
      });
      return {
        status: 502,
        corps: {
          erreur: "charge utile amont non conforme",
          amont: "taches",
          ecarts,
          decide_par: "passerelle",
          id,
        },
      };
    }

    const taches = /** @type {any} */ (tachesAmont.corps).taches;

    // Devoir 2, suite — l'amont OPTIONNEL. C'est ici qu'est la décision : les tâches
    // sont affichables sans l'agrégat, donc on les rend, et on NOMME ce qui manque.
    // Un 503 dirait « tout est cassé » alors que les trois quarts de l'écran sont
    // servables ; un 200 muet laisserait la page croire qu'il n'y a rien à agréger.
    // Distinguer l'amont essentiel de l'amont optionnel demande quelqu'un au milieu
    // qui connaisse les deux : c'est la seule chose que cette passerelle sait et que
    // le bus, au-dessus, ne peut structurellement pas savoir.
    if (!chargesAmont.ok) {
      journaliser({
        service: "passerelle",
        nature: "note",
        niveau: "attention",
        id,
        message: `200 dégradé — agrégat absent, amont charges : ${chargesAmont.cause}`,
      });
      return {
        status: 200,
        entetes: { [EN_TETE_DEGRADATION]: "charges" },
        corps: {
          meta: { servi_par: "taches", agrege_par: null, id, mode: "passerelle" },
          taches,
          charges: [],
          degrade: {
            partie: "charges",
            cause: chargesAmont.cause,
            budgetMs: BUDGET_AMONT_MS,
            attenduMs: chargesAmont.dureeMs,
            decide_par: "passerelle",
            id,
          },
        },
      };
    }

    const ecartsCharges = validerCollection(
      /** @type {any} */ (chargesAmont.corps)?.charges,
      FORME_CHARGE,
      "charges",
    );
    if (ecartsCharges.length > 0) {
      journaliser({
        service: "passerelle",
        nature: "note",
        niveau: "attention",
        id,
        message: `502 — charge utile non conforme depuis charges · ${ecartsCharges.join(" · ")}`,
      });
      return {
        status: 502,
        corps: {
          erreur: "charge utile amont non conforme",
          amont: "charges",
          ecarts: ecartsCharges,
          decide_par: "passerelle",
          id,
        },
      };
    }

    return {
      status: 200,
      corps: {
        meta: {
          servi_par: /** @type {any} */ (tachesAmont.corps).servi_par,
          agrege_par: /** @type {any} */ (chargesAmont.corps).agrege_par,
          id,
          mode: "passerelle",
        },
        taches,
        charges: /** @type {any} */ (chargesAmont.corps).charges,
      },
    };
  },
});

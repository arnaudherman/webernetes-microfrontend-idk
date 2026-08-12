/**
 * Le registre des contrats — publié par l'ÉQUIPE SOCLE, versionné avec elle.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LE POINT QUI DÉCIDE DE TOUT : QUI POSSÈDE LE SCHÉMA ?
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Si le schéma était déclaré par le PRODUCTEUR, la vérification ne vaudrait rien :
 * une équipe qui renomme `statut` en `etat` renommerait aussi son schéma, et le
 * contrôle passerait. Le contrat ne serait qu'un miroir du code qu'il prétend
 * contraindre.
 *
 * Le schéma doit donc vivre AILLEURS que chez le producteur — ici, dans le socle
 * partagé. Ce qui a une conséquence directe et non négociable : faire évoluer un
 * contrat devient une livraison du socle, donc un point de synchronisation entre
 * toutes les équipes qui en dépendent.
 *
 * La vérification ne supprime pas la coordination. Elle la DÉPLACE, du moment où
 * la panne se produit vers le moment où le contrat change. C'est un bien meilleur
 * moment — mais ce n'est pas gratuit, et c'est la seule chose honnête à dire à un
 * comité d'architecture.
 *
 * Ce validateur est volontairement minimal : présence, type primitif, champs
 * inattendus. Il ne vérifie ni le sens, ni les unités, ni les invariants métier.
 * Un champ qui passerait des jours aux heures traverserait sans être vu.
 */

export const VERSION_CONTRATS = "1.0";

export const CONTRATS = {
  "filtre:change": {
    requis: { statut: "string" },
    optionnels: { responsable: "string" },
  },
};

export function valider(evenement, charge) {
  const contrat = CONTRATS[evenement];

  // Aucun contrat déclaré : le bus laisse passer. La vérification est explicite,
  // par événement, jamais implicite.
  if (!contrat) return { valide: true, contractualise: false, ecarts: [] };

  if (typeof charge !== "object" || charge === null || Array.isArray(charge)) {
    return {
      valide: false,
      contractualise: true,
      ecarts: [`charge utile attendue : objet, reçue : ${Array.isArray(charge) ? "tableau" : typeof charge}`],
    };
  }

  const ecarts = [];

  for (const [cle, type] of Object.entries(contrat.requis)) {
    if (!(cle in charge)) ecarts.push(`champ requis absent : ${cle}`);
    else if (typeof charge[cle] !== type) {
      ecarts.push(`${cle} : attendu ${type}, reçu ${typeof charge[cle]}`);
    }
  }

  for (const [cle, type] of Object.entries(contrat.optionnels ?? {})) {
    if (cle in charge && typeof charge[cle] !== type) {
      ecarts.push(`${cle} : attendu ${type}, reçu ${typeof charge[cle]}`);
    }
  }

  const connus = new Set([
    ...Object.keys(contrat.requis),
    ...Object.keys(contrat.optionnels ?? {}),
  ]);
  for (const cle of Object.keys(charge)) {
    if (!connus.has(cle)) ecarts.push(`champ inattendu : ${cle}`);
  }

  return { valide: ecarts.length === 0, contractualise: true, ecarts };
}

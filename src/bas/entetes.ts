/**
 * Les en-têtes que la moitié basse pose, et que le navigateur relit.
 *
 * Ils sont trois, et il faut bien voir que le troisième existe uniquement pour que
 * le premier soit visible :
 *
 *   X-Correlation-Id   posé par la passerelle, propagé aux deux amonts, rendu au
 *                      client. C'est le premier des trois devoirs de la passerelle.
 *   X-Degradation      nomme la partie manquante quand la réponse est partielle.
 *   Access-Control-Expose-Headers   sans lui, les deux précédents traversent le
 *                      réseau et restent INVISIBLES dans la page : CORS masque par
 *                      défaut tout en-tête de réponse non explicitement exposé.
 *
 * Le piège du troisième mérite d'être connu : la corrélation aurait parfaitement
 * fonctionné, aurait été journalisée côté serveur, et n'aurait jamais pu être
 * affichée à côté de l'appel qui l'a produite. Une propriété réelle et
 * indémontrable, ce qui pour une démonstration revient à ne pas l'avoir.
 */

export const EN_TETE_CORRELATION = "X-Correlation-Id";
export const EN_TETE_DEGRADATION = "X-Degradation";

/** Lecture insensible à la casse : `Headers` normalise, mais les journaux, non. */
export function entete(entetes: Headers, nom: string): string | undefined {
  return entetes.get(nom) ?? undefined;
}

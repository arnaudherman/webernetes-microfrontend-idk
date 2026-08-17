import { URL_JOURNAL } from "./adresses";
import { accepterLigne, type LigneCollectee } from "./journal-collecte";
import { accepterProcessus, signalerTrafic, type EtatProcessus } from "./etat-processus";

/**
 * Le canal par lequel la page apprend ce qui se passe en dessous.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI `fetch` ET NON `EventSource`
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `EventSource` ferait exactement ce travail en trois lignes. Il ne passe pas par
 * `globalThis.fetch` : le garde-réseau ne le verrait donc ni ne pourrait le bloquer,
 * et la page ne pourrait plus prétendre que TOUT son trafic passe par un point
 * unique. Cette propriété est affichée dans la synthèse ; elle doit rester vraie.
 *
 * On lit donc un flux NDJSON à la main, avec un `ReadableStream`. Vingt lignes de
 * plus, et une propriété qui tient.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LE LIEN EST UNE DÉPENDANCE, ET IL EST AFFICHÉ COMME TELLE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Observer un système à distance coûte une connexion qui peut tomber. Quand elle
 * tombe, la page ne se tait pas : elle dit que le lien est rompu. Un journal vide
 * qui ne s'explique pas laisserait croire que rien ne se passe, ce qui est le pire
 * mensonge qu'un journal puisse faire.
 */

export type EtatLien = "attente" | "ouvert" | "rompu";

export interface Lien {
  readonly etat: EtatLien;
  readonly detail?: string;
}

const observateurs = new Set<(lien: Lien) => void>();
let lien: Lien = { etat: "attente" };

export function observerLien(observateur: (lien: Lien) => void): () => void {
  observateurs.add(observateur);
  observateur(lien);
  return () => observateurs.delete(observateur);
}

function majLien(nouveau: Lien): void {
  lien = nouveau;
  for (const observateur of observateurs) observateur(nouveau);
}

interface MessageJournal {
  readonly t: "journal";
  readonly ligne: LigneCollectee;
}

interface MessageProcessus {
  readonly t: "processus";
  readonly processus: readonly EtatProcessus[];
}

function traiter(message: MessageJournal | MessageProcessus): void {
  if (message.t === "processus") {
    accepterProcessus(message.processus);
    return;
  }

  accepterLigne(message.ligne);

  // Le clignotement de la carte est déclenché par la ligne du service qui a répondu,
  // pas par un événement séparé : ce qui s'anime à l'écran est exactement ce qui est
  // écrit dans le journal, et rien d'autre.
  if (message.ligne.nature === "requete" && message.ligne.service) {
    signalerTrafic(message.ligne.service, message.ligne.status);
  }
}

/**
 * Ouvre le flux et le maintient. Rend une fonction de détachement.
 *
 * La reconnexion est volontairement simple — une tentative par seconde, sans
 * dégressivité. La console est sur la boucle locale : si elle ne répond pas, ce
 * n'est pas de la congestion, c'est qu'elle n'est pas lancée, et la page doit le
 * dire tout de suite plutôt que d'espacer poliment ses tentatives.
 */
export function demarrerFluxConsole(): () => void {
  const abandon = new AbortController();

  void (async () => {
    while (!abandon.signal.aborted) {
      try {
        const reponse = await fetch(URL_JOURNAL, { signal: abandon.signal });
        if (!reponse.ok || !reponse.body) throw new Error(`la console répond ${reponse.status}`);

        majLien({ etat: "ouvert" });

        const lecteur = reponse.body.pipeThrough(new TextDecoderStream()).getReader();
        let reste = "";

        for (;;) {
          const { done, value } = await lecteur.read();
          if (done) break;

          reste += value;
          const morceaux = reste.split("\n");
          reste = morceaux.pop() ?? "";
          for (const morceau of morceaux) {
            if (morceau.trim() === "") continue;
            try {
              traiter(JSON.parse(morceau));
            } catch {
              // Une ligne illisible ne doit pas rompre le flux : on perd la ligne,
              // pas la séance.
            }
          }
        }

        throw new Error("le flux s'est terminé");
      } catch (erreur) {
        if (abandon.signal.aborted) return;
        majLien({
          etat: "rompu",
          detail: erreur instanceof Error ? erreur.message : String(erreur),
        });
        await new Promise((resoudre) => setTimeout(resoudre, 1000));
      }
    }
  })();

  return () => abandon.abort();
}

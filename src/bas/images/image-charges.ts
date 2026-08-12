import { BaseImage } from "@ngrok/webernetes";
import type { HttpResponse, ProcessContext } from "@ngrok/webernetes";

/**
 * Image `etude/charges` : appelle le Service `taches` en amont, agrège la charge par
 * responsable, et sert le tout en JSON sur le port 8080.
 *
 * C'est ce pod que la page appelle, à travers un Service NodePort. Il est donc le seul
 * interlocuteur de la moitié haute, et il fait un vrai saut réseau supplémentaire vers
 * `taches` : le journal du cluster montre les deux sauts.
 *
 * Le drapeau de panne est un état d'instance, basculé par routage de chemin
 * (`/panne`, `/nominal`). Aucune API de Webernetes ne permet de forcer un pod existant
 * à répondre 500 : ni injection de faute, ni intergiciel, ni crochet réseau modifiable.
 * Passer par une variable d'environnement imposerait un redéploiement, ce qui
 * contredirait la démonstration — on veut la même instance, vivante, qui ment.
 *
 * Conséquence : ce Deployment reste à UN réplica. `apply()` refuse les ConfigMap, il
 * n'existe donc aucun état partagé entre réplicas ; à deux réplicas, un seul `/panne`
 * produirait une alternance 200/500 au gré du round-robin.
 */

/** Ce que ce service attend de son amont. Volontairement minimal, et déclaré ici. */
interface TacheAmont {
  readonly statut: string;
  readonly responsable: string;
  readonly chargeJours: number;
}

interface Cumul {
  nbTaches: number;
  chargeJours: number;
}

interface ChargeResponsable {
  responsable: string;
  nbTaches: number;
  chargeJours: number;
  parStatut: Record<string, Cumul>;
}

const STATUTS = ["a-faire", "en-cours", "termine"] as const;

function cumulVide(): Cumul {
  return { nbTaches: 0, chargeJours: 0 };
}

function agreger(taches: readonly TacheAmont[]): ChargeResponsable[] {
  const parResponsable = new Map<string, ChargeResponsable>();

  for (const tache of taches) {
    let ligne = parResponsable.get(tache.responsable);
    if (!ligne) {
      ligne = {
        responsable: tache.responsable,
        nbTaches: 0,
        chargeJours: 0,
        parStatut: Object.fromEntries(STATUTS.map((statut) => [statut, cumulVide()])),
      };
      parResponsable.set(tache.responsable, ligne);
    }

    ligne.nbTaches += 1;
    ligne.chargeJours += tache.chargeJours;

    const cumul = (ligne.parStatut[tache.statut] ??= cumulVide());
    cumul.nbTaches += 1;
    cumul.chargeJours += tache.chargeJours;
  }

  return [...parResponsable.values()].sort((a, b) => b.chargeJours - a.chargeJours);
}

export class ImageCharges extends BaseImage {
  static readonly imageName = "etude/charges";
  static readonly imageVersion = "1.0";

  defaultCommand: readonly string[] = ["charges"];

  /** État d'instance : un drapeau par conteneur, jamais partagé, jamais persisté. */
  private enPanne = false;

  override async exec(ctx: ProcessContext, argv: readonly string[]): Promise<number> {
    if (argv[0] !== "charges") return await super.exec(ctx, argv);

    const pod = ctx.pod.name;
    const amont = ctx.env.get("URL_TACHES") ?? "http://taches.default.svc:80/taches";
    const enJson = { "Content-Type": ["application/json"] };

    const ecoute = ctx.listenHttp(8080, async (_contexte, requete): Promise<HttpResponse> => {
      const chemin = requete.url.pathname;

      // Toujours 200, quel que soit l'état applicatif : voir image-taches.
      if (chemin === "/healthz") return { status: 200, body: "ok\n" };

      if (chemin === "/panne") {
        this.enPanne = true;
        return { status: 200, body: `contrat rompu sur ${pod}\n` };
      }

      if (chemin === "/nominal") {
        this.enPanne = false;
        return { status: 200, body: `contrat rétabli sur ${pod}\n` };
      }

      if (chemin === "/etat") {
        return {
          status: 200,
          header: enJson,
          body: JSON.stringify({ pod, en_panne: this.enPanne }),
        };
      }

      if (chemin !== "/donnees") {
        return { status: 404, body: `chemin inconnu : ${chemin}\n` };
      }

      if (this.enPanne) {
        return {
          status: 500,
          header: enJson,
          body: JSON.stringify({
            erreur: "contrat serveur rompu",
            pod,
            detail: "le service ne peut plus produire l'agrégat demandé",
          }),
        };
      }

      let reponseAmont;
      try {
        reponseAmont = await ctx.fetch(amont);
      } catch (erreur) {
        const cause = (erreur as { cause?: { code?: string; message?: string } }).cause;
        return {
          status: 502,
          header: enJson,
          body: JSON.stringify({
            erreur: "amont injoignable",
            amont,
            nom: (erreur as Error).name,
            message: (erreur as Error).message,
            code: cause?.code,
          }),
        };
      }

      if (reponseAmont.status !== 200) {
        return {
          status: 502,
          header: enJson,
          body: JSON.stringify({ erreur: "amont en erreur", amont, status: reponseAmont.status }),
        };
      }

      const charge = JSON.parse(reponseAmont.body) as {
        servi_par: string;
        noeud: string;
        taches: readonly TacheAmont[];
      };

      return {
        status: 200,
        header: { ...enJson, "X-Agrege-Par": [pod] },
        body: JSON.stringify({
          meta: {
            agrege_par: pod,
            servi_par: charge.servi_par,
            noeud_source: charge.noeud,
          },
          taches: charge.taches,
          charges: agreger(charge.taches),
        }),
      };
    });

    ctx.writeStdout(`charges à l'écoute sur ${ecoute.ip}:${ecoute.port}, amont ${amont}\n`);
    return await ctx.waitUntilKilled();
  }
}

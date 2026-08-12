import { BaseImage } from "@ngrok/webernetes";
import type { HttpResponse, ProcessContext } from "@ngrok/webernetes";
import { ETUDE } from "../donnees/etude";

/**
 * Image `etude/taches` : sert la liste des tâches en JSON sur le port 8080.
 *
 * Déployée à 3 réplicas derrière un Service ClusterIP. Chaque réponse porte le nom
 * du pod qui l'a servie, ce qui rend le round-robin du Service visible à l'écran et
 * rend l'essai 1 (suppression d'un pod) lisible sans explication.
 */
export class ImageTaches extends BaseImage {
  static readonly imageName = "etude/taches";
  static readonly imageVersion = "1.0";

  defaultCommand: readonly string[] = ["taches"];

  override async exec(ctx: ProcessContext, argv: readonly string[]): Promise<number> {
    if (argv[0] !== "taches") return await super.exec(ctx, argv);

    const pod = ctx.pod.name;
    const noeud = ctx.pod.config.pod?.spec?.nodeName ?? "?";

    const ecoute = ctx.listenHttp(8080, async (_contexte, requete): Promise<HttpResponse> => {
      switch (requete.url.pathname) {
        // La sonde de disponibilité ne doit jamais dépendre de l'état applicatif :
        // un pod sorti des endpoints donnerait une exception réseau au lieu d'un
        // code d'état, et l'essai 2 perdrait son sens.
        case "/healthz":
          return { status: 200, body: "ok\n" };

        case "/taches":
          return {
            status: 200,
            header: { "Content-Type": ["application/json"], "X-Servi-Par": [pod] },
            body: JSON.stringify({ servi_par: pod, noeud, taches: ETUDE }),
          };

        default:
          return { status: 404, body: `chemin inconnu : ${requete.url.pathname}\n` };
      }
    });

    ctx.writeStdout(`taches à l'écoute sur ${ecoute.ip}:${ecoute.port}\n`);
    return await ctx.waitUntilKilled();
  }
}

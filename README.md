# La frontière

Une application web, un seul dépôt, qui contient **les deux formes de modularité en même
temps, séparées par une frontière visible à l'écran**.

- **Au-dessus de la frontière** : l'interface, composée de quatre micro-frontends montés
  indépendamment, qui communiquent par un bus d'événements.
- **En dessous** : quatre vrais processus Node — `console`, `taches`, `charges`,
  `passerelle` — qui écoutent sur 127.0.0.1 et n'utilisent que `node:http`.

Une même frontière de service, et la démonstration mesure **ce que la déplacer coûte**. Un
sélecteur posé sur la ligne bascule entre deux positions : la composition décidée côté
réseau, ou la même composition remontée dans l'onglet. Les deux servent le même écran.
Leur différence n'apparaît qu'en panne.

> **Cadrage.** Ce dépôt a d'abord été construit sur l'idée que le sujet était les
> micro-frontends, avec une moitié basse simulée dans l'onglet par
> [`@ngrok/webernetes`](https://github.com/ngrok/webernetes). C'était un mauvais cadrage,
> et la suite de l'étude l'a établi : la question réelle est le déplacement d'une
> frontière de service depuis le réseau vers le navigateur — question dont Webernetes,
> WebAssembly et une base de données côté client sont trois facettes. Le paquet est sorti
> du code : il reste **une source citée**, celle qui a permis de requalifier le sujet, et
> rien de plus. *(Sa documentation publiée était par ailleurs désynchronisée sur quatre
> points de son implémentation — remarque sur la qualité de la source, conservée en
> réserve, sans effet sur ce dépôt.)*

**Deux démonstrations, un seul fil.**

| | |
|---|---|
| **ce dépôt** | ce que coûte une frontière de service déplacée dans l'onglet |
| [`maquette-independance/`](maquette-independance/) | ce qu'il faut en plus pour que plusieurs équipes livrent séparément |
| [`DEROULE.md`](DEROULE.md) | le déroulé de présentation qui enchaîne les deux, en douze minutes |

## Démarrage

```
npm install
npm run demo
```

`npm run demo` lance les quatre processus **et** le serveur de développement. C'est la
seule commande à connaître : `npm run dev` seul ouvrirait une page qui ne joint pas ses
services, et l'écran le dirait.

Rien ne sort de la machine : les quatre services écoutent sur 127.0.0.1, et la page
s'interdit toute autre destination. La démonstration tourne en salle de réunion sans
connexion.

| commande | effet |
|---|---|
| `npm run demo` | les quatre services **et** Vite, dans un seul terminal |
| `npm run services` | les quatre services seuls |
| `npm run dev` | le serveur de développement seul |
| `npm run recette` | **la vérification complète** — à lancer avant toute présentation |
| `npm run typecheck` | trois passes : la page, les services, la maquette |
| `npm run verifier-frontiere` | l'invariant d'architecture, voir plus bas |
| `npm run build` | build de production |
| `npm run preview` | sert le build de production |

Aucune dépendance d'exécution. Les trois entrées de `package.json` — `typescript`, `vite`,
`@types/node` — sont toutes des `devDependencies` : la moitié haute est du DOM et des
éléments personnalisés, la moitié basse n'utilise que `node:http`.

## Ce que la démonstration établit

**1. Orchestrer des services et composer une interface sont deux problèmes distincts.**
Un service ne rend rien à l'écran : il répond à des requêtes. Rien dans son
fonctionnement ne dit quoi que ce soit de la composition d'une interface.

**2. La même panne se raconte différemment selon l'endroit où on la regarde.** Et ce qu'on
perd en remontant la frontière dans l'onglet n'est pas la détection — il n'y en avait
pas — c'est la **qualification**.

**3. Le critère de décision n'est pas technique.** Les deux moitiés fonctionnent. Ce qui
les sépare, c'est le nombre d'équipes, la cadence de livraison et le coût de coordination.

## Les trois positions

C'est le résultat central de cette version. Une seule faute — `taches` sert `etat` là où
le contrat dit `statut`, code d'état 200, service en parfaite santé — observée depuis trois
endroits, sans jamais recharger la page.

| position | ce que l'écran affiche | qui a décidé |
|---|---|---|
| **via passerelle** (essai 4) | `502 · champ requis absent : statut · champ inattendu : etat` | un intermédiaire, parce que quelqu'un y a écrit la forme attendue |
| **appels directs** (essai 4, autre mode) | `200 en 4 ms · 2 appels` — le tableau annonce neuf sur neuf | personne |
| **bus d'événements** (essai 5) | rien du tout | personne, et personne ne serait en position de le faire |

La deuxième ligne est celle qui compte, et c'est celle qu'on n'attend pas : elle se joue
**sous** la frontière, sur du vrai HTTP, et elle passe. Le protocole ne vérifie rien — il
n'a jamais rien vérifié. Retirez l'intermédiaire et le réseau devient exactement aussi
silencieux qu'un bus d'événements.

La même expérience sur une panne de transport (essai 1, `charges` tué) donne :

| position | ce que l'écran affiche |
|---|---|
| via passerelle | `200 partiel — charges manque · cause : ECONNREFUSED · décidé par passerelle après 1 ms` |
| appels directs | `200 partiel — charges manque · cause : inconnue — le navigateur ne reçoit pas la cause · décidé par navigateur` |
| bus | un message ordinaire, remis à deux abonnés, dégradation enfouie dans la charge utile |

`fetch` rend le même `TypeError: Failed to fetch` pour un service mort, un refus CORS et
un port fermé. Ce n'est pas une lacune d'implémentation, c'est une décision de sécurité de
la plateforme : distinguer ces cas laisserait une page sonder le réseau de la machine qui
l'exécute. Elle est justifiée, et elle est définitive.

## Les cinq colonnes, et le statut de chacune

Le trou que laisse une frontière de service déplacée dans l'onglet a cinq colonnes. Elles
ne sont pas également démontrées, et le statut est écrit — une colonne annoncée démontrée
puis contredite en salle coûte plus cher que la colonne elle-même.

| colonne | statut | par quoi |
|---|---|---|
| **contrat de forme** | démontrée | essai 4 — refus 502, écart nommé champ par champ |
| **code d'état** | démontrée | essai 2 — `taches` répond 500, la passerelle rend 503, la page affiche un bandeau et un bouton *réessayer* |
| **délai** | démontrée | essai 3 — budget de 800 ms tenu ; en appels directs la page attend indéfiniment |
| **trace** | démontrée | un même identifiant de corrélation sur les deux chemins vers `taches`, exposé à travers CORS et affiché à côté de l'appel |
| **annulation** | **argumentée, non démontrée** | rien ici ne l'exerce, et cette passerelle ne propage aucune annulation à ses amonts |

Deux réserves, à énoncer avant qu'on les trouve :

- Le **réessai** est plus faible que le délai. Il existe un bouton *réessayer*, mais rien
  d'automatique : c'est une affordance écrite à la main, pas une propriété du protocole.
- Une **sixième colonne** s'est ajoutée d'elle-même le jour où la moitié basse est devenue
  quatre vrais processus : la **cause**. Elle n'était pas visible tant que tout était
  simulé dans l'onglet, et c'est aujourd'hui le résultat le plus net de l'étude — voir
  l'essai 1 ci-dessus. Elle est démontrée, et elle n'entre dans aucune des cinq.

## Ce que la frontière réseau donne et que le navigateur ne donne pas

Trois choses, dont la troisième est la moins évidente et la plus coûteuse.

1. **La cause.** Un intermédiaire côté réseau est le dernier endroit où elle existe encore.
2. **La vérification de contrat.** Non par le protocole, mais par quelqu'un placé au
   milieu, qui n'est ni l'émetteur ni le destinataire.
3. **La décision de renoncement.** Un budget de délai se dérive de la distribution de
   latence de l'amont **et** de l'échéance dont dispose l'appelant. Ce sont deux
   informations qu'un intermédiaire côté réseau possède et qu'un fragment dans un onglet
   n'a pas. Écrire un intermédiaire *oblige* à prendre cette décision — il faut bien
   répondre quelque chose. Dans un onglet, personne n'y oblige : `fetch` n'expire jamais
   de lui-même, et la contrainte n'a pas disparu, elle est devenue facultative.

## L'arbitrage, chiffré

Le mode direct est **plus rapide**, et il faut le dire avant qu'on le découvre.

| | via passerelle | appels directs |
|---|---|---|
| moyenne | 7,4 ms | **4,3 ms** |
| médiane | 5,9 ms | 3,9 ms |
| appels HTTP | 1 | 2 |

Trois millisecondes séparent les deux positions. Elles achètent la cause, la corrélation de
bout en bout et le refus de contrat. C'est le prix, il est connu, et il se décide.

Le même écart mesuré hors navigateur tombe à **0,37 ms** — et ce n'est pas une réserve sur
le chiffre précédent, c'est un résultat : le surcoût n'est pas celui du saut réseau
supplémentaire, qui est négligeable, c'est celui de la frontière du navigateur elle-même,
`fetch` et CORS compris.

## Déroulé de démonstration

Huit minutes. **Il y a huit essais, on en joue quatre, les autres sont là.** Chaque essai
au programme porte un résultat qu'aucun autre ne porte ; les quatre en réserve sont nommés
en une ligne et se jouent sur demande. Tout se déclenche en un clic depuis la barre fixée
en bas de fenêtre, atteignable quelle que soit la position de défilement.

| Temps | Action | Ce qui est dit |
|---|---|---|
| 0:00 | Le tableau fonctionne, on filtre, on sélectionne | Une application de suivi ordinaire |
| 1:00 | Ouvrir les outils réseau | Quatre origines, toutes sur 127.0.0.1, et rien d'autre n'est joignable |
| 1:30 | Faire défiler sous la frontière | Quatre vrais processus, un vrai réseau — et un journal *rapporté*, pas constaté |
| 2:30 | Essai 1, tuer `charges`, dans les deux modes | La cause est nommée d'un côté, perdue de l'autre |
| 4:00 | Revenir au-dessus de la ligne | Rien dans cette histoire ne concernait l'interface |
| 4:30 | Essai 4, dans les deux modes | La même faute : refusée, puis avalée |
| 5:30 | Essai 5, juste à droite | La même faute encore, et cette fois invisible |
| 6:30 | Essai 8, remplacer `mf-tableau` | Le seul résultat positif : la substitution tient |
| 7:00 | Déplier l'écran de synthèse | L'asymétrie, chiffrée sur la session qu'on vient de jouer |
| 8:00 | Conclusion | Le critère de décision n'est pas technique |

### Notes de conduite

- **Les essais 4 et 5 sont deux boutons voisins**, séparés uniquement par la ligne de
  frontière. C'est délibéré, et c'est la comparaison décisive : ne les séparez pas.
- **Ne rétablissez rien entre les deux modes de l'essai 4.** Basculez le sélecteur, c'est
  tout. La zone d'observation se réécrit toute seule pour le mode courant.
- **À 6:30**, après avoir remplacé le tableau, notez que le fragment neuf arrive vide : le
  bus ne rejoue rien. Le coût de la substitution est visible à l'instant même.
- **À 7:00**, le bouton « synthèse » en haut à droite déplie le panneau. Les chiffres sont
  ceux de la session que vous venez de jouer.
- **En réserve** : essai 2 (contrat serveur, le code d'état), essai 3 (gel `SIGSTOP`, le
  budget de délai), essais 6 et 7 (démonter puis remonter `mf-detail`, la perte
  silencieuse). Chacun se joue en dix secondes si la question vient.

## Les huit essais

La numérotation **monte à travers la ligne** : 1 à 4 sous la frontière, 5 à 8 au-dessus.
Elle est continue de part et d'autre, ce qui place les essais 4 et 5 côte à côte.

### Sous la frontière

**1 — Tuer le service `charges`.** SIGTERM. Le processus meurt, son port se ferme. La
passerelle reçoit un vrai `ECONNREFUSED` — immédiatement : sur la boucle locale, un refus
ne fait pas attendre. Elle distingue l'amont essentiel de l'amont optionnel, sert ce qui
est servable et **nomme** ce qui manque. Rejoué en appels directs, le manque est constaté
et la cause perdue. Rien ne relance le processus : il n'y a plus de contrôleur sous cette
frontière, et c'est le prix des vrais processus, payé une fois contre de vraies pannes.

**2 — Casser le contrat serveur.** `taches` répond 500 sans redémarrer : même processus,
même pid, l'uptime ne bouge pas. C'est la même instance, vivante, qui se met à mentir.
`taches` étant l'amont **essentiel**, la passerelle rend 503 plutôt qu'un partiel : sans la
liste, il n'y a rien à composer. Deux boutons voisins, deux décisions différentes, une
seule passerelle — c'est là qu'elle gagne sa place.

**3 — Figer `charges` (`SIGSTOP`).** Le processus reste vivant, sa socket d'écoute reste
ouverte, le noyau accepte les connexions — et personne ne répond jamais. Ce n'est pas un
refus, c'est un silence, et rien ne l'en distingue sinon une décision. La passerelle
renonce à 800 ms parce qu'elle porte un budget. En appels directs, la page attend, et elle
attendra indéfiniment.

**4 — Servir une charge utile non conforme.** `taches` sert `etat` au lieu de `statut`. Le
nom de la ressource n'a pas bougé, le code d'état est 200, le service est en parfaite
santé. Trois consommateurs la reçoivent sans broncher — `charges` en tire un agrégat faux,
avec une catégorie « undefined » qui contient tout. Un seul la refuse. **Premier essai
décisif.**

### Au-dessus de la frontière

**5 — Casser le contrat front.** Une version 2.0 des filtres publie `etat` au lieu de
`statut`. Son contrat déclaré est inchangé. Le tableau lit `statut`, obtient `undefined`,
en conclut qu'aucun filtre n'est demandé, et affiche tout. Le filtre indique « en cours »,
le tableau annonce neuf tâches sur neuf. Aucune exception, aucun avertissement. **Second
essai décisif** — et c'est mot pour mot l'essai 4, une couche plus haut.

**6 — Démonter `mf-detail`.** Les autres continuent, la console reste vide. Cliquez une
tâche : le journal du bus affiche `0 abonné`, sans rien signaler.

**7 — Remonter `mf-detail`.** Il repart vide : le bus ne rejoue rien. Tout ce qui a été
publié pendant son absence lui est définitivement perdu.

**8 — Remplacer `mf-tableau`** par une seconde implémentation au rendu entièrement
différent. La substitution tient parce que le contrat est respecté. **C'est le seul essai
dont le résultat est positif**, et il compte autant que les autres : c'est cela qu'il faut
gouverner.

Les essais 5 et 8 utilisent **le même mécanisme** — le shell change un nom de balise. L'un
respecte le contrat et tient, l'autre le viole et ment. Le shell est incapable de les
distinguer : la forme des charges utiles n'est écrite nulle part qu'il puisse consulter.

## Architecture

```
src/
├── main.ts                       amorçage, ordre de démarrage, câblage
├── garde-reseau.ts               limite la page à quatre origines déclarées
│
├── bas/                          ── MODULARITÉ SERVEUR ──
│   ├── adresses.json             les quatre ports, source unique
│   ├── adresses.ts               les adresses, côté navigateur
│   ├── entetes.ts                corrélation, dégradation, exposition CORS
│   ├── flux-console.ts           le flux NDJSON du journal, en `fetch`
│   ├── journal-collecte.ts       le journal rapporté, et ce qu'il ne garantit pas
│   ├── etat-processus.ts         vivant ≠ répond
│   ├── rendu.ts                  journal, services, console
│   ├── essais-bas.ts             essais 1 à 4
│   ├── donnees/etude.mjs         les tâches de l'étude
│   └── services/                 ── LES QUATRE PROCESSUS ──
│       ├── console.mjs           établi : lance, collecte, sonde, commande
│       ├── socle-service.mjs     HTTP, journal NDJSON, client `node:http`
│       ├── taches.mjs            la source de vérité, et ses deux pannes
│       ├── charges.mjs           agrège — et ne valide rien, délibérément
│       └── passerelle.mjs        corréler, dégrader, refuser
│
├── frontiere/                    ── LE POINT DE TRAVERSÉE ──
│   ├── traversee.ts              les deux modes, la mesure de l'écart
│   ├── convergence.ts            qualification des erreurs, et sa limite
│   └── vue-frontiere.ts          la ligne, les étiquettes, le sélecteur de mode
│
├── haut/                         ── MODULARITÉ DE L'INTERFACE ──
│   ├── bus.ts                    abonner / publier, et rien d'autre
│   ├── contrat.ts                le contrat déclaré par chaque fragment
│   ├── shell.ts                  monte par nom de balise, injecte le bus
│   ├── cadre-module.ts           affiche le contrat à l'écran
│   ├── fragments/                mf-filtres, mf-tableau, mf-detail, mf-charge
│   │                             + mf-filtres-v2 et mf-tableau-v2
│   ├── rail.ts                   circulation des messages entre modules
│   ├── journal-bus.ts            journal, sans colonne de code d'état
│   └── essais-haut.ts            essais 5 à 8
│
├── essais/                       barre fixe et textes d'observation
└── synthese/                     compteurs de session et panneau final
```

`frontiere/traversee.ts` s'appelait `passerelle.ts`. Le mot est désormais réservé au
**processus** qui tourne sur 127.0.0.1:7200 et prend trois décisions ; ce module-là, lui,
ne décide rien, il fait franchir. Deux choses du même nom dans une étude d'architecture,
c'est une ambiguïté qui se paie en réunion.

### Trois invariants, et un vérificateur

`npm run verifier-frontiere` lit les imports de tout `src/` et échoue si l'un des trois est
rompu. C'est une assertion opposable, pas un commentaire. Il vérifie 30 modules.

1. **Aucun module de `haut/` n'importe `bas/`, et réciproquement.** Seuls quatre modules
   d'orchestration voient les deux moitiés — `main.ts`, `frontiere/traversee.ts`,
   `essais/barre-essais.ts` et `synthese/compteurs.ts` — et uniquement pour câbler ou
   déclencher.
2. **Aucun fragment n'importe le code d'un autre fragment.**
3. **Un seul module fait passer une donnée du bas vers le haut** : `frontiere/traversee.ts`,
   par un appel vers la passerelle ou deux appels directs selon le mode. Rien au-dessus de
   la ligne ne sait lequel : `src/haut` n'a pas une ligne de différence entre les deux.

### Deux garde-fous, qui sont des arguments

Ils vérifient des **décisions**, pas des symptômes, et sans eux la démonstration pourrait
se dégrader en continuant d'avoir l'air de fonctionner.

- **`npm run recette` interdit le retour de la simulation dans l'artefact.** L'étape lit le
  bundle produit et échoue si le nom du paquet y réapparaît. Elle remplaçait un seuil de
  taille minimale, qui mesurait en réalité la présence de cette dépendance et ne disait
  plus rien de vrai une fois qu'elle en fut sortie.
- **`outils/eprouver-passerelle.mjs` empêche la passerelle de devenir un tuyau.** Il lance
  les quatre processus et joue les quatre pannes pour de vrai, en constatant à chaque fois
  la décision attendue — 21 constats. Une passerelle qui relaie des octets ne prouve rien,
  et elle peut le devenir sans que rien ne casse : il suffit qu'on retire la validation de
  forme « pour débloquer ». Les essais continueraient de produire quelque chose à l'écran,
  et ce quelque chose ne serait plus la démonstration.

### Pourquoi aucun type n'est partagé

Le jeu de données vit sous `bas/`. Les fragments ne l'importent pas — **pas même le type
`Tache`**. Chacun déclare, pour lui seul, la forme qu'il attend des charges utiles reçues.

Ce n'est pas un oubli. Si un fragment importait le type de l'émetteur, l'essai 5 serait une
erreur de compilation, et la démonstration s'effondrerait : le compilateur jouerait le rôle
que personne ne joue en vrai entre deux équipes qui livrent séparément.

C'est aussi ce qui force `mf-filtres-v2.ts` à dupliquer presque intégralement
`mf-filtres.ts`. Cette duplication est le prix réel de l'indépendance de déploiement, et il
est plus honnête de la montrer que de la masquer derrière une classe de base commune.

### Deux journaux, jamais fusionnés

Ils sont placés en pleine largeur de part et d'autre immédiate de la ligne de frontière.
Quand la ligne est au centre de l'écran, on les voit tous les deux, séparés uniquement par
elle. Le contraste est l'argument visuel principal : en dessous une colonne de codes
d'état, au-dessus aucune.

Mais ils ne diffèrent pas seulement par leurs colonnes, et c'est écrit à l'écran :

- **Au-dessus, la page voit.** Le journal du bus est écrit dans le fil d'exécution qui
  publie. Il ne peut pas diverger de ce qui se produit.
- **En dessous, la page est informée.** Quatre processus lui racontent ce qu'ils ont bien
  voulu écrire, par un canal qui peut prendre du retard, tronquer au plafond, ou tomber.
  Le journal collecté est **rapporté, pas constaté**.

C'est une perte réelle par rapport à la version simulée, où le bas était magiquement
transparent. C'est aussi la façon dont on observe un système réel — par le récit qu'il fait
de lui-même — et il vaut mieux l'annoncer que la masquer. Quand le canal tombe, la page le
dit au lieu de se taire : un journal vide qui ne s'explique pas est le pire mensonge qu'un
journal puisse faire.

Chaque ligne porte son origine, et ce n'est pas décoratif : la console **déclenche** les
pannes et **collecte** le journal. Sans cette distinction, on pourrait légitimement
soupçonner le journal de raconter ce que la console a décidé plutôt que ce qui s'est
produit. `·` rapporté par le service sur sa sortie standard, `»` constaté par la console.

La ligne `0 abonné` n'est **pas** peinte en rouge. Ce n'est pas une erreur : c'est un fait,
et personne dans le système ne le considère comme anormal. Lui donner l'apparence d'une
alerte serait prêter au bus une vigilance qu'il n'a pas.

## Notes techniques

### Ce que la moitié basse est, et ce qu'elle n'est pas

Quatre processus Node, quatre ports, du vrai HTTP, de vrais signaux POSIX. Les pannes sont
réelles : `SIGTERM` ferme un port, `SIGSTOP` produit un processus vivant et muet, un 500
est un vrai 500. Ce n'est pas une architecture de production — il n'y a ni découverte de
service, ni équilibrage, ni reprise automatique — et ce n'est pas ce qu'elle prétend être.
Ce qu'elle est : le plus petit dispositif où les trois décisions d'un intermédiaire
réseau existent pour de bon et se comparent à leur absence.

### La console n'est pas dans l'architecture étudiée

C'est l'établi. Elle occupe la place de la main de l'opérateur et du collecteur de
journaux, deux choses qui existent dans tout système réel mais dont aucune ne participe à
la comparaison. L'écran l'étiquette comme telle et l'affiche à part : la laisser dans la
grille des services lui donnerait le statut d'un composant qu'elle n'a pas.

### Contraintes qui ont façonné le code

- **`node:http` plutôt que `fetch`, côté services.** Mesuré sur cette machine, le `fetch`
  global stalle environ deux secondes dès qu'il réutilise une connexion persistante vers un
  serveur `node:http` — une requête sur deux, à cadence d'une par seconde. Les sondes de la
  console tournent à 1 Hz : avec `fetch`, elles inventaient une panne sur deux. Un
  dispositif dont la thèse est que le réseau qualifie honnêtement les pannes ne peut pas se
  permettre un observateur qui en fabrique.
- **`fetch` plutôt qu'`EventSource`, côté page.** `EventSource` ferait le travail en trois
  lignes, mais il ne passe pas par `globalThis.fetch` : le garde-réseau ne le verrait pas,
  et la page ne pourrait plus prétendre que **tout** son trafic passe par un point unique.
  Cette propriété est affichée dans la synthèse ; elle doit rester vraie. Vingt lignes de
  plus, et une propriété qui tient.
- **Aucun proxy de développement, délibérément.** Faire passer les services par Vite
  éviterait CORS, mais convertirait un `ECONNREFUSED` en 500 émis par Vite : l'essai 1
  perdrait précisément ce qu'il doit montrer, et le mode « appels directs » ne serait plus
  direct.
- **`Access-Control-Expose-Headers` est indispensable.** Sans lui, `X-Correlation-Id`
  traverse le réseau et reste invisible dans la page : CORS masque par défaut tout en-tête
  de réponse non explicitement exposé. Le premier devoir de la passerelle serait réel et
  indémontrable — ce qui, pour une démonstration, revient à ne pas l'avoir.
- **Les commandes passent en GET.** Ce n'est pas très beau pour des actions qui modifient
  l'état. Un POST en `application/json` déclencherait un préambule `OPTIONS` sur chaque
  essai et doublerait les lignes du journal projeté.
- **`127.0.0.1` et jamais `localhost`.** Sur une machine où `localhost` se résout d'abord
  en `::1`, une URL en `localhost` échouerait par refus de connexion — exactement la panne
  de l'essai 1, mais pour une raison étrangère à la démonstration.
- **Le budget de `charges` (600 ms) est plus court que celui de la passerelle (800 ms).**
  Seul l'ordre compte : si `taches` se fige, `charges` doit renoncer avant que la passerelle
  ne renonce sur lui. Sinon la panne se propage en « charges ne répond plus » et le journal
  désigne le mauvais coupable — un intermédiaire qui attribue mal une panne est pire qu'un
  intermédiaire absent.

### Deux durées de présentation, étiquetées comme telles

Le dispositif affiche des chiffres mesurés. Il ne peut pas se permettre d'en glisser un qui
ne l'est pas sans le dire. Deux nombres ne viennent pas de la mesure :

- **Le budget de 800 ms de la passerelle.** Un budget dérivé de la latence réelle de
  l'amont se poserait vers 50 ms. 800 ms est calibré sur la salle : l'attente doit être vue
  — en dessous de 300 ms elle passe pour de la lenteur — et rester sous la seconde, sans
  quoi l'auditoire croit à un blocage.
- **Le plancher d'animation de 250 ms de la pastille.** Un appel sur la boucle locale dure
  quelques millisecondes, ce qui ne s'anime pas. Le compteur posé à côté ne montre pas cette
  durée : il compte les traversées depuis le chargement de la page, et au-delà de 700 ms il
  bascule sur l'attente en cours. La milliseconde réelle s'écrit en tête de page, dans la
  zone d'état, sous la forme « 200 en 6 ms · 1 appel ». Réinjecter une latence dans l'appel lui-même serait refaire, sous un autre nom, la
  latence simulée que ce dispositif vient justement de supprimer.

### Mesures

Chrome 151, machine de développement, 200 échantillons par ligne. Les traversées répliquent
exactement le code de `frontiere/traversee.ts`.

| Mesure | moyenne | médiane | p99 |
|---|---|---|---|
| Traversée via passerelle (1 appel) | 7,4 ms | 5,9 ms | 20,8 ms |
| Traversée en appels directs (2 appels) | 4,3 ms | 3,9 ms | 10,9 ms |
| `taches /taches`, depuis le navigateur | 2,2 ms | 2,1 ms | 5,3 ms |
| `charges /charges`, depuis le navigateur | 3,7 ms | 3,4 ms | 9,4 ms |

Hors navigateur, `node:http`, 300 échantillons :

| Mesure | médiane | p99 | max |
|---|---|---|---|
| `taches /taches` | 0,22 ms | 0,40 ms | 0,98 ms |
| `charges /charges` (inclut son propre saut) | 0,41 ms | 0,65 ms | 1,97 ms |
| Traversée via passerelle | 0,90 ms | 1,56 ms | 2,23 ms |
| Traversée en appels directs | 0,53 ms | 1,08 ms | 1,40 ms |

Autres grandeurs :

| Mesure | Valeur |
|---|---|
| Démarrage de la page, jusqu'à `load` | 143 ms |
| Artefact de production | 67 476 octets de JavaScript, 19 246 de CSS |
| Recette complète | environ 9,3 s |

Il n'y a plus de latence réseau simulée, plus de phase de convergence à attendre et plus de
séquence de démarrage à commenter : les services tournent ou ne tournent pas, et la page le
dit en une ligne.

## Pour la projection

- **Zoom du navigateur à 100 %.** La mise en page vise 1280 × 800 ; elle reste correcte
  jusqu'à environ 960 px de large, mais les journaux y tronquent davantage et les modules
  débordent en dessous.
- **Gardez l'onglet au premier plan.** Chrome bride les minuteurs des onglets masqués à
  environ un par seconde. Les services, eux, continuent : ils ne sont pas dans l'onglet.
- Corps de texte à 15 px minimum, deux couleurs d'accent, aucune police téléchargée, aucune
  animation décorative. Les seules animations transportent une information : le déplacement
  d'un message sur le rail, le changement d'état d'un service, l'appel qui traverse la
  frontière. `prefers-reduced-motion` les supprime toutes.
- Tout est atteignable au clavier, le focus est visible partout.

## Ce que cette démonstration ne couvre pas

Cette liste s'allonge à chaque version, et c'est normal : mieux on mesure, mieux on voit ce
qu'on ne mesure pas.

**Le modèle organisationnel.** Il est hors du périmètre de cette étude, et cette
démonstration ne l'atteint pas : **un dépôt unique, une équipe unique, aucune livraison
indépendante — rien n'y est donc établi du modèle organisationnel.** Les quatre fragments
sont encapsulés, mais ils sont compilés par un seul `npm run build`, en **un seul artefact
JavaScript**, et aucune équipe ne pourrait livrer sans les trois autres. Ce qui rend un
changement atomique ici, c'est l'artefact unique, pas le dépôt unique — un dépôt unique
donne un commit atomique, jamais un chargement atomique.
[`maquette-independance/`](maquette-independance/) montre la brique technique qui
manquerait si l'on voulait un jour poser cette question — la résolution à l'exécution — et
ce qu'elle coûte ; elle n'établit pas davantage le modèle organisationnel.

**L'annulation.** Cinquième colonne du trou, et la seule qu'aucun essai n'exerce. La
passerelle ne propage aucune annulation à ses amonts : fermer la connexion côté client ne
les arrête pas. La propriété est argumentée, pas démontrée, et c'est écrit dans la synthèse.

**Le sens des charges utiles.** La passerelle vérifie une **forme** : champs présents,
types, valeurs dans un ensemble. Elle ne vérifie aucune unité, aucun invariant métier,
aucune cohérence entre deux ressources. Une charge utile parfaitement conforme peut être
parfaitement fausse.

**La gouvernance du schéma.** La forme attendue vit dans la passerelle, ce qui répond à
« qui possède le contrat » — ni l'émetteur, qui renommerait aussi son schéma, ni le
destinataire, qui n'est pas en position de refuser. Le prix est réel : faire évoluer le
contrat devient une livraison de la passerelle, donc un point de synchronisation entre
toutes les équipes. La vérification ne supprime pas la coordination, elle la déplace — du
moment où la panne se produit vers le moment où le contrat change. C'est un bien meilleur
moment, mais ce n'est pas gratuit.

**L'échelle.** Quatre processus sur une boucle locale, neuf tâches, trois responsables.
Rien ici ne dit quoi que ce soit du comportement sous charge, sur un vrai réseau, avec de
vraies latences et de vraies partitions. Les chiffres de latence mesurés valent comme
**écart entre deux positions**, jamais comme ordre de grandeur d'une production.

**La reprise.** Il n'y a plus de contrôleur sous cette frontière. Un processus mort le
reste jusqu'à ce qu'on le relance à la main. La démonstration a échangé la reprise
automatique contre des pannes qu'on ne peut plus accuser d'être simulées ; c'est un
échange, pas un progrès net.

**Le compilateur ne rattrape rien** entre deux fragments : avec la rupture de contrat de
l'essai 5 en place, `npm run typecheck` sort en code 0. C'est vérifiable en huit secondes,
et il vaut mieux le dire soi-même.

## Ce que cette démonstration ne conclut pas

Elle ne recommande **aucun outil** — ni Module Federation, ni single-spa, ni aucun autre.
L'étude est exploratoire ; une recommandation d'outil serait prématurée.

Elle ne conclut pas que les micro-frontends sont une bonne ou une mauvaise idée. Elle
conclut sur les **conditions** dans lesquelles la question se pose, et l'écran de synthèse
les formule ainsi :

- Les micro-frontends deviennent pertinents à partir de plusieurs équipes qui livrent sur
  des cadences différentes.
- En dessous de ce seuil, ils ajoutent un coût de coordination sans contrepartie.
- L'observabilité de la frontière front est un prérequis, pas une amélioration ultérieure.

Le compteur **`contrats front violés détectés` reste à 0**, et c'est le résultat central.
Il ne bougera jamais : rien dans la moitié haute — ni le bus, ni le shell, ni le
compilateur, ni un journal — n'est en position de constater qu'une charge utile a changé de
forme. Un compteur qui refuse de compter dit la chose plus clairement qu'un paragraphe.

Son voisin, lui, bouge : `charges utiles non conformes arrêtées`. C'est la même faute,
jouée une couche plus bas par l'essai 4. Et il faut le lire correctement — il ne bouge pas
parce que « c'est du réseau ». Rejouez l'essai 4 en appels directs et il restera à zéro lui
aussi. Il bouge parce qu'un **intermédiaire** lit une forme attendue que quelqu'un a écrite.

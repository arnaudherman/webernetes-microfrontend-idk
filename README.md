# La frontière

Une application web, un seul dépôt, aucun back-end, qui contient **les deux formes de
modularité en même temps, séparées par une frontière visible à l'écran**.

- **Au-dessus de la frontière** : l'interface, composée de quatre micro-frontends montés
  indépendamment, qui communiquent par un bus d'événements.
- **En dessous** : un cluster Kubernetes fidèlement simulé par
  [`@ngrok/webernetes`](https://github.com/ngrok/webernetes), qui tourne dans le même
  onglet et sert les données.

Une même frontière de service, placée à deux endroits. En dessous, elle passe par le
réseau. Au-dessus, elle passe par un appel de fonction dans le même fil d'exécution. La
démonstration mesure **ce que ce déplacement coûte**.

> **Cadrage.** Ce dépôt a d'abord été construit sur l'idée que Webernetes était hors
> sujet et que le vrai sujet était les micro-frontends. C'était faux, et la suite de
> l'étude l'a établi : la question réelle est le déplacement d'une frontière de service
> depuis le réseau vers le navigateur — question dont Webernetes, WebAssembly et une base
> de données côté client sont trois facettes. La démonstration reste valable telle
> quelle ; c'est son titre qui a changé.

**Deux artefacts, un seul fil.**

| | |
|---|---|
| **cette démonstration** | ce que coûte une frontière de service déplacée dans l'onglet |
| [`maquette-independance/`](maquette-independance/) | ce qu'il faut en plus pour que plusieurs équipes livrent séparément |
| [`DEROULE.md`](DEROULE.md) | le déroulé de présentation qui enchaîne les deux, en douze minutes |

## Démarrage

```
npm install
npm run dev
```

Aucune autre manipulation. Aucune requête réseau sortante après le chargement de la page :
la démonstration fonctionne en salle de réunion sans connexion.

| commande | effet |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run verifier-frontiere` | vérifie l'invariant d'architecture, voir plus bas |
| `npm run build` | build de production |

## Ce que la démonstration établit

**1. Orchestrer des services et composer une interface sont deux problèmes distincts.**
Webernetes démontre parfaitement le premier. Un pod n'affiche rien : il répond à des
requêtes HTTP simulées. Rien dans son fonctionnement ne dit quoi que ce soit de la
composition d'une interface — ce qui n'en fait pas une piste sans intérêt, mais une piste
sur le *plan de contrôle*, pas sur le rendu.

**2. La même panne est bruyante en bas de la frontière et silencieuse en haut.**
HTTP fournit un code d'état, un délai d'expiration, un réessai et une trace. Le bus
d'événements ne fournit rien de tout cela — non par négligence d'implémentation, mais
parce qu'il n'y a personne, dans un bus, pour tenir ce rôle.

**3. Le critère de décision n'est pas technique.**
Les deux moitiés fonctionnent. Ce qui les sépare en vrai, c'est le nombre d'équipes, la
cadence de livraison et le coût de coordination.

## Déroulé de démonstration

Huit minutes. Les six essais se déclenchent en un clic depuis la barre fixée en bas de
fenêtre, qui reste atteignable quelle que soit la position de défilement.

| Temps | Action | Ce qui est dit |
|---|---|---|
| 0:00 | Le tableau fonctionne, on filtre, on sélectionne | Une application de suivi ordinaire |
| 1:00 | Ouvrir les outils réseau, aucune requête | Tout ceci tourne dans un seul onglet, sans serveur |
| 1:30 | Faire défiler sous la frontière | Voici un vrai cluster Kubernetes simulé, c'est lui qui sert les données |
| 2:30 | Essai 1, supprimer un pod | C'est ce que Webernetes enseigne, et c'est bien fait |
| 4:00 | Revenir au-dessus de la ligne | Notez que rien dans cette histoire ne concernait l'interface |
| 4:30 | Essai 3, démonter un fragment | Déployabilité indépendante, mais perte silencieuse |
| 5:30 | Essai 5, casser le contrat front | L'interface ment et personne ne le signale |
| 6:30 | Essai 2, casser le contrat serveur | La même panne, immédiatement qualifiée |
| 7:00 | Déplier l'écran de synthèse | L'asymétrie, chiffrée sur la session qu'on vient de jouer |
| 8:00 | Conclusion | Le critère de décision n'est pas technique |

### Notes de conduite

- **Le démarrage prend environ trois secondes** et l'écran l'annonce honnêtement, phase par
  phase. Ne parlez pas par-dessus : la séquence d'erreurs affichée est réelle et vaut la
  peine d'être montrée une fois.
- **À 4:30**, après avoir démonté le fragment, cliquez une tâche du tableau. C'est ce clic
  qui fait apparaître `0 abonné` dans le journal du bus.
- **Les essais 5 puis 2 s'enchaînent sans rechargement.** C'est la comparaison décisive :
  ne les séparez pas.
- **À 7:00**, le bouton « synthèse » en haut à droite déplie le panneau et l'amène à
  l'écran. Les chiffres sont ceux de la session que vous venez de jouer.

## Les six essais

### Sous la frontière

**1 — Supprimer un pod `taches`.** Le contrôleur de Deployment en recrée un. Le journal du
cluster montre la séquence complète : `SuccessfulCreate`, `Scheduled`, `Pulled`, `Created`,
`Started`, `Killing`. Retour à trois réplicas prêts en environ 1,8 seconde.

**2 — Casser le contrat serveur.** Le pod `charges` répond 500 sans redémarrer : même
conteneur, zéro redémarrage. Le shell le voit, affiche un état d'erreur explicite et propose
de réessayer.

### Au-dessus de la frontière

**3 — Démonter `mf-detail`.** Les autres continuent, la console reste vide. Le journal du
bus indique `0 abonné`.

**4 — Remonter `mf-detail`.** Il repart vide : le bus ne rejoue rien.

**5 — Casser le contrat front.** Une version 2.0 des filtres publie `etat` au lieu de
`statut`. Son contrat déclaré est inchangé. Le tableau lit `statut`, obtient `undefined`,
en conclut qu'aucun filtre n'est demandé, et affiche tout. Le filtre indique « en cours »,
le tableau annonce neuf tâches sur neuf. Aucune exception, aucun avertissement.

**6 — Remplacer `mf-tableau`** par une seconde implémentation au rendu entièrement
différent. La substitution tient parce que le contrat est respecté.

Les essais 5 et 6 utilisent **le même mécanisme** — le shell change un nom de balise. L'un
respecte le contrat et tient, l'autre le viole et ment. Le shell est incapable de les
distinguer : la forme des charges utiles n'est écrite nulle part qu'il puisse consulter.

## Architecture

```
src/
├── main.ts                       amorçage, ordre de démarrage, câblage
├── garde-reseau.ts               interdit toute sortie hors de l'onglet
│
├── bas/                          ── MODULARITÉ SERVEUR ──
│   ├── cluster.ts                cycle de vie, latence simulée, arrêt propre
│   ├── manifestes.ts             Deployment ×2, Service ClusterIP, Service NodePort
│   ├── images/image-taches.ts    sert le jeu de données sur 8080
│   ├── images/image-charges.ts   appelle `taches`, agrège, drapeau de panne
│   ├── donnees/etude.ts          les tâches de l'étude
│   ├── journal-cluster.ts        événements réseau + Events Kubernetes
│   ├── etat-pods.ts              informateur sur les pods
│   ├── rendu.ts                  journal, nœuds, pods, services
│   └── essais-bas.ts             essais 1 et 2
│
├── frontiere/                    ── LE POINT DE TRAVERSÉE ──
│   ├── passerelle.ts             cluster.fetch → JSON → publier sur le bus
│   ├── convergence.ts            qualification des erreurs de démarrage
│   └── vue-frontiere.ts          la ligne, les étiquettes, la pastille
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
│   └── essais-haut.ts            essais 3 à 6
│
├── essais/                       barre fixe et textes d'observation
└── synthese/                     compteurs de session et panneau final
```

### Trois invariants, et un vérificateur

`npm run verifier-frontiere` lit les imports de tout `src/` et échoue si l'un des trois est
rompu. C'est une assertion opposable, pas un commentaire.

1. **Aucun module de `haut/` n'importe `bas/`, et réciproquement.** Seuls quatre modules
   d'orchestration voient les deux moitiés — `main.ts`, `frontiere/passerelle.ts`,
   `essais/barre-essais.ts` et `synthese/compteurs.ts` — et uniquement pour câbler ou
   déclencher.
2. **Aucun fragment n'importe le code d'un autre fragment.**
3. **Une seule fonction fait passer une donnée du bas vers le haut** :
   `frontiere/passerelle.ts`, par un unique `cluster.fetch` vers un Service NodePort.

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
elle. Le contraste est l'argument visuel principal : en dessous une colonne de codes d'état,
au-dessus aucune.

La ligne `0 abonné` n'est **pas** peinte en rouge. Ce n'est pas une erreur : c'est un fait,
et personne dans le système ne le considère comme anormal. Lui donner l'apparence d'une
alerte serait prêter au bus une vigilance qu'il n'a pas.

## Notes techniques

### Ce que Webernetes est, et ce qu'il n'est pas

Webernetes simule fidèlement Kubernetes dans le navigateur : plan de contrôle réel,
contrôleurs réels, DNS, kube-proxy, sondes, Events. Les charges de travail, elles, sont
simulées — les images sont des classes JavaScript. **Ce n'est pas un environnement
d'exécution de production**, et ce n'est pas ce qu'il prétend être. Les ressources
Kubernetes manipulées ici sont bien réelles au sens du modèle ; c'est leur exécution qui est
simulée.

### Écarts entre le README du paquet et la version 0.5.5

Le README publié est désynchronisé sur quatre points, vérifiés à l'exécution :

- `cluster.fetch` retourne `{ status, body }`, un objet nu. Pas de `.text()`, `.json()`,
  `.ok` ni `.headers`.
- Un handler d'image renvoie `status`, pas `statusCode`.
- Le nombre de nœuds est réglable (`new Cluster({ nodes })`).
- L'image d'exemple s'appelle `crccheck/hello-world:1.0` et écoute sur 8000.

### Contraintes qui ont façonné le code

- **`init()` rend la main avant que le cluster soit routable**, et il n'existe aucun signal
  de disponibilité. Il faut interroger le réseau lui-même. Pendant la convergence, les
  erreurs prennent **deux formes qui ne se rattrapent pas de la même façon** : d'abord un
  `Error` nu (`no DNS listener on 10.96.0.10:53`, parce que l'alias de nœud est enregistré
  par kube-proxy et non par `init()`), puis des `TypeError` avec `cause.code === "ECONNREFUSED"`.
  Un `catch` qui lit `erreur.cause.code` sans garde plante sur la première.
- **Un nom que le cluster ne résout pas ne provoque pas d'erreur** : il part dans le `fetch`
  du navigateur. Une faute de frappe sur un nom de Service suffirait donc à émettre une vraie
  requête sortante. Aucune option ne désactive ce repli, d'où `src/garde-reseau.ts`.
- **`cluster.close()` est le seul nettoyage** et il est indispensable sous rechargement à
  chaud : un cluster laisse sinon entre 21 et 42 minuteurs permanents.
- **Aucun état ne peut être partagé entre réplicas** — `apply()` refuse les ConfigMap. Le
  Deployment `charges` reste donc à un réplica, sinon le drapeau de panne ne s'appliquerait
  qu'à une instance sur deux.
- **Un pod supprimé passe par `phase: "Failed"`** pendant environ une seconde avant de
  disparaître. L'affichage le traite comme « Terminating » : le peindre en rouge montrerait
  un faux échec à chaque essai.
- **Les sondes du kubelet représentent environ 35 % du trafic.** Le journal les filtre sur
  la présence de l'en-tête `X-Webernetes-Health-Check`.

### Mesures, dans Chrome

| Mesure | Valeur |
|---|---|
| Construction du cluster + `apply` | 8 à 17 ms |
| Convergence, jusqu'à la première donnée affichée | 3,00 / 3,01 / 3,04 s |
| Une traversée de la frontière | 315 / 326 / 319 ms |
| dont latence réseau simulée, injectée volontairement | 300 ms |
| Chute à 2/3 réplicas après suppression | 12 / 15 / 27 ms |
| Retour à 3/3 réplicas prêts | 1196 / 1494 / 1499 ms |

Le retour à 3/3 est **plus rapide dans Chrome que sous Node**, où il mesurait 1822 à
1851 ms. L'écart vient très probablement du délai aléatoire de la première sonde de
disponibilité. Toutes ces valeurs supposent l'onglet au premier plan.

La latence est injectée pour que la traversée dure assez longtemps pour être vue en salle.
Les sondes, elles, restent à zéro : les ralentir déclencherait des `Unhealthy` en cascade.

## Pour la projection

- **Zoom du navigateur à 100 %.** La mise en page vise 1280 × 800 ; elle reste correcte
  jusqu'à environ 960 px de large, mais les journaux y tronquent davantage.
- **Gardez l'onglet au premier plan.** Chrome bride les minuteurs des onglets masqués à
  environ un par seconde. La simulation ne casse pas — elle n'accumule aucun retard à
  rattraper — mais elle ralentit d'un facteur important, et les essais paraissent figés.
- Corps de texte à 15 px minimum, deux couleurs d'accent, aucune police téléchargée, aucune
  animation décorative. Les seules animations transportent une information : le déplacement
  d'un message sur le rail, le changement d'état d'un pod, l'appel qui traverse la frontière.
  `prefers-reduced-motion` les supprime toutes.
- Tout est atteignable au clavier, le focus est visible partout.

## Ce que cette démonstration ne couvre pas

**L'indépendance de déploiement.** Les quatre fragments sont encapsulés, mais ils vivent
dans un dépôt, compilés par un seul `npm run build`, en un seul fichier d'environ 570 ko.
Aucune équipe ne pourrait livrer sans les trois autres. La démonstration établit une
frontière, pas une indépendance.

C'est l'objet de [`maquette-independance/`](maquette-independance/), qui montre la brique
manquante — la résolution à l'exécution — et ce qu'elle coûte.

**Un point de vocabulaire qui compte.** Ce qui rend un changement atomique ici, c'est
l'**artefact unique**, pas le dépôt unique. Un dépôt unique donne un commit atomique,
jamais un chargement atomique. Et le compilateur ne rattrape rien entre deux fragments :
avec la rupture de contrat de l'essai 5 en place, `npm run typecheck` sort en code 0.
C'est vérifiable en huit secondes, et il vaut mieux le dire soi-même.

## Ce que cette démonstration ne conclut pas

Elle ne recommande **aucun outil** — ni Module Federation, ni single-spa, ni aucun autre.
L'étude est exploratoire ; une recommandation d'outil serait prématurée.

Elle ne conclut pas que les micro-frontends sont une bonne ou une mauvaise idée. Elle conclut
sur les **conditions** dans lesquelles la question se pose, et l'écran de synthèse les
formule ainsi :

- Les micro-frontends deviennent pertinents à partir de plusieurs équipes qui livrent sur des
  cadences différentes.
- En dessous de ce seuil, ils ajoutent un coût de coordination sans contrepartie.
- L'observabilité de la frontière front est un prérequis, pas une amélioration ultérieure.

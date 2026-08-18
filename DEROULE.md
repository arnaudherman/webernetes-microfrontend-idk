# Déroulé de présentation — douze minutes, deux démonstrations

Ce document enchaîne les deux démonstrations en un seul fil. Le `README.md` porte le
déroulé de huit minutes de la démonstration principale ; celui-ci le reprend et le
prolonge.

**La thèse tient en une phrase :** *déplacer une frontière de service depuis le réseau
vers le navigateur coûte tout ce que le réseau fournissait gratuitement, et ce coût est
mesurable.*

---

## Avant d'entrer dans la salle

| | |
|---|---|
| Zoom du navigateur | **100 %** — la mise en page vise 1280 × 800 |
| Fenêtre | **au premier plan** |
| Démo principale | `npm run demo` → <http://localhost:5173/> |
| Maquette | `cd maquette-independance && node construire.mjs && node servir.mjs` → <http://localhost:5100/> |
| Vérification | `npm run recette` — **tout doit être vert avant d'entrer** |
| Build de production | `npm run build` une fois, pour que `dist/` existe à 8:00 |
| Un terminal visible | pour `node empreintes.mjs` à 9:00 |
| Les versions du jour | `node basculer.mjs` sans argument : il liste les versions publiées et **encadre celle qui est servie**. Lisez-les là, jamais dans ce document |
| Répétition | **deux fois, chronomètre en main** |

Si un port est occupé : `pkill -f "src/bas/services"`, `pkill -f servir.mjs`, `pkill -f vite`.

---

## Partie 1 — la frontière, et ce qu'elle vérifie (0:00 → 8:00)

**Il y a huit essais, vous en jouez quatre.** Annoncez-le : « il y en a huit, j'en joue
quatre, les autres sont là si vous voulez les voir ». Les quatre retenus portent chacun un
résultat qu'aucun autre ne porte.

### 0:00 · Une application ordinaire

Le tableau est chargé. Filtrer par statut, cliquer une tâche, le détail se remplit.

> « Un suivi de tâches ordinaire. Ce sont les tâches de l'étude que je vous présente,
> ce qui vous donnera d'ailleurs son état d'avancement réel. »

### 1:00 · Quatre origines, et rien d'autre

Ouvrir les outils réseau. Recharger.

> « Ça parle. Quatre processus Node tournent sur cette machine, sur 127.0.0.1, et la
> page ne s'adresse qu'à eux : un garde intercepte toute autre destination, les refus se
> comptent, et le compteur est dans l'écran de synthèse. Rien ne quitte la machine — la
> démonstration tourne sans connexion — mais je ne vous dirai pas qu'il n'y a pas de
> réseau. Il y en a un, c'est tout l'intérêt. »

### 1:30 · Sous la frontière

Faire défiler jusqu'à la ligne, puis en dessous.

> « Quatre vrais processus, quatre ports, du vrai HTTP. `taches` sert les données,
> `charges` agrège en appelant `taches` par le réseau, la `passerelle` compose, et la
> `console` est l'établi — elle lance les autres et collecte leur journal. Elle n'est pas
> dans l'architecture étudiée, et l'écran le dit. »

**Montrer la bande de statut du journal, juste sous son en-tête.**

> « Notez ce qui est écrit là. Ce journal est *rapporté*, pas constaté : la page ne voit
> pas ces processus, ils lui racontent, par un canal qui peut prendre du retard ou tomber.
> Au-dessus de la ligne, on voit ; en dessous, on est informé. C'est une perte réelle par
> rapport à ma version précédente, où tout était simulé dans l'onglet et magiquement
> transparent. C'est aussi la seule façon dont on observe un vrai système. »

### 2:30 · Essai 1 — tuer `charges`, dans les deux modes

> « Je tue un service. SIGTERM, le port se ferme. »

Montrer l'écran : **`200 partiel — charges manque · cause : ECONNREFUSED · décidé par
passerelle après 1 ms`**.

> « La passerelle a distingué l'amont essentiel de l'amont optionnel : les tâches sont
> affichables sans l'agrégat, donc elle les sert, et elle **nomme** ce qui manque. »

**Basculer le sélecteur posé sur la ligne, sur « appels directs ». Ne rien rétablir.**

> « Même panne, frontière déplacée dans l'onglet. »

Montrer : **`cause : inconnue — le navigateur ne reçoit pas la cause · décidé par
navigateur`**.

> « La page a bien dégradé — parce que j'ai écrit ce code-là, et qu'il sera à réécrire dans
> chaque front qui parlera à ces services. Mais elle ne peut pas dire pourquoi. `fetch`
> rend le même `TypeError` pour un service mort, un refus CORS et un port fermé. Le
> navigateur le fait exprès : lui laisser distinguer ces cas, ce serait laisser une page
> sonder le réseau de votre machine. C'est justifié, et c'est définitif. La décision a
> survécu au déplacement de la frontière ; l'information qui la fonde, non. »

### 4:00 · Le pivot de la première partie

Remonter au-dessus de la ligne. **Marquer un temps.**

> « Notez que rien dans cette histoire ne concernait la composition de l'interface. C'est
> de la modularité serveur, elle est très bien connue — mais elle ne dit rien du problème
> que j'ai à instruire. »

### 4:30 · Essai 4 — la même faute, deux fois, sous la ligne

**Remettre le sélecteur sur « via passerelle ».** Il est resté sur « appels directs »
depuis 2:30, et un rechargement ne l'en sortirait pas : le mode est écrit dans l'URL.
Sans ce geste, l'écran affiche **`200`** pendant qu'on annonce un refus — c'est-à-dire
l'écran de 5:00, joué une étape trop tôt. **Relancer `charges` aussi** : le bouton 1
affiche « relancer charges », rien ne l'a relancé tout seul, et un `charges` mort
ajouterait une dégradation là où le verdict de 5:00 promet « aucun avertissement ».

> « Je fais mentir `taches` : il sert un champ `etat` là où le contrat dit `statut`. Le nom
> de la ressource n'a pas bougé, le code d'état est 200, le service est en parfaite santé. »

Montrer : **`502 · champ requis absent : statut · champ inattendu : etat`**.

> « Refusé avant d'atteindre le client, et l'écart est nommé champ par champ. Attention à
> qui refuse : ce n'est pas « le réseau ». C'est un intermédiaire, parce que quelqu'un y a
> écrit la forme attendue. »

**Basculer en appels directs. Ne rien rétablir.**

> « Même faute, même service, même HTTP. »

Montrer : **`200`**, et le tableau qui annonce **neuf sur neuf**.

> « Et cette fois elle passe. Le protocole n'a rien vérifié — il n'a jamais rien vérifié.
> Ce qui vérifiait il y a dix secondes, c'était la passerelle, et elle seule. Retirez
> l'intermédiaire et le réseau devient exactement aussi silencieux qu'un bus d'événements.
> Ça, c'est le résultat que je ne connaissais pas avant de le mesurer. »

### 5:30 · Essai 5 — la troisième position

**Le bouton juste à droite, de l'autre côté de la ligne. Sans rechargement.**

> « Troisième position, même faute encore. Une équipe livre une version 2.0 de son fragment
> de filtres ; son contrat déclaré n'a pas changé — l'en-tête du module l'affiche — et sa
> charge utile porte `etat` au lieu de `statut`. »

Montrer les deux chiffres : le filtre indique **en cours**, le tableau annonce **neuf sur
neuf**.

> « Le chiffre est faux. Aucune exception, aucun journal anormal, rien. Vous venez de voir
> la même faute trois fois : nommée par un intermédiaire, avalée par du vrai HTTP sans
> intermédiaire, et ici invisible. Ce que déplacer la frontière fait perdre, ce n'est pas
> la détection — il n'y en avait pas — c'est la **qualification**. »

> « Et le couplage n'a pas disparu : il a été déplacé du code vers un contrat non typé que
> personne ne vérifie. »

### 6:30 · Essai 8 — ce qui marche, et qu'il faut gouverner

> « Je remplace l'implémentation du tableau par une autre, au rendu entièrement différent.
> Le shell ne change qu'un nom de balise. Les autres fragments ne sont pas prévenus. »

La substitution tient.

> « C'est le seul essai de la série dont le résultat est positif, et il compte autant que
> les autres. Elle tient parce que le contrat est respecté. Le shell, lui, est incapable de
> distinguer ce cas-ci du précédent : c'est exactement le même geste. C'est donc ça, très
> précisément, qu'il faut gouverner. »

Et le coût, visible à l'instant :

> « Le fragment neuf est arrivé vide. Le bus ne rejoue rien : il a fallu redemander les
> données. Cet angle mort se paie à chaque substitution. »

### 7:00 · L'écran de synthèse

Bouton *synthèse*, en haut à droite.

> « L'asymétrie, chiffrée sur la session qu'on vient de jouer. »

Insister sur **une seule ligne** : **contrats front violés détectés : 0**.

> « Ce compteur ne bougera jamais. Rien, dans la moitié haute, n'est en position de
> constater qu'une charge utile a changé de forme. Le compteur voisin, lui, s'incrémente —
> mais lisez-le bien : il ne bouge pas parce que « c'est du réseau ». Rejouez l'essai 4 en
> appels directs et il reste à zéro lui aussi. Il bouge parce qu'un intermédiaire lit une
> forme attendue que quelqu'un a écrite. »

Puis le tableau d'écart entre les deux modes, en bas du panneau.

> « Et voici le prix. En moyenne : 7,4 millisecondes par la passerelle, 4,3 en appels
> directs. Le mode direct est **plus rapide**, il faut le dire. Trois millisecondes
> séparent les deux positions, et elles achètent la cause, la corrélation de bout en bout
> et le refus de contrat. Hors navigateur, le même écart tombe à 0,37 milliseconde — ce
> n'est pas une nuance, c'est un résultat : le surcoût n'est pas celui du saut réseau, il
> est négligeable, c'est celui de la frontière du navigateur elle-même. »

**Si on vous demande les quatre essais restants**, ils se jouent en dix secondes chacun :
essai 2 (contrat serveur — le code d'état, le bandeau, le bouton *réessayer*), essai 3
(gel `SIGSTOP` — le budget de délai, et la page qui attend indéfiniment en mode direct),
essais 6 et 7 (démonter puis remonter un fragment — `0 abonné`, et le bus qui ne rejoue
rien).

---

## 8:00 · La bascule

**C'est le moment le plus important de la présentation.** Ouvrir un terminal.

```
npm run build && ls -l dist/assets/
```

> « Un point de méthode avant de conclure. **La moitié haute** — les quatre fragments, le
> shell, le bus — tient dans **un seul artefact JavaScript**, produit par **une seule**
> compilation. Les quatre processus du bas n'y entrent pas : `npm run build` ne les
> compile pas, `node` les lance depuis leurs propres fichiers, et vous venez d'en tuer un.
> Mes quatre fragments sont bien encapsulés, mais il n'existe **qu'un objet à livrer pour
> l'interface**, et aucune équipe ne pourrait le livrer sans les trois autres. J'ai donc
> démontré une frontière, pas une indépendance. »

> « Et attention au vocabulaire, parce que c'est là qu'on se trompe : ce qui rend un
> changement atomique, c'est l'**artefact unique**, pas le dépôt unique. Un dépôt unique
> vous donne un commit atomique. Jamais un chargement atomique. »

> « Le modèle organisationnel est **hors du périmètre de mon étude**, et cette
> démonstration ne l'atteint pas : un dépôt unique, une équipe unique, aucune livraison
> indépendante. Rien n'y est donc établi du modèle organisationnel, et je ne vais pas le
> prétendre. »

> « Ce qui suit n'est pas la réponse à cette question-là. C'est une seconde maquette,
> séparée, qui montre la brique technique qui manquerait si on voulait un jour la poser :
> la résolution à l'exécution. Elle ne dit rien de plus, et elle le dit elle-même. »

*(Ne citez pas le poids du fichier. Il n'a jamais rien prouvé : un artefact plus gros ou
plus petit resterait un artefact unique, et c'est l'unicité qui porte l'argument.)*

---

## Partie 2 — l'indépendance, et ce qu'elle coûte (8:30 → 11:30)

Basculer sur <http://localhost:5100/>.

### 8:30 · Quatre équipes, sept origines

> « Quatre dépôts de fragments, quatre chaînes de construction qui ne se connaissent pas,
> plus un socle partagé et une origine volontairement mal configurée : sept origines en
> tout. Le shell ne connaît qu'un manifeste — un nom de balise, une URL, une empreinte. »

Montrer la carte d'import affichée en haut de page.

> « Ceci est un **standard du web**. C'est elle qui résout le nom `@socle/bus`, écrit dans
> des artefacts compilés séparément, vers une URL décidée ici, à l'exécution. »

Cliquer *recenser les instances du socle* : **une seule instance**, alors que trois
artefacts compilés séparément l'importent.

### 9:00 · La preuve centrale

**C'est l'étape qui compte le plus.** Au terminal :

```
node empreintes.mjs
sed -i '' 's/tableau v1\.1/tableau v1.2 RECOMPILÉ SEUL/' equipe-tableau/src/mf-tableau.ts
node construire.mjs equipe-tableau
node empreintes.mjs
```

> « Une empreinte a changé. Les autres sont identiques au bit près. Aucun serveur n'a
> redémarré. Trois cent quatre-vingt-quatorze millisecondes au mur, dont trente-six
> annoncées par le compilateur lui-même. »

Recharger la page : **rien ne change — et c'est le résultat.** Le nouveau libellé est dans
`equipe-tableau/dist/`, que personne ne sert : le port 5101 sert `equipe-tableau/publie/`,
et le manifeste pointe une version publiée, donc immuable. Recompiler n'est pas déployer.

*(Ce qu'il faut de gestes en plus pour amener ce libellé jusqu'au navigateur est exactement
l'objet de 9:30 — ne pas le déflorer ici.)*

**Annoncer immédiatement la limite, avant qu'on vous la demande :**

> « Attention à ce que ceci prouve. Recompiler séparément n'est pas déployer
> indépendamment. Il n'y a ici ni chaîne de livraison, ni gouvernance. Je démontre la
> résolution à l'exécution, pas l'organisation qui va autour. »

### 9:30 · Déployer, refuser, revenir en arrière

```
node publier.mjs
```

> « L'équipe tableau publie. Elle seule, sans prévenir personne. Et **rien n'a changé à
> l'écran** — publier n'est pas déployer. Sinon une version fautive partirait en production
> à la seconde où elle est construite, et le retour arrière n'existerait pas. »

```
node basculer.mjs                          # il liste les versions et encadre la servie
node basculer.mjs mf-tableau <une version antérieure>
```

**Ça refuse.** C'est voulu, et c'est le moment le plus intéressant de la seconde partie.

> « Refusé, parce que cette combinaison-là n'a jamais été assemblée. En artefact unique il
> n'existe qu'une combinaison, et c'est celle qu'on livre. Ici il en existe N × M, et celle
> qui tournera chez l'utilisateur peut n'avoir jamais existé nulle part. Rien dans le
> navigateur ne le vérifie — cette porte, je l'ai écrite. »

```
node basculer.mjs mf-tableau <version> --non-approuvee   puis recharger et vérifier
node approuver.mjs --preuve "assemblée dans Chrome : 2 abonnés atteints, mf-tableau et mf-calcul"
node basculer.mjs mf-tableau <version courante>          retour arrière, autorisé
```

> « Une cinquantaine de millisecondes, zéro compilation, zéro redémarrage. Les deux
> versions restent en ligne côte à côte. C'est ça, le déploiement indépendant. »

Et la concession qui rend le reste crédible :

> « Cette porte teste, mais mesurez ce que « tester » veut dire ici. Elle vérifie que les
> artefacts existent et correspondent à leur empreinte, puis le shell charge la combinaison
> dans le navigateur et joue quatre contrôles : les fragments montent, il n'existe qu'une
> instance du socle, une charge conforme est acceptée, elle atteint un abonné. Le verdict
> est posté, et un échec rend 409. Ce qu'elle ne dit pas, c'est que la combinaison est
> juste : un test de fumée constate qu'elle démarre et que les messages passent. Il reste
> aussi une porte manuelle, `approuver.mjs`, qui enregistre une déclaration humaine — aucune
> des combinaisons du dépôt n'est passée par elle. »

Puis les deux refus, dans cet ordre :

> « Republier une version existante avec un contenu différent : refusé. Une version publiée
> ne se réécrit pas — c'est précisément ce qui rend le retour arrière possible. »

> « Et si quelqu'un altère un artefact déjà publié, en place ? Le navigateur le rejette,
> parce que l'empreinte de la carte d'import ne correspond plus. Le fragment ne monte pas,
> les autres continuent. L'immuabilité n'est plus une promesse d'organisation, c'est une
> contrainte vérifiée par la plateforme. »

À concéder tout de suite :

> « L'erreur affichée est un `TypeError` identique à celui d'une panne CORS. Le navigateur
> protège, mais il ne dit pas de quoi. Vous avez déjà vu ça il y a dix minutes, une couche
> plus bas. C'est la même limite, au même endroit. »

### 10:00 · L'équipe calcul — l'indépendance de langage, et son prix

**C'est la réponse à la demande « comprendre WebAssembly » de la note de cadrage. Ne la
sautez pas : c'est le seul endroit où du WebAssembly tourne pour de vrai.**

> « Une équipe de plus, qui écrit sa logique en **Rust, compilé en WebAssembly**. Le
> fragment monte dans la page comme les autres et parle le même contrat. L'indépendance de
> langage est donc réelle, et vous la voyez tourner. »

> « Le fragment expose la même agrégation par deux points d'entrée : `agreger_json`, qui
> reçoit et rend du JSON, et `agreger_colonnes`, qui reçoit des tableaux typés parallèles
> et rend un tableau plat de nombres. Ce ne sont pas deux appels au même code : ce sont
> deux implémentations distinctes, parce que concevoir POUR la frontière change aussi les
> structures qu'on emploie derrière — et c'est précisément le prix qu'on paie ou qu'on
> évite. Ce qui décide du coût, c'est la forme de ce qu'on fait traverser. C'est la thèse
> de toute ma présentation, transposée d'un cran : **le prix d'une frontière ne tient pas
> au langage, il tient à ce qu'on lui fait traverser.** »

Le coût d'entrée, à annoncer soi-même :

> « Il y a un coût d'entrée, et il se télécharge à chaque visite : le binaire wasm, la glu
> de liaison, le fragment. Les bibliothèques de sérialisation l'alourdissent encore.
> L'arbitrage doit être explicite, et dans la plupart des écrans il est perdant. »

Et la limite, que le fragment affiche lui-même :

> « WebAssembly **n'a aucun accès au DOM**. Il isole le calcul, jamais l'affichage. Ça
> répond à la question « chaque équipe avec son propre langage » : oui pour la logique,
> non pour l'interface. »

**Ne citez aucun chiffre sur cette section.** Ce déroulé en portait — des durées et des
poids — et ils n'avaient pas de source rejouable : aucune ligne de `shell/mesures.js` ne
les produisait. Ils ont été retirés plutôt qu'estimés. Si on vous demande un ordre de
grandeur, répondez que vous ne l'avez pas mesuré et que vous ne citerez pas un chiffre que
vous ne pouvez pas refaire devant la salle.

### 10:30 · Faire coexister deux versions, et ce que ça casse

Ouvrir <http://localhost:5100/coexistence.html>.

> « La clé `scopes` de la carte d'import fait résoudre `@socle/bus` vers deux socles
> différents selon l'équipe. Deux URL, pour une API strictement identique — c'est le seul
> moyen standard de faire coexister deux versions, et il est déclaratif, sans négociation. »

Cliquer un filtre. Montrer, dans l'ordre :

| à l'écran | |
|---|---|
| `mf-tableau` lié à | `socle@3.0` |
| `mf-filtres` lié à | `socle@4.0` |
| le verdict de `publier()` | **`remis: false`** — « charge conforme, mais aucun abonné ne l'écoutait » |
| le tableau reçoit | **rien** |
| recensement | **2 instances** |

> « Aucune exception, aucun avertissement, console vierge. Les deux versions du socle ne
> diffèrent ici que par leur numéro — le code est identique. Ça suffit. Deux URL, c'est
> deux instances de module, donc deux états. **Coexistence de versions et état partagé sont
> antagonistes**, et ce n'est pas un défaut : c'est la sémantique des modules. »

> « Vous venez de revoir l'essai 5, une couche plus bas. »

### 10:50 · Le même contrat rompu, mais arrêté

**C'est le point d'arrivée de toute la démonstration.**

```
node basculer.mjs mf-filtres 2.0.0 --non-approuvee     puis recharger
```

> « L'équipe filtres livre une version qui a renommé `statut` en `etat` — le nom de
> l'événement n'a pas bougé, son contrat déclaré non plus. C'est exactement l'essai 5. »

Cliquer un filtre. Montrer la ligne du journal :

```
[REFUSÉ] filtre:change ← mf-filtres  {"etat":"en-cours"}
         aucune version active ne convient (fenêtre : v1, v2)
         · v1 : champ requis absent : statut · champ inattendu : etat
         · v2 : champ requis absent : statut · champ requis absent : origine · champ inattendu : etat
```

`filtre:change` est un contrat **versionné** — `actives: ["1", "2"]` — donc la charge est
essayée contre chaque version de la fenêtre et le refus nomme l'écart version par version.
Le shell écrit le tout sur une seule ligne ; le retrait ci-dessus n'est qu'un repli de
lecture.

> « Tout à l'heure, le tableau affichait neuf sur neuf et se croyait juste. Ici le message
> est arrêté avant d'être remis, et l'écart est nommé. Vous reconnaissez la formulation :
> c'est mot pour mot celle de la passerelle, deux couches plus bas. C'est volontaire. »

Puis la question qui décide de tout, à poser vous-même :

> « Qui possède ce schéma ? Si c'était le producteur, la vérification ne vaudrait rien :
> l'équipe qui renomme le champ renommerait aussi son schéma, et le contrôle passerait. Il
> vit donc dans le socle partagé — ce qui veut dire que **faire évoluer un contrat devient
> une livraison du socle**. Ce n'est pas pour autant un rendez-vous : ce contrat est
> versionné et déclare une fenêtre de migration, `actives: ["1", "2"]`. Une charge est
> acceptée si elle satisfait n'importe laquelle des versions ouvertes, et chaque équipe
> migre quand elle le décide — élargir, migrer, retirer. La vérification ne supprime pas la
> coordination : elle la déplace, du moment où la panne se produit vers le moment où le
> contrat change. C'est un bien meilleur moment, mais quelqu'un doit ouvrir la fenêtre,
> surveiller qui n'a pas migré, et la fermer. »

Retour à la version saine :

```
node basculer.mjs mf-filtres <version courante>
```

> « Et notez : la version publiée avant le renommage est intacte. C'est à ça que sert
> l'immuabilité. »

### 11:10 · Les deux pannes de frontière

Cliquer les deux boutons.

> « Deux équipes choisissent le même nom de balise :
> `the name "mf-tableau" has already been used with this registry`. Le registre est global
> au document, et aucune des deux équipes ne pouvait le découvrir avant l'exécution. »

> « Un fragment servi depuis une origine mal configurée :
> `Failed to fetch dynamically imported module`. Celle-ci, au moins, est **détectable et
> rattrapable** — contrairement à un message perdu sur un bus. Mais elle ne l'est que parce
> que j'ai écrit un `try/catch` : c'est le seul endroit du dispositif où cette panne
> devient observable. »

Montrer les deux lignes qui suivent dans le journal :

> « Et regardez : le navigateur rend exactement le même `TypeError` pour un refus CORS, un
> 404 et un artefact corrompu. La ligne en dessous dit laquelle des trois — mais ce n'est
> pas le navigateur qui le dit, c'est une soixantaine de lignes que j'ai écrites. C'est ça,
> concrètement, « l'observabilité de la frontière front est un prérequis ». »

---

## 11:30 · Conclusion — en conditions, pas en recommandation

> « Je ne conclus pas que les micro-frontends sont une bonne ou une mauvaise idée, et je ne
> recommande aucun outil : l'étude est exploratoire et une recommandation serait prématurée.
> Je conclus sur trois conditions. »

1. **Les micro-frontends deviennent pertinents à partir de plusieurs équipes qui livrent
   sur des cadences différentes.**
2. **En dessous de ce seuil, ils ajoutent un coût de coordination sans contrepartie.**
3. **L'observabilité de la frontière front est un prérequis, pas une amélioration
   ultérieure.**

> « Et pour savoir où nous nous situons par rapport à ce seuil, il me manque quatre réponses
> que je ne peux obtenir que par entretiens : combien d'équipes possèdent les services
> concernés, si le front et les services seront sous le même domaine enregistrable, quel
> fournisseur d'identité et quel format de jeton, et si les services existants exposent du
> HTTP compatible navigateur. C'est la suite de l'étude. »

---

## Les questions qu'on vous posera

### « Qu'est-ce que la moitié basse, exactement ? »

> « Quatre processus Node sur la boucle locale, quatre ports, du vrai HTTP, de vrais
> signaux POSIX. Ce n'est pas une architecture de production — pas de découverte de
> service, pas d'équilibrage, pas de reprise automatique — et je ne le présente pas comme
> tel. C'est le plus petit dispositif où les trois décisions d'un intermédiaire réseau
> existent pour de bon et se comparent à leur absence. »

*(Si l'on vous interroge sur les versions antérieures de ce dépôt : la moitié basse était
d'abord simulée dans l'onglet. C'est ce qui a permis de requalifier le sujet, et c'est
tout ce que cette dépendance a laissé — une source citée, plus une ligne de code.)*

### « Vous avez donc une solution ? »

> « Non. J'ai un mécanisme dont j'ai mesuré le fonctionnement et le coût, et trois
> conditions sous lesquelles la question mérite d'être posée. »

### « Le compilateur ne rattrape-t-il pas ça, dans un dépôt unique ? »

> « Non, et je l'ai mesuré : avec la rupture de contrat en place, `tsc --noEmit` sort en
> code 0, zéro erreur. Le facteur décisif n'est pas le partage du type, c'est
> l'obligatoriété des champs. Et attention au vocabulaire : ce qui donne l'atomicité, c'est
> l'**artefact unique**, pas le dépôt unique. »

### « Alors qu'est-ce que le déploiement indépendant fait perdre ? »

> « Rien de la vérification — il n'y en avait pas. Il fait perdre l'**objet vérifiable** et
> l'**atomicité de la réparation**. En artefact unique il existe une combinaison, et c'est
> celle qui est livrée. En déploiement indépendant il en existe N × M, et celle qui tourne
> chez l'utilisateur n'a peut-être jamais été assemblée nulle part. »

### « Et le mode direct est plus rapide, non ? »

> « Oui, et je l'annonce plutôt que d'attendre qu'on le trouve : 4,3 millisecondes contre
> 7,4 en moyenne. Trois millisecondes achètent la cause de la panne, la corrélation de bout
> en bout et le refus de contrat. Ce n'est pas une objection à ma thèse, c'est le prix
> qu'elle chiffre. Et hors navigateur l'écart tombe à 0,37 ms : le surcoût n'est pas celui
> du saut réseau, c'est celui de la frontière du navigateur. »

### « Peut-on faire des microservices dans le front ? »

> « C'est un abus de langage. Un microservice se définit par un déploiement indépendant, un
> cycle de vie propre et une frontière réseau. Dans un onglet, zéro de ces trois propriétés
> ne survit en lecture stricte. Ce qui survit — isolation mémoire, indépendance de langage,
> vérification de forme au build — ce sont les propriétés d'un système de **plugins
> isolés**. »

### « Et chaque équipe avec son propre langage ? »

> « Chaque équipe avec son propre **framework** : oui, c'est acquis et gratuit, ma
> démonstration principale le fait déjà par les Web Components. Chaque équipe avec son
> propre **langage** : c'est possible, je l'ai fait — voir l'équipe calcul, elle tourne
> devant vous. Mais chaque langage embarque son environnement d'exécution et ils ne se
> mutualisent pas : il y a un coût d'entrée à télécharger, et il varie selon la forme des
> données qu'on fait traverser la frontière. Je ne vous donnerai pas de chiffre : je ne
> l'ai pas mesuré de façon rejouable, et je ne cite pas ce que je ne peux pas refaire
> devant vous. Côté serveur, le polyglottisme coûte à l'entreprise ; côté front, il coûte
> à l'utilisateur, qui télécharge chaque octet à chaque visite. »

### « Et WebAssembly, ça ne règle pas le problème du contrat ? »

**Distinguez ce qui tourne de ce qui n'existe pas encore. C'est la question où l'on se fait
prendre.**

> « Ce qui tourne, vous venez de le voir : un fragment Rust compilé en WebAssembly, dans ce
> navigateur, mesuré. WebAssembly **isole le calcul**, et il le fait très bien. »

> « Ce qui n'existe pas, c'est ce qui réglerait le contrat. Le modèle de composants — celui
> qui porterait des types d'interface à la frontière — n'est implémenté par aucun moteur de
> navigateur, et la seule voie disponible régénère la couche JavaScript qu'on voulait
> supprimer. Sur le fond : le trou a cinq colonnes — contrat de forme, code d'état, délai
> et réessai, annulation, trace. Le modèle de composants en comblerait une. Il déplace le
> problème, il ne le ferme pas. »

> « Et WebAssembly n'a aucun accès au DOM. Quoi qu'il arrive, l'affichage reste en
> JavaScript. »

*(Cette réponse porte sur un domaine qui bouge vite : revérifiez l'état du modèle de
composants avant la présentation. Ce que le dépôt montre — un fragment Rust qui monte dans
la page, et l'absence d'accès au DOM — ne bouge pas.)*

### « Votre maquette prouve-t-elle le déploiement indépendant ? »

> « Elle prouve la résolution à l'exécution, la recompilation séparée, l'immuabilité
> vérifiée par la plateforme et le refus d'une combinaison jamais assemblée. La porte, elle,
> teste : le shell charge la combinaison dans le navigateur, joue quatre contrôles — les
> fragments montent, il n'existe qu'une instance du socle, une charge conforme est acceptée,
> elle atteint un abonné — et poste son verdict ; le serveur refuse en 409 si le test
> échoue. Les cinq combinaisons enregistrées portent toutes cette preuve, aucune une
> signature humaine. Ce qu'elle ne prouve pas, c'est la justesse fonctionnelle : un test de
> fumée constate qu'une combinaison démarre et que les messages passent, pas qu'elle est
> juste. »

---

## Ce qu'il ne faut jamais dire

- « Il n'y a aucune requête réseau » — il y en a, c'est tout l'intérêt, et le contredire
  prend une seconde avec les outils réseau ouverts. Dites : quatre origines déclarées,
  toutes sur 127.0.0.1, rien ne quitte la machine.
- « Le réseau vérifie les contrats » — il ne vérifie rien. C'est un **intermédiaire** qui
  vérifie, parce que quelqu'un l'a écrit. L'essai 4 en appels directs le prouve en dix
  secondes, et quelqu'un dans la salle le trouvera.
- « Des microservices dans le front » — voir plus haut.
- « Le compilateur rattrape en dépôt unique » — falsifiable en huit secondes sur votre
  propre machine.
- « WebAssembly réglera le contrat » — pas dans un navigateur, et pas cette année.
- Les chiffres d'une page d'accueil. Mesurez, et dites que vous avez mesuré.

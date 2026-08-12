# Déroulé de présentation — douze minutes, deux artefacts

Ce document enchaîne les deux démonstrations en un seul fil. Le `README.md` porte le
déroulé de huit minutes de la seule démonstration principale ; celui-ci le reprend et le
prolonge.

**La thèse tient en une phrase :** *déplacer une frontière de service depuis le réseau
vers le navigateur coûte tout ce que le réseau fournissait gratuitement, et ce coût est
mesurable.*

---

## Avant d'entrer dans la salle

| | |
|---|---|
| Zoom du navigateur | **100 %** — la mise en page vise 1280 × 800 |
| Fenêtre | **au premier plan**, sinon Chrome bride les minuteurs d'un facteur important |
| Démo principale | `npm run dev` → <http://localhost:5173/> |
| Maquette | `cd maquette-independance && node construire.mjs && node servir.mjs` → <http://localhost:5100/> |
| Build de production | `npm run build` une fois, pour que `dist/` existe à 8:00 |
| Un terminal visible | pour `node empreintes.mjs` à 9:00 |
| Répétition | **deux fois, chronomètre en main** |

Si un port est occupé : `pkill -f servir.mjs` puis `pkill -f "vite --port 5173"`.

---

## Partie 1 — la frontière, et ce qu'elle vérifie (0:00 → 8:00)

### 0:00 · Une application ordinaire

Le tableau est chargé. Filtrer par statut, cliquer une tâche, le détail se remplit.

> « Un suivi de tâches ordinaire. Ce sont les tâches de l'étude que je vous présente,
> ce qui vous donnera d'ailleurs son état d'avancement réel. »

### 1:00 · Aucune requête réseau

Ouvrir les outils réseau. Recharger. Rien ne sort.

> « Tout ceci tourne dans un seul onglet, sans serveur. La page s'interdit même
> d'émettre : un nom mal orthographié partirait sur le vrai réseau, donc un garde
> intercepte tout ce qui n'est pas la même origine. »

### 1:30 · Sous la frontière

Faire défiler jusqu'à la ligne, puis en dessous.

> « Voici un cluster Kubernetes fidèlement simulé, dans le même onglet. Trois nœuds,
> un plan de contrôle réel, des contrôleurs réels, du DNS, des sondes. C'est lui qui
> sert les données que vous venez de filtrer. Le contrôle est réel ; l'exécution des
> charges de travail est simulée. »

### 2:30 · Essai 1 — supprimer un pod

> « Je supprime un pod. Le contrôleur en recrée un, le planificateur le place, le
> Service route vers lui dès qu'il est prêt. »

Chiffres mesurés dans Chrome, à annoncer : **chute à 2/3 en 12 à 27 ms**, **retour à 3/3
en 1,2 à 1,5 seconde**. Le journal de droite montre `SuccessfulCreate`, `Scheduled`,
`Pulled`, `Created`, `Started`, `Killing`.

### 4:00 · Le pivot de la première partie

Remonter au-dessus de la ligne. **Marquer un temps.**

> « Notez que rien dans cette histoire ne concernait la composition de l'interface. Un
> pod n'affiche rien. C'est une démonstration de modularité serveur, et elle est très
> bien faite — mais elle ne dit rien du problème que j'ai à instruire. »

### 4:30 · Essai 3 — démonter un fragment

> « Je retire un fragment. Les trois autres continuent, la console reste vide. C'est la
> déployabilité indépendante, et c'est le principal argument en faveur du modèle. »

**Puis cliquer une tâche du tableau.**

> « Regardez le journal de gauche : zéro abonné. Aucune exception, aucun avertissement.
> Le tableau continue de publier dans le vide et se croit entendu. »

### 5:30 · Essai 5 — casser le contrat front

> « Une équipe livre une version 2.0 de son fragment de filtres. Son contrat déclaré n'a
> pas changé — l'en-tête du module l'affiche. Sa charge utile porte `etat` au lieu de
> `statut`. »

Montrer les deux chiffres à l'écran : le filtre indique **en cours**, le tableau annonce
**neuf tâches sur neuf**.

> « Le chiffre affiché est faux. Aucune exception n'a été levée, aucun journal ne
> comporte quoi que ce soit d'anormal. Le couplage n'a pas disparu : il a été déplacé du
> code vers un contrat non typé que personne ne vérifie. »

### 6:30 · Essai 2 — la même panne, en dessous

**Sans rechargement. C'est la comparaison décisive, ne la séparez pas de l'essai 5.**

> « Même geste, une couche plus bas. Le service d'agrégation se met à répondre 500 sans
> redémarrer — même conteneur, zéro redémarrage. »

Montrer les trois signaux : le `500` horodaté dans le journal avec sa chaîne de sauts, le
bandeau d'erreur explicite, le bouton *réessayer*.

> « L'appelant n'a rien eu à deviner. Le réseau lui a remis un code d'état, c'est-à-dire
> un jeton dont le protocole définit le sens. Il affiche une erreur, propose un réessai,
> et sait compter ses échecs. La frontière est vérifiée à l'exécution, à chaque appel,
> par un tiers qui n'est ni l'émetteur ni le destinataire. »

### 7:00 · L'écran de synthèse

Bouton *synthèse*, en haut à droite.

> « L'asymétrie, chiffrée sur la session qu'on vient de jouer. »

Insister sur une seule ligne : **contrats front violés détectés : 0**.

> « Ce compteur ne bougera jamais. Rien, dans la moitié haute, n'est en position de
> constater qu'une charge utile a changé de forme. Le compteur voisin, lui, s'incrémente,
> parce que le réseau qualifie. »

---

## 8:00 · La bascule

**C'est le moment le plus important de la présentation.** Ouvrir un terminal.

```
npm run build && ls -l dist/assets/*.js
```

Lisez le nombre à l'écran plutôt que de le citer de mémoire — il change à chaque
modification du code. Ordre de grandeur au 12 août 2026 : **583 619 octets**.

> « Un point de méthode avant de conclure. Tout ce que je viens de vous montrer tient
> dans **un seul fichier**, celui que vous voyez, produit par **une seule** compilation.
> Mes quatre fragments sont bien encapsulés, mais aucune équipe ne pourrait livrer sans
> les trois autres. J'ai donc démontré une frontière, pas une indépendance. »

> « La question qu'on m'a posée est de faire travailler plusieurs équipes
> indépendamment. Il me manquait une brique. La voici. »

---

## Partie 2 — l'indépendance, et ce qu'elle coûte (8:30 → 11:30)

Basculer sur <http://localhost:5100/>.

### 8:30 · Trois dépôts, six origines

> « Trois dépôts séparés, trois chaînes de construction qui ne se connaissent pas, six
> origines. Le shell ne connaît qu'un manifeste : un nom de balise, une URL. »

Montrer la carte d'import affichée en haut de page.

> « Ceci est un **standard du web**, disponible partout depuis septembre 2025. C'est elle
> qui résout le nom `@socle/bus`, écrit dans des artefacts compilés séparément, vers une
> URL décidée ici, à l'exécution. »

Cliquer *recenser les instances du socle* : **une seule instance**, alors que trois
artefacts compilés séparément l'importent.

### 9:00 · La preuve centrale

**C'est la seule étape qui compte vraiment.** Au terminal :

```
node empreintes.mjs
sed -i '' 's/tableau v1/tableau v1.1 RECOMPILÉ SEUL/' equipe-tableau/src/mf-tableau.ts
node construire.mjs equipe-tableau
node empreintes.mjs
```

> « Une empreinte a changé. Les quatre autres sont identiques au bit près. Aucun serveur
> n'a redémarré. Trente-trois millisecondes de compilation. »

Recharger la page : le nouveau libellé apparaît, l'autre fragment n'a pas bougé.

**Annoncer immédiatement la limite, avant qu'on vous la demande :**

> « Attention à ce que ceci prouve. Recompiler séparément n'est pas déployer
> indépendamment. Il n'y a ici ni chaîne de livraison, ni version immuable publiée, ni
> retour arrière. Je démontre la résolution à l'exécution, pas la gouvernance. »

### 9:30 · Déployer et revenir en arrière

> « L'équipe tableau publie sa version 1.1.0. Elle seule, sans prévenir personne. »

```
node publier.mjs
```

> « Rien n'a changé à l'écran. **Publier n'est pas déployer** — sinon une version fautive
> partirait en production à la seconde où elle est construite, et le retour arrière
> n'existerait pas. »

```
node basculer.mjs mf-tableau 1.1.0
```

**Ça refuse.** C'est voulu, et c'est le moment le plus intéressant de la seconde partie.

> « Refusé, parce que cette combinaison n'a jamais été assemblée. En artefact unique il
> n'existe qu'une combinaison, et c'est celle qu'on livre. Ici il en existe N × M, et
> celle qui tournera chez l'utilisateur peut n'avoir jamais existé nulle part. Rien dans
> le navigateur ne le vérifie — cette porte, je l'ai écrite, cent vingt lignes. »

```
node basculer.mjs mf-tableau 1.1.0 --non-approuvee    puis recharger et vérifier
node approuver.mjs --preuve "assemblée dans Chrome : 1 abonné atteint"
node basculer.mjs mf-tableau 1.0.0                    retour arrière, autorisé
```

> « Soixante-deux millisecondes, zéro compilation, zéro redémarrage. Les deux versions
> restent en ligne côte à côte. C'est ça, le déploiement indépendant. »

Et la concession qui rend le reste crédible :

> « Cette porte ne teste rien. Elle vérifie que les artefacts existent et correspondent à
> leur empreinte, puis elle enregistre une déclaration humaine — comme les portes de
> déploiement côté serveur. Une combinaison approuvée à la légère est une combinaison
> approuvée. »

Puis les deux refus, dans cet ordre :

> « Republier une version existante avec un contenu différent : refusé. Une version
> publiée ne se réécrit pas — c'est précisément ce qui rend le retour arrière possible. »

> « Et si quelqu'un altère un artefact déjà publié, en place ? Le navigateur le rejette,
> parce que l'empreinte de la carte d'import ne correspond plus. Le fragment ne monte
> pas, les autres continuent. L'immuabilité n'est plus une promesse d'organisation, c'est
> une contrainte vérifiée par la plateforme. »

À concéder tout de suite, avant qu'on vous le demande :

> « L'erreur affichée est un `TypeError` identique à celui d'une panne CORS. Le navigateur
> protège, mais il ne dit pas de quoi. »

### 10:00 · Faire coexister deux versions, et ce que ça casse

Ouvrir <http://localhost:5100/coexistence.html>.

> « La clé `scopes` de la carte d'import fait résoudre `@socle/bus` vers le socle 4.0 pour
> l'équipe filtres, et vers le 3.0 pour tout le reste. Deux URL, pour une API strictement
> identique — c'est le seul moyen standard de faire coexister deux versions, et il est
> déclaratif, sans négociation. »

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
> deux instances de module, donc deux états. **Coexistence de versions et état partagé
> sont antagonistes**, et ce n'est pas un défaut : c'est la sémantique des modules. »

> « Vous venez de revoir l'essai 5, une couche plus bas. »

### 10:40 · Le même contrat rompu, mais arrêté

**C'est le rappel de l'essai 5, et le point d'arrivée de toute la démonstration.**

```
node basculer.mjs mf-filtres 2.0.0 --non-approuvee     puis recharger
```

> « L'équipe filtres livre sa 2.0.0. Elle a renommé `statut` en `etat` — le nom de
> l'événement n'a pas bougé, son contrat déclaré non plus. C'est exactement l'essai 5. »

Cliquer un filtre. Montrer la ligne du journal :

```
[REFUSÉ] filtre:change ← mf-filtres  {"etat":"en-cours"}
         champ requis absent : statut · champ inattendu : etat
```

> « Tout à l'heure, le tableau affichait neuf sur neuf et se croyait juste. Ici le
> message est arrêté avant d'être remis, et l'écart est nommé. »

Puis la question qui décide de tout, à poser vous-même avant qu'on vous la pose :

> « Qui possède ce schéma ? Si c'était le producteur, la vérification ne vaudrait rien :
> l'équipe qui renomme le champ renommerait aussi son schéma, et le contrôle passerait.
> Il vit donc dans le socle partagé — ce qui veut dire que **faire évoluer un contrat
> devient une livraison du socle**, donc un point de synchronisation entre toutes les
> équipes. La vérification ne supprime pas la coordination : elle la déplace, du moment
> où la panne se produit vers le moment où le contrat change. C'est un bien meilleur
> moment, mais ce n'est pas gratuit. »

Retour à la version saine :

```
node basculer.mjs mf-filtres 1.0.0
```

> « Et notez : la 1.0.0 publiée avant le renommage est intacte. C'est à ça que sert
> l'immuabilité. »

### 11:00 · Les deux pannes de frontière

Cliquer les deux boutons.

> « Deux équipes choisissent le même nom de balise :
> `the name "mf-tableau" has already been used with this registry`. Le registre est
> global au document, et aucune des deux équipes ne pouvait le découvrir avant
> l'exécution. Le correctif standard est bloqué par un éditeur de navigateur depuis
> mars 2026. »

> « Un fragment servi depuis une origine mal configurée :
> `Failed to fetch dynamically imported module`. Celle-ci, au moins, est **détectable et
> rattrapable** — contrairement à un message perdu sur un bus. Mais elle ne l'est que
> parce que j'ai écrit un `try/catch` : c'est le seul endroit du dispositif où cette
> panne devient observable. »

Montrer les deux lignes qui suivent dans le journal :

> « Et regardez : le navigateur rend exactement le même `TypeError` pour un refus CORS,
> un 404 et un artefact corrompu. La ligne en dessous dit laquelle des trois — mais ce
> n'est pas le navigateur qui le dit, c'est soixante lignes que j'ai écrites. C'est ça,
> concrètement, "l'observabilité de la frontière front est un prérequis". »

---

## 11:30 · Conclusion — en conditions, pas en recommandation

> « Je ne conclus pas que les micro-frontends sont une bonne ou une mauvaise idée, et je
> ne recommande aucun outil : l'étude est exploratoire et une recommandation serait
> prématurée. Je conclus sur trois conditions. »

1. **Les micro-frontends deviennent pertinents à partir de plusieurs équipes qui livrent
   sur des cadences différentes.**
2. **En dessous de ce seuil, ils ajoutent un coût de coordination sans contrepartie.**
3. **L'observabilité de la frontière front est un prérequis, pas une amélioration
   ultérieure.**

> « Et pour savoir où nous nous situons par rapport à ce seuil, il me manque quatre
> réponses que je ne peux obtenir que par entretiens : combien d'équipes possèdent les
> services concernés, si le front et les services seront sous le même domaine
> enregistrable, quel fournisseur d'identité et quel format de jeton, et si les services
> existants exposent du HTTP compatible navigateur. C'est la suite de l'étude. »

---

## Les huit questions qu'on vous posera

### « Webernetes n'est qu'un simulateur, pourquoi l'avoir utilisé ? »

> « Parce qu'il simule fidèlement le plan de contrôle, et que c'est le plan de contrôle
> qui m'intéressait. Le contrôle est réel, l'exécution des charges est simulée. Je ne le
> présente pas comme utilisable en production, et ce n'est pas ce qu'il prétend être.
> J'ai d'ailleurs relevé quatre erreurs dans son README au passage. »

### « Vous avez donc une solution ? »

> « Non. J'ai un mécanisme dont j'ai mesuré le fonctionnement et le coût, et trois
> conditions sous lesquelles la question mérite d'être posée. »

### « Le compilateur ne rattrape-t-il pas ça, dans un dépôt unique ? »

> « Non, et je l'ai mesuré : avec la rupture de contrat en place, `tsc --noEmit` sort en
> code 0, zéro erreur. Le facteur décisif n'est pas le partage du type, c'est
> l'obligatoriété des champs. Et attention au vocabulaire : ce qui donne l'atomicité,
> c'est l'**artefact unique**, pas le dépôt unique. Un monorepo donne un commit atomique,
> jamais un chargement atomique. »

### « Alors qu'est-ce que le déploiement indépendant fait perdre ? »

> « Rien de la vérification — il n'y en avait pas. Il fait perdre l'**objet vérifiable**
> et l'**atomicité de la réparation**. En artefact unique il existe une combinaison, et
> c'est celle qui est livrée. En déploiement indépendant il en existe N × M, et celle qui
> tourne chez l'utilisateur n'a peut-être jamais été assemblée nulle part. »

### « Peut-on faire des microservices dans le front ? »

> « C'est un abus de langage. Un microservice se définit par un déploiement indépendant,
> un cycle de vie propre et une frontière réseau. Dans un onglet, zéro de ces trois
> propriétés ne survit en lecture stricte. Ce qui survit — isolation mémoire,
> indépendance de langage, vérification de forme au build — ce sont les propriétés d'un
> système de **plugins isolés**. »

### « Et chaque équipe avec son propre langage ? »

> « Chaque équipe avec son propre **framework** : oui, c'est acquis et gratuit, ma
> démonstration principale le fait déjà par les Web Components. Chaque équipe avec son
> propre **langage** : non. Chaque langage embarque son environnement d'exécution et ils
> ne se mutualisent pas — un composant trivial pèse 16 Ko en Rust, 500 Ko à 2 Mo en Go,
> 35 Mo en Python. Côté serveur, le polyglottisme coûte à l'entreprise ; côté front, il
> coûte à l'utilisateur, qui télécharge chaque mégaoctet à chaque visite. »

### « Et WebAssembly, ça ne règle pas le problème du contrat ? »

> « Partiellement, et pas dans un navigateur aujourd'hui. Le modèle de composants est en
> phase 1 sur 5, aucun moteur de navigateur ne l'implémente, et la seule voie navigateur
> régénère la couche JavaScript qu'on voulait supprimer. Sur le fond : le trou a cinq
> colonnes — contrat de forme, code d'état, délai et réessai, annulation, trace. Le
> modèle de composants en comble une. Il déplace le problème, il ne le ferme pas. »

### « Votre maquette prouve-t-elle le déploiement indépendant ? »

> « Non, et je l'annonce avant de la lancer. Elle prouve la résolution à l'exécution et
> la recompilation séparée. C'est déjà ce qui manquait à ma première démonstration, mais
> ce n'est pas la gouvernance. »

---

## Ce qu'il ne faut jamais dire

- « PGlite tournera sur Cloudflare » — trois blocages cumulés, et le seul exemple
  officiel est abandonné depuis juin 2024.
- « On déplacera une partie du front à la périphérie » — on vous répondra « et le DOM ? »,
  et il n'y a pas de réponse.
- « Des microservices dans le front » — voir plus haut.
- « Le compilateur rattrape en dépôt unique » — falsifiable en huit secondes sur votre
  propre machine.
- Les chiffres d'une page d'accueil. Ceux de PGlite annoncent moins de 3 Mo pour 5,49 Mo
  réels. Mesurez, et dites que vous avez mesuré.

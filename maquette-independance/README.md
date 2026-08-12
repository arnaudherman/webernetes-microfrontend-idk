# Maquette — résolution à l'exécution et recompilation séparée

Maquette indépendante de la démonstration principale. Elle ne la modifie pas et ne
partage rien avec elle.

Elle répond à une question précise : **que faut-il, exactement, pour que plusieurs
équipes livrent sur un même front sans se recompiler mutuellement ?**

## Ce qu'elle prouve, et ce qu'elle ne prouve pas

**À dire avant de commencer, sous peine d'effondrement à la première question.**

Elle prouve **quatre choses** :

1. La résolution à l'exécution existe, elle repose sur des **standards du web**, et elle
   permet à des artefacts compilés séparément de partager une dépendance sans qu'aucun
   d'eux ne connaisse l'URL de cette dépendance.
2. Un artefact peut être **recompilé et re-servi sans qu'un octet des autres ne bouge**,
   et sans redémarrer un serveur.
3. Une version publiée est **immuable et opposable** : la republier avec un contenu
   différent est refusé, et un artefact altéré après publication est **rejeté par le
   navigateur** grâce à la clé `integrity` de la carte d'import.
4. Le **retour arrière** ne demande ni compilation, ni redéploiement, ni redémarrage :
   c'est une modification du manifeste, mesurée à 62 ms.

5. Une panne de frontière peut être **qualifiée**, mais seulement par du code maison :
   le navigateur rend le même `TypeError` pour un refus CORS, un 404 et une empreinte
   incorrecte.
6. Une combinaison de versions **jamais assemblée peut être refusée au déploiement**,
   par une porte écrite à la main, car rien dans le navigateur ne la vérifie.

7. Une charge utile qui ne respecte pas son contrat peut être **refusée avant remise**,
   avec le motif exact — c'est-à-dire exactement ce que l'essai 5 de la démonstration
   principale laisse passer en silence.

Elle **ne prouve toujours pas tout** : il n'y a ni chaîne de livraison réelle, ni
vérification du SENS des charges utiles (unités, invariants métier), ni gouvernance des
contrats au sens organisationnel. Les artefacts sont servis depuis le même disque
par le même processus ; le nombre de processus n'a aucune importance pour ce qui est
démontré, mais il ne faut pas laisser croire l'inverse.

## Les deux mécanismes qu'il a fallu écrire soi-même

Ce sont les plus instructifs de la maquette, parce qu'ils chiffrent ce que « à construire
entièrement » veut dire.

### Qualifier une panne de frontière — environ 60 lignes

Le navigateur rend le **même** `TypeError: Failed to fetch dynamically imported module`
pour une origine injoignable, un refus CORS, un 404, un 500 et une empreinte d'intégrité
incorrecte. C'est une protection, pas un diagnostic.

`shell.js` refait donc une requête et tranche : requête opaque pour distinguer une
origine morte d'un refus CORS, code d'état pour le reste, et recalcul de l'empreinte
SHA-384 pour identifier un artefact altéré. Résultat à l'écran :

```
[intégrité] l'artefact a été modifié après publication — attendu qXEY9e+F8Q…, obtenu r0zovU/5GU…
[CORS]      http://localhost:5105 répond, mais refuse le partage d'origine
```

Deux limites énoncées dans le code : c'est une **seconde** requête, donc une panne
transitoire peut se comporter différemment ; et `crypto.subtle` exige un contexte
sécurisé — localhost en est un, un serveur interne en http nu n'en serait pas un.

### La porte de déploiement sur combinaisons — environ 120 lignes

En artefact unique, il n'existe à tout instant qu'**une** combinaison de fragments. En
déploiement indépendant il en existe N × M, et celle qui s'exécute chez l'utilisateur
peut n'avoir jamais existé nulle part.

`combinaisons.json` enregistre les combinaisons assemblées. `basculer.mjs` refuse d'en
déployer une inconnue :

```
REFUS — cette combinaison n'a jamais été assemblée :
    mf-calcul@1.2.0 + mf-filtres@3.2.0 + mf-tableau@1.1.0 + socle@3.0
```

Le cycle complet : `basculer --non-approuvee` pour assembler, vérifier dans le
navigateur, puis `approuver.mjs --preuve "…"`. La preuve est obligatoire.

**Ce que cette porte ne fait pas, et qu'il faut dire :** elle ne teste rien. Elle vérifie
mécaniquement que chaque artefact existe et correspond à son empreinte, puis elle
enregistre une **déclaration humaine** — exactement comme les portes de déploiement côté
serveur, qui enregistrent le résultat d'une vérification faite ailleurs. Une combinaison
approuvée à la légère est une combinaison approuvée.

## Démarrage

```
node construire.mjs      compile les quatre dépôts vers leur dist/
node publier.mjs         publie sous publie/<version>/, régénère manifeste et cartes
node servir.mjs          lance les sept origines, Ctrl-C pour tout arrêter
```

### Publier n'est pas déployer

C'est la distinction que la maquette matérialise, et elle n'est pas cosmétique.

**Publier** rend une version disponible sous une URL immuable. **Déployer**, c'est
décider qu'elle est celle que les utilisateurs reçoivent — une modification du manifeste,
faite séparément :

```
node basculer.mjs                        liste les versions, [x] = servie
node basculer.mjs mf-tableau 1.1.0       déploie
node basculer.mjs mf-tableau 1.0.0       retour arrière
```

Si publier déployait automatiquement, une version fautive partirait en production à la
seconde où elle est construite, et le retour arrière n'existerait pas. `publier.mjs`
conserve donc la version en service tant qu'elle est toujours publiée.

Puis ouvrir <http://localhost:5100/>.

Aucune dépendance à installer : `servir.mjs` et `empreintes.mjs` n'utilisent que
`node:http`, `node:fs` et `node:crypto`. La construction réutilise le Vite déjà présent
à la racine du dépôt. Tout fonctionne hors ligne.

## Les sept origines

| Port | Rôle | Sert |
|---|---|---|
| 5100 | shell de composition | `shell/` |
| 5101 | équipe tableau | `equipe-tableau/publie/` |
| 5102 | équipe filtres | `equipe-filtres/publie/` |
| 5103 | équipe socle | `socle/` — versions 3.0 et 4.0, API identique |
| 5104 | dépôt concurrent | `depot-concurrent/publie/` |
| 5105 | origine **sans CORS** | `equipe-sans-cors/` |
| 5106 | équipe calcul (Rust) | `equipe-calcul/publie/` |

## Déroulé, environ deux minutes

**0. Annoncer les limites** — la section ci-dessus. Une démonstration qui annonce ses
limites prouve moins, mais tient.

**1. Montrer la séparation des sources.** Quatre répertoires, quatre `package.json`, quatre
`vite.config.ts`. Aucun ne connaît les autres.

**2. Montrer que le spécificateur nu survit à la compilation.**

```
head -1 equipe-tableau/dist/mf-tableau.js
head -1 equipe-filtres/dist/mf-filtres.js
```

Les deux artefacts dont on vient d'afficher la première ligne contiennent
`import { … } from "@socle/bus"`. **Ce nom n'a pas été résolu à la compilation.** Sans
cela, chaque fragment embarquerait sa propre copie du socle et le bus cesserait d'être
partagé — sans que rien ne le signale.

Vérification mécanique : `grep -c "__instancesSocle" equipe-*/dist/*.js` doit rendre `0`.

**3. Ouvrir le shell.** Les trois fragments se chargent depuis trois origines différentes.
Le journal de gauche montre le manifeste puis chaque chargement. Cliquer un filtre : le
tableau reçoit la charge utile, et `publier()` rend son verdict — à l'écran,
**`remis à 2 abonné(s) : mf-tableau, mf-calcul`**.

Cliquer « recenser les instances du socle » : **une seule instance**, alors que trois
artefacts compilés séparément l'importent.

**4. LA PREUVE CENTRALE.** C'est la seule étape qui compte vraiment.

```
node empreintes.mjs
sed -i '' 's/tableau v1/tableau v1.1 RECOMPILÉ SEUL/' equipe-tableau/src/mf-tableau.ts
node construire.mjs equipe-tableau
node empreintes.mjs
```

**Une empreinte change. Les quatre autres sont identiques au bit près. Aucun serveur n'a
été redémarré.** Recharger la page : le nouveau libellé apparaît, l'autre fragment n'a
pas bougé.

Mesure du 12 août 2026 : construction en 33 ms, artefact de 2 447 à 2 465 octets. Le
même code reconstruit rend la même empreinte — la construction est déterministe.

**4 bis. Déployer, revenir en arrière, et l'immuabilité.**

L'équipe tableau publie sa 1.1.0 — elle seule, sans prévenir personne :

```
sed -i '' 's/"version": "1.0.0"/"version": "1.1.0"/' equipe-tableau/package.json
node construire.mjs equipe-tableau && node publier.mjs
```

Noter que **rien n'a changé à l'écran** : publier ne déploie pas. Puis :

```
node basculer.mjs mf-tableau 1.1.0     # recharger : la 1.1.0 apparaît
node basculer.mjs mf-tableau 1.0.0     # recharger : la 1.0.0 est revenue
```

**62 ms de commande, zéro compilation, zéro redémarrage.** Les deux versions restent en
ligne côte à côte, sous leurs URL respectives.

Deux refus à montrer, dans cet ordre :

- **republier une version existante avec un contenu différent** → refusé, et le manifeste
  n'est pas modifié. Une version publiée ne se réécrit pas : c'est ce qui rend le retour
  arrière possible ;
- **altérer un artefact déjà publié, en place** → le navigateur le rejette, l'empreinte
  `integrity` de la carte d'import ne correspondant plus. Le fragment ne monte pas, **les
  autres continuent**. L'immuabilité cesse d'être une promesse d'organisation pour devenir
  une contrainte vérifiée par la plateforme.

Un point d'honnêteté : le message d'erreur est un `TypeError` **identique** à celui d'une
panne CORS. Le navigateur protège, mais il ne dit pas de quoi — l'application ne peut pas
distinguer un artefact corrompu d'un serveur mal configuré.

**5. La coexistence de deux versions, et ce qu'elle casse.**
Ouvrir <http://localhost:5100/coexistence.html>. La carte d'import y porte une clé
`scopes` : tout ce qui vient du port 5102 résout `@socle/bus` vers la version 4.0.

C'est le **seul moyen standard** de faire coexister deux versions d'une dépendance
partagée. Il est déclaratif et **sans négociation**.

Cliquer un filtre. Résultat mesuré :

- `mf-tableau` est lié à `socle@3.0`, `mf-filtres` à `socle@4.0` ;
- `publier()` rend **`remis: false`** — à l'écran, *charge conforme, mais aucun abonné ne
  l'écoutait* ;
- le tableau ne reçoit **rien** ;
- le recensement montre **deux instances** du socle ;
- **aucune exception, aucun avertissement, aucune entrée dans la console.**

Coexistence de versions et état partagé sont **antagonistes**. Ce n'est pas un défaut de
la carte d'import ni du socle : c'est la sémantique des modules ES. Les deux versions du
socle ne diffèrent ici que par leur numéro, et cela suffit.

**6. Les deux pannes de frontière.**

- « charger le dépôt concurrent » →
  `NotSupportedError : the name "mf-tableau" has already been used with this registry`.
  Le registre d'éléments personnalisés est **global au document**. Aucune des deux
  équipes ne pouvait découvrir le conflit avant l'exécution. Le correctif standard — les
  registres à portée — est bloqué par Firefox depuis mars 2026.
- « charger depuis une origine sans CORS » →
  `TypeError : Failed to fetch dynamically imported module`.
  Détectable et rattrapable, **contrairement à un bus d'événements** — mais le `try/catch`
  du shell est le seul endroit du dispositif où cette panne devient observable. Sans lui,
  un fragment absent disparaît en silence.

## Ce qui est acquis, et ce qui reste à construire

| | Nature |
|---|---|
| Frontière d'encapsulation (éléments personnalisés, Shadow DOM) | **standard du web** |
| Résolution d'un spécificateur nu à l'exécution (carte d'import) | **standard du web** |
| Chargement d'un artefact distant (`import()` dynamique) | **standard du web** |
| Coexistence de deux versions (clé `scopes`) | **standard du web**, mais sans négociation |
| Le manifeste balise → URL | **code maison** — aucune spécification ne le définit |
| L'arbitrage des noms de balises | **discipline** — préfixes par équipe |
| La négociation de version du socle | **outillage ou discipline** |
| Le délai, le réessai, la trace | **outillage ou code maison** |
| La vérification du contrat entre fragments | **outillage et discipline** |
| Le retrait d'une version, le retour arrière | **discipline** |

Les quatre premières lignes sont gratuites et durables. Les six suivantes sont le vrai
coût du modèle, et aucune n'est fournie par le navigateur.

## La vérification de forme — et la question qui décide de tout

`socle/v3/contrats.js` déclare la forme attendue de chaque événement contractualisé, et
`publier()` valide **avant** remise. Une charge non conforme n'est remise à personne :

```
[REFUSÉ] filtre:change ← mf-filtres  {"etat":"en-cours"}
         champ requis absent : statut · champ inattendu : etat
```

C'est le même renommage que l'essai 5 de la démonstration principale. Là-bas, le tableau
affiche « 9 sur 9 » et se croit juste. Ici, le message est arrêté et l'écart est nommé.

### Qui possède le schéma

**C'est la seule question qui compte, et elle n'est pas technique.**

Si le schéma était déclaré par le producteur, la vérification ne vaudrait rien : une
équipe qui renomme `statut` en `etat` renommerait aussi son schéma, et le contrôle
passerait. Le contrat ne serait qu'un miroir du code qu'il prétend contraindre.

Le schéma vit donc dans le socle partagé. Conséquence directe : **faire évoluer un
contrat devient une livraison du socle**, donc un point de synchronisation entre toutes
les équipes qui en dépendent.

> La vérification ne supprime pas la coordination. Elle la **déplace**, du moment où la
> panne se produit vers le moment où le contrat change. C'est un bien meilleur moment,
> mais ce n'est pas gratuit.

### Quatre limites levées, et ce que chaque levée a coûté

Ces quatre limites étaient réelles. Aucune n'était un mur — toutes se sont levées, et
c'est le prix payé qui est instructif.

| Limite | Levée par | Prix |
|---|---|---|
| `publier()` rendait un entier ambigu : un zéro pouvait signifier « refusé », « personne n'écoute » ou « événement inconnu » | socle **3.0**, qui rend un verdict `{ remis, abonnes, refuse, ecarts }` | une **rupture** du socle. Mais seules les équipes exploitant la valeur de retour ont dû être reconstruites — `mf-tableau` 1.0.0 tourne sans modification sur le socle 3.0 |
| Le validateur ne voyait que la forme, donc `{ statut: "en_cours" }` passait | `valeurs`, `borne`, `entier`, `regles` inter-champs | il faut **écrire** l'ensemble des valeurs légales. Un validateur ne vérifie que ce que quelqu'un a pris la peine de déclarer |
| La porte de combinaisons enregistrait une déclaration humaine | le shell **teste** l'assemblage dans le navigateur et poste son verdict | un point d'entrée serveur, et un test de fumée qui reste un test de fumée |
| Faire évoluer un contrat imposait une livraison synchronisée | contrats **versionnés** avec fenêtre de migration `actives` | quelqu'un doit ouvrir la fenêtre, surveiller qui n'a pas migré, et la fermer |

### Ce qui ne se lève pas

Une frontière franchie par un appel de fonction dans le même fil ne donnera jamais
gratuitement ce qu'une frontière réseau donne gratuitement. Chaque pièce se reconstruit —
et elles l'ont toutes été ici — mais on la construit, on la possède, on la maintient.

Ce n'est pas une limite de la technologie : c'est la définition d'une frontière. **Le coût
n'est pas technique, il est de possession.**

Une seule chose reste hors d'atteinte de tout validateur : une unité changée en silence.
`chargeJours: 16` où 16 désigne des heures traverse la forme, les bornes et les entiers.
La parade est de faire porter l'unité **par la donnée** — `{ valeur: 16, unite: "heures" }`
avec `unite` en ensemble fermé, ce que fait le contrat `tache:estimee`. Ce n'est pas une
limite d'outillage, c'est une décision de modélisation.

## L'équipe calcul — l'indépendance de langage, et son prix

Une cinquième équipe écrit sa logique en Rust, compilée en WebAssembly. Le fragment
expose la même agrégation trois fois. Mesuré dans Chrome 151, sur 100 000 tâches :

| | |
|---|---|
| JavaScript, sans franchir de frontière | 2,34 ms |
| Rust, avec du JSON à l'aller et au retour | 33,46 ms |
| Rust, avec des tableaux typés | **0,240 ms** |

**Un facteur 140 entre deux appels au même code Rust**, selon la seule forme des données
qu'on fait traverser la frontière. L'approche naïve est plus lente que de ne pas franchir
la frontière du tout : un choix de langage fait pour la performance, associé à du JSON,
produit un système plus lent que s'il n'avait rien été fait.

C'est la thèse du dépôt transposée d'un cran : **le prix d'une frontière ne tient pas au
langage, il tient à ce qu'on lui fait traverser.**

Coût d'entrée mesuré : **37,4 ko gzip** — binaire wasm 32,3, glu wasm-bindgen 2,6,
fragment 2,5. Le « hello world » Rust en pesait 14,7 : `serde` et `serde_json` doublent
la charge. Il faut télécharger 37 ko pour gagner 2 ms sur 100 000 éléments ; l'arbitrage
doit être explicite.

Ce que cette équipe ne démontre pas, et que le fragment affiche lui-même : **WebAssembly
n'a aucun accès au DOM**. Il isole le calcul, jamais l'affichage.

Un clone sans Rust fait tourner la maquette : les artefacts publiés sont versionnés.

## Les mesures, rejouables

`http://localhost:5100/mesures.html` refait sur votre machine tous les chiffres cités
dans cette étude : qui protège d'un fragment qui boucle, si `terminate()` interrompt
vraiment, ce que coûte un franchissement par taille, et si la carte d'import traverse la
frontière du Worker.

La page **refuse de mesurer** si l'onglet est en arrière-plan ou si le fil principal est
déjà perturbé au repos. Chrome bride les minuteurs d'un onglet masqué à environ un par
seconde : tous les blocages y rendraient ~1000 ms, référence comprise. Une mesure
silencieuse et fausse coûte plus cher que pas de mesure.

## Le piège de vocabulaire

Ne dites pas « monorepo » là où il faut dire « **artefact unique** ». Trois axes sont
orthogonaux — le dépôt, l'artefact, le déploiement — et huit combinaisons sont possibles.
L'atomicité d'un changement vient de l'artefact unique, pas du dépôt unique : un monorepo
donne un **commit** atomique, jamais un **chargement** atomique.

## Portabilité

Mesuré sous Chrome 151. **Les cartes d'import multiples ne sont pas portables** : Firefox
150 les garde derrière une préférence désactivée par défaut. Cette maquette n'utilise
qu'**une seule carte par document**, ce qui reste portable — mais une architecture où
chaque équipe déposerait sa propre carte ne l'est pas.

## Lien avec la démonstration principale

La démonstration principale, à la racine du dépôt, établit qu'une frontière front par bus
d'événements n'est vérifiée par personne. Cette maquette montre ce qui se passe une
couche plus bas, au chargement : la même absence de signal, à l'échelle du déploiement.

# Maquette — résolution à l'exécution et recompilation séparée

Maquette indépendante de la démonstration principale. Elle ne la modifie pas et ne
partage rien avec elle.

Elle répond à une question précise : **que faut-il, exactement, pour que plusieurs
équipes livrent sur un même front sans se recompiler mutuellement ?**

## Ce qu'elle prouve, et ce qu'elle ne prouve pas

**À dire avant de commencer, sous peine d'effondrement à la première question.**

Elle prouve **deux choses, et deux seulement** :

1. La résolution à l'exécution existe, elle repose sur des **standards du web**, et elle
   permet à des artefacts compilés séparément de partager une dépendance sans qu'aucun
   d'eux ne connaisse l'URL de cette dépendance.
2. Un artefact peut être **recompilé et re-servi sans qu'un octet des autres ne bouge**,
   et sans redémarrer un serveur.

Elle **ne prouve pas le déploiement indépendant**. Il n'y a ici ni chaîne de livraison,
ni version immuable publiée, ni retour arrière, ni vérification qu'une combinaison de
versions ait jamais été assemblée quelque part. **Recompiler séparément n'est pas
déployer indépendamment.** Les artefacts sont servis depuis le même disque par le même
processus ; le nombre de processus n'a aucune importance pour ce qui est démontré, mais
il ne faut pas laisser croire l'inverse.

## Démarrage

```
node construire.mjs      construit les trois dépôts
node servir.mjs          lance les six origines, Ctrl-C pour tout arrêter
```

Puis ouvrir <http://localhost:5100/>.

Aucune dépendance à installer : `servir.mjs` et `empreintes.mjs` n'utilisent que
`node:http`, `node:fs` et `node:crypto`. La construction réutilise le Vite déjà présent
à la racine du dépôt. Tout fonctionne hors ligne.

## Les six origines

| Port | Rôle | Sert |
|---|---|---|
| 5100 | shell de composition | `shell/` |
| 5101 | équipe tableau | `equipe-tableau/dist/` |
| 5102 | équipe filtres | `equipe-filtres/dist/` |
| 5103 | équipe socle | `socle/` — versions 1.0 et 2.0 |
| 5104 | dépôt concurrent | `depot-concurrent/dist/` |
| 5105 | origine **sans CORS** | `equipe-sans-cors/` |

## Déroulé, environ deux minutes

**0. Annoncer les limites** — la section ci-dessus. Une démonstration qui annonce ses
limites prouve moins, mais tient.

**1. Montrer la séparation des sources.** Trois répertoires, trois `package.json`, trois
`vite.config.ts`. Aucun ne connaît les autres.

**2. Montrer que le spécificateur nu survit à la compilation.**

```
head -1 equipe-tableau/dist/mf-tableau.js
head -1 equipe-filtres/dist/mf-filtres.js
```

Les deux artefacts contiennent `import { … } from "@socle/bus"`. **Ce nom n'a pas été
résolu à la compilation.** Sans cela, chaque fragment embarquerait sa propre copie du
socle et le bus cesserait d'être partagé — sans que rien ne le signale.

Vérification mécanique : `grep -c "__instancesSocle" equipe-*/dist/*.js` doit rendre `0`.

**3. Ouvrir le shell.** Les deux fragments se chargent depuis deux origines différentes.
Le journal de gauche montre le manifeste puis chaque chargement. Cliquer un filtre : le
tableau reçoit la charge utile, et `publier()` retourne **1 abonné**.

Cliquer « recenser les instances du socle » : **une seule instance**, alors que deux
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

**5. La coexistence de deux versions, et ce qu'elle casse.**
Ouvrir <http://localhost:5100/coexistence.html>. La carte d'import y porte une clé
`scopes` : tout ce qui vient du port 5102 résout `@socle/bus` vers la version 2.0.

C'est le **seul moyen standard** de faire coexister deux versions d'une dépendance
partagée. Il est déclaratif et **sans négociation**.

Cliquer un filtre. Résultat mesuré :

- `mf-tableau` est lié à `socle@1.0`, `mf-filtres` à `socle@2.0` ;
- `publier()` retourne **0 abonné** ;
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

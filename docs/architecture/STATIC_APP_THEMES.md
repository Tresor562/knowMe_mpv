# KMD-031 — Thèmes d’application statiques

## Objectif

KMD-031 remplace le thème sombre codé en dur par une préférence d’apparence autoritaire et synchronisée entre Web et Mobile.

La livraison reste volontairement statique : aucune animation lourde, aucun asset distant et aucun avantage fonctionnel ne dépend du thème sélectionné.

## Catalogue

Le catalogue initial contient :

- `system` : suit le mode clair ou sombre de l’appareil ;
- `light` : palette claire accessible ;
- `dark` : palette sombre KnowMe ;
- `midnight` : palette sombre Premium, droit `theme.midnight` ;
- `ivory` : palette claire Premium, droit `theme.ivory`.

Les thèmes Premium sont visibles mais marqués verrouillés tant que l’entitlement correspondant n’est pas actif. Le client ne décide jamais lui-même qu’un thème Premium est autorisé.

## Préférence autoritaire

`UserAppearancePreference` conserve :

- la clé sélectionnée ;
- le mode de contraste ;
- la réduction de transparence ;
- une version monotone ;
- les dates de création et de mise à jour.

L’API expose `GET /appearance` et `PATCH /appearance`.

Chaque écriture peut fournir `expectedVersion`. Une version obsolète produit `APPEARANCE_VERSION_CONFLICT` afin qu’un appareil ne remplace pas silencieusement une modification plus récente.

## Thème sélectionné et thème effectif

La préférence distingue :

- `selectedThemeKey` : choix conservé par le compte ;
- `effectiveThemeKey` : thème actuellement autorisé et applicable.

Lorsqu’un entitlement Premium expire ou est révoqué, le choix Premium est conservé mais le serveur renvoie `system` comme thème effectif avec `ENTITLEMENT_MISSING`. Aucun client ne peut continuer à appliquer le thème verrouillé.

## Web sans flash

Le Web conserve la dernière réponse sûre dans `localStorage`.

Un script exécuté dans le `<head>` applique la palette avant l’hydratation React. Après ouverture de session, `ThemeRuntime` recharge la préférence serveur, corrige le cache local et écoute les changements du mode système.

Les styles utilisent des tokens CSS communs. Les pages existantes héritent des palettes sans dupliquer de couleurs par écran.

## Accessibilité

Deux options sont synchronisées :

- contraste `STANDARD` ou `HIGH` ;
- réduction des transparences et du flou.

Les thèmes restent statiques et respectent `prefers-reduced-motion`. Les focus clavier utilisent un contour visible issu du token d’accent.

## Mobile

Le client Mobile :

- charge la préférence mise en cache avec `AsyncStorage` ;
- synchronise la réponse serveur ;
- résout `system` à partir du schéma de couleurs natif ;
- fournit les palettes et le style de barre d’état ;
- envoie la version attendue lors des modifications.

Le verrouillage Premium demeure exclusivement serveur.

## Cycle de vie du compte

L’export de compte passe au format `7` et inclut `appearance`.

La suppression du compte efface `UserAppearancePreference` dans la transaction de suppression. Chaque modification produit un événement `APPEARANCE_PREFERENCE_UPDATED`.

## Hors périmètre

KMD-031 ne contient pas :

- d’icône d’application alternative ;
- de cadeau ;
- de thème animé ;
- de thème influençant les scores, récompenses ou priorités sociales ;
- de validation Premium effectuée côté client.

# Internationalisation KnowMe

## Objectif

KMD-049 fournit une fondation commune pour afficher l’interface KnowMe en français ou en anglais, synchroniser le choix sur les appareils et traduire les erreurs techniques à partir de codes API stables.

Cette fondation ne traduit jamais automatiquement les publications, messages, biographies, réponses aux défis ou autres contenus créés par les utilisateurs.

## Source de vérité

Le package `@knowme/i18n-contract` contient :

- les locales prises en charge ;
- la locale de secours ;
- les clés de traduction partagées ;
- les dictionnaires français et anglais ;
- les règles de normalisation et de fallback ;
- le parsing de `Accept-Language` ;
- les pluriels et formats `Intl` ;
- la direction de texte ;
- les messages clients associés aux codes d’erreur API stables.

Le français est la langue de secours. Une clé absente ne doit jamais produire un écran vide ni faire confiance à une chaîne arbitraire reçue du client.

## Résolution de la langue

Avant authentification ou tant qu’aucune préférence n’est enregistrée :

1. le client utilise sa valeur locale mise en cache ;
2. sinon il détecte la langue du navigateur ou de l’appareil ;
3. le serveur peut résoudre `Accept-Language` ;
4. toute langue non prise en charge retombe sur le français.

Après enregistrement :

1. `UserLocalePreference` devient la préférence autoritaire ;
2. les en-têtes de l’appareil ne remplacent plus ce choix ;
3. Web et Mobile mettent leur cache à jour depuis le serveur ;
4. chaque requête continue d’envoyer `Accept-Language` pour les surfaces non authentifiées et les évolutions futures.

## Concurrence multi-appareil

Chaque préférence possède une version entière. Une mise à jour doit fournir `expectedVersion`.

Le serveur utilise une transaction sérialisable et n’accepte la mise à jour que si la version attendue est encore courante. Un conflit renvoie le code stable `I18N_VERSION_CONFLICT` et la version actuelle. Le client recharge alors la préférence au lieu d’écraser silencieusement le choix effectué sur un autre appareil.

## Erreurs localisables

L’API conserve ses codes d’erreur stables et son `requestId`. Les textes serveur restent des fallbacks fonctionnels, pas la source de traduction de l’interface.

Web et Mobile :

1. lisent `code` ;
2. sélectionnent le texte correspondant à la locale courante ;
3. retombent sur le message métier serveur lorsque le code est inconnu ;
4. conservent la référence support `requestId`.

Les erreurs internes ne doivent jamais exposer de pile, de secret ou de détail fournisseur.

## Formats et pluriels

Les nombres, dates, heures relatives et catégories de pluriel reposent sur les API `Intl` natives. Aucun écran ne doit construire manuellement une date localisée ou ajouter un `s` conditionnel.

Les fuseaux horaires restent une préférence fonctionnelle distincte. Changer la langue ne change pas silencieusement le fuseau, la devise, les horaires silencieux ou les règles de notification.

## Direction de texte

Le contrat sait déterminer `ltr` ou `rtl`. KMD-049 applique `lang` et `dir` au document Web et expose la direction au runtime Mobile.

Aucune locale RTL n’est encore publiée. Ajouter une telle locale exigera une validation visuelle de chaque écran avant de l’ajouter à `SUPPORTED_LOCALES`.

## Intégration Web

Le Web applique la locale avant l’hydratation pour éviter un flash dans la mauvaise langue. Un store externe basé sur `useSyncExternalStore` expose traduction et formatage, synchronise la préférence et met à jour `html.lang`, `html.dir` et `data-locale`.

`I18nRuntime` monte ce store à la racine sans dépendre d’un `Context.Provider`, ce qui évite les incompatibilités entre les résolutions React du monorepo. La navigation globale, les erreurs API et la section Langue des paramètres utilisent déjà ce runtime. Les autres écrans doivent migrer progressivement vers les clés partagées sans modifier leur logique métier.

## Intégration Mobile

Le Mobile charge d’abord sa préférence locale, puis la préférence serveur si une session existe. Le fournisseur i18n est installé à la racine de l’application via `AppearanceProvider`.

Les erreurs API et la section Langue du profil utilisent déjà ce runtime. Les autres expériences peuvent migrer écran par écran sans recréer un stockage ou un dictionnaire local.

## Vie privée et cycle de vie

La préférence de langue ne contient aucune géolocalisation, adresse IP ou historique de navigation. Elle est auditée uniquement lors d’un choix explicite.

Elle est incluse dans l’export de compte version 10 uniquement lorsqu’elle existe réellement. Une langue seulement détectée ne crée pas de ligne et ne change pas la version d’export.

La suppression du compte efface `UserLocalePreference` dans la même transaction que les autres données de compte.

## Règles d’extension

Pour ajouter une clé :

1. l’ajouter au catalogue français canonique ;
2. fournir la valeur anglaise typée ;
3. utiliser des paramètres nommés pour les valeurs dynamiques ;
4. utiliser les helpers de pluriel et de formatage ;
5. ne jamais insérer du HTML provenant d’une traduction ;
6. ajouter ou adapter un test.

Pour ajouter une locale :

1. compléter toutes les clés ;
2. vérifier les pluriels `Intl` ;
3. vérifier dates, nombres et direction ;
4. tester Web et Mobile ;
5. ajouter la locale au catalogue serveur seulement après cette validation.

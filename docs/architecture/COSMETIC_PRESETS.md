# KMD-030 — Presets cosmétiques et thèmes de profil synchronisés

## Objectif

KMD-030 permet à un membre de composer plusieurs objets cosmétiques déjà possédés dans un preset nommé, de prévisualiser son application et d’activer l’ensemble en une seule transaction.

Un preset reste exclusivement visuel. Il ne peut contenir ni effet de jeu, ni score, ni XP, ni priorité sociale, ni information de prix ou de provenance économique.

## Modèle autoritaire

Le serveur conserve quatre ensembles de données :

- `CosmeticPreset` : nom et propriétaire du thème ;
- `CosmeticPresetItem` : un objet maximum par slot ;
- `CosmeticPresetState` : preset par défaut, preset actif et version d’activation ;
- `CosmeticPresetActivation` : reçu idempotent et snapshot d’activation.

Chaque entrée du preset référence une définition cosmétique versionnée. Le client ne peut jamais fournir un asset arbitraire.

## Création et mise à jour

Avant d’enregistrer un preset, le serveur vérifie pour chaque objet :

1. que la définition existe ;
2. que le membre possède encore l’objet ;
3. que le slot déclaré correspond au slot de la définition ;
4. que l’objet est actif et dans sa fenêtre de disponibilité ;
5. qu’un même slot n’apparaît pas deux fois.

Les noms sont normalisés pour empêcher deux presets équivalents avec seulement des différences d’espaces ou de casse.

## Prévisualisation

`GET /cosmetics/presets/:id/preview` recharge le preset depuis la base et calcule une vue sûre.

Un slot présent dans `hiddenCosmeticSlots` reste visible dans l’outil privé de prévisualisation, mais il est marqué `applicable: false` avec `blockedReason: HIDDEN_SLOT`. La prévisualisation ne change aucun équipement et ne modifie jamais les préférences de confidentialité.

## Activation atomique et idempotente

`POST /cosmetics/presets/:id/activate` exige une clé d’idempotence.

Dans une transaction unique, le serveur :

1. recharge le preset appartenant au membre ;
2. valide à nouveau les possessions et la disponibilité ;
3. retire du preset les objets révoqués, expirés ou incohérents ;
4. ignore les slots masqués par la confidentialité ;
5. remplace l’équipement courant par l’ensemble applicable ;
6. augmente `activationVersion` et définit `activePresetId` ;
7. crée un reçu `CosmeticPresetActivation` contenant le snapshot appliqué.

La réutilisation de la même clé pour le même membre et le même preset renvoie le reçu existant sans créer une seconde activation. Une clé déjà utilisée pour une autre opération produit un conflit.

## Preset par défaut

Un membre peut définir un preset par défaut. Cette préférence est synchronisée dans `CosmeticPresetState` et ne déclenche pas automatiquement une activation.

La suppression du preset remet automatiquement les références active et par défaut à `null`, tout en conservant les reçus historiques avec le nom et le snapshot d’activation.

## Nettoyage automatique

Les lectures, prévisualisations et activations suppriment automatiquement les entrées dont :

- la possession a été révoquée ;
- la définition est désactivée ;
- la fenêtre de disponibilité est terminée ou pas encore ouverte ;
- le slot enregistré ne correspond plus à la définition.

Ce nettoyage empêche un ancien preset de rééquiper un objet devenu invalide.

## API

Toutes les routes sont authentifiées :

- `GET /cosmetics/presets` ;
- `POST /cosmetics/presets` ;
- `PATCH /cosmetics/presets/:id` ;
- `GET /cosmetics/presets/:id/preview` ;
- `POST /cosmetics/presets/:id/activate` ;
- `POST /cosmetics/presets/:id/default` ;
- `DELETE /cosmetics/presets/:id`.

## Web et Mobile

- `/cosmetics/presets` permet de composer, prévisualiser, activer, définir par défaut et supprimer un thème ;
- l’inventaire Web contient un accès direct vers les thèmes synchronisés ;
- le client Mobile expose les types et appels de création, mise à jour, prévisualisation, activation, défaut et suppression.

L’état actif et `activationVersion` sont renvoyés par le serveur et constituent la source de synchronisation entre appareils.

## Cycle de vie du compte

Les presets, leur état et les reçus d’activation sont inclus dans `account/export` sous `cosmetics.presets`, sans changer la version historique du format d’export.

La suppression du compte efface l’état, les reçus et les presets avant de supprimer l’inventaire cosmétique.

## Validation

La suite KMD-030 couvre :

- la normalisation des noms ;
- les garanties visuelles et atomiques ;
- les fenêtres de disponibilité ;
- la création d’un preset par défaut ;
- la prévisualisation ;
- le respect d’un slot masqué ;
- l’activation atomique ;
- le replay idempotent ;
- le nettoyage après révocation ;
- l’export du compte ;
- la suppression complète du compte.

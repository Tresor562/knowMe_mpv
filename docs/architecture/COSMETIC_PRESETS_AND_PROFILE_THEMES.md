# KMD-030 — Presets cosmétiques et thèmes de profil synchronisés

## Objectif

KMD-030 permet à un compte de regrouper plusieurs objets cosmétiques déjà possédés dans un preset nommé, de le prévisualiser puis de l’activer de façon atomique sur tous les clients KnowMe.

Un preset reste strictement visuel. Il ne contient aucun prix, avantage de jeu, priorité sociale, statut Premium ou donnée cachée sur la provenance des objets.

## Source autoritaire

Les presets, leurs éléments, l’état par défaut et l’état actif sont stockés côté serveur :

- `CosmeticPreset` porte le nom normalisé et appartient à un seul compte ;
- `CosmeticPresetItem` associe au maximum un objet à chaque slot ;
- `CosmeticPresetState` conserve le preset par défaut, le preset actif et une version monotone d’activation ;
- `CosmeticPresetActivation` journalise chaque activation avec une clé d’idempotence unique et un snapshot minimal de l’équipement appliqué.

Le client ne peut jamais déclarer qu’un objet est possédé, disponible ou compatible avec un slot.

## Création et mise à jour

Avant toute écriture, le serveur vérifie pour chaque élément :

1. que le slot appartient au catalogue autorisé ;
2. que l’objet existe ;
3. que le compte en possède une attribution non révoquée ;
4. que le slot de l’objet correspond au slot demandé ;
5. que l’objet est actif et dans sa fenêtre de disponibilité.

Les noms sont normalisés et uniques par compte. Le preset par défaut est géré par l’état serveur, sans duplication de drapeaux concurrents.

## Prévisualisation

La prévisualisation est calculée depuis le preset nettoyé et les préférences de confidentialité actuelles. Elle indique pour chaque slot s’il est applicable. Un slot masqué est signalé `HIDDEN_SLOT` et ne sera jamais équipé lors de l’activation.

Les objets révoqués, retirés du catalogue, expirés ou devenus incompatibles sont automatiquement supprimés du preset et cette maintenance est auditée.

## Activation atomique et idempotente

`POST /cosmetics/presets/:id/activate` exige une clé d’idempotence.

Dans une transaction unique, le serveur :

1. recharge le preset appartenant au compte ;
2. recalcule possessions, disponibilité, compatibilité et slots masqués ;
3. retire les éléments invalides du preset ;
4. remplace l’équipement complet par les seuls éléments applicables ;
5. incrémente la version d’activation ;
6. enregistre un reçu d’activation et son snapshot minimal.

La répétition de la même clé retourne le reçu existant sans deuxième mutation. Une même clé utilisée pour un autre compte ou un autre preset est refusée.

## Cohérence de l’état actif

`activePresetId` décrit un équipement effectivement appliqué, pas seulement le dernier preset choisi. Une modification manuelle d’un slot ou la révocation d’un objet actuellement équipé remet donc atomiquement `activePresetId` à `null`.

Le preset par défaut reste inchangé. Une activation ultérieure du même preset crée un nouveau reçu, augmente `activationVersion` et restaure l’état actif. Cette règle empêche les clients Web et Mobile d’afficher un thème comme actif alors que l’équipement réel a divergé.

## Confidentialité et rendu public

L’activation ne modifie aucune préférence de visibilité. Le rendu public continue d’être calculé par KMD-029 : visibilité du profil comme limite supérieure, slots masqués omis et fallback sûr pour les assets indisponibles.

L’historique d’activation reste privé et n’est jamais inclus dans le snapshot public du profil.

## Synchronisation Web et Mobile

La page Web `/cosmetics/presets` et le client Mobile utilisent les mêmes routes :

- lister les presets et l’état synchronisé ;
- créer ou modifier un preset ;
- prévisualiser ;
- définir le preset par défaut ;
- activer avec idempotence ;
- supprimer.

La `activationVersion` permet aux clients de détecter un changement d’équipement effectué depuis un autre appareil.

## Export, suppression et audit

L’export de compte inclut presets, état et activations. La suppression du compte efface l’état, les activations et les presets dans la même transaction que le reste des données cosmétiques.

Les créations, modifications, choix par défaut, activations, suppressions, invalidations de l’état actif et nettoyages automatiques produisent des événements d’audit dédiés.

## Invariants

- uniquement des objets possédés et disponibles ;
- un seul objet par slot ;
- activation multi-slot atomique ;
- activation idempotente ;
- état actif invalidé dès que l’équipement réel diverge ;
- preset par défaut conservé indépendamment de l’état actif ;
- aucun contournement des slots masqués ;
- aucun effet de jeu ou privilège social ;
- aucun prix ni provenance exposés publiquement ;
- nettoyage automatique des objets révoqués ou indisponibles ;
- cycle export/suppression complet.

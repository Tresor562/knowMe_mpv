# KMD-127 — Parité d’apparence du hub Mobile d’organisation

## Objectif

Aligner le hub Mobile d’organisation privée des conversations sur la palette d’apparence autoritaire déjà fournie par `AppearanceProvider`, au lieu de conserver des couleurs sombres codées en dur qui rendaient cette surface incohérente avec les thèmes clair, sombre, à contraste élevé et personnalisés.

## Dépendances fusionnées

- système Mobile `AppearanceProvider` et `MobileThemePalette` ;
- KMD-124 — hub Mobile d’organisation privée ;
- KMD-125 — messages enregistrés ;
- KMD-126 — brouillons synchronisés.

## Livrables

- utilisation de `useAppearance()` dans `MessagesOrganizationExperience` ;
- fond, textes, bordures, cartes, accent, erreurs et indicateur de chargement dérivés de la palette effective ;
- suppression des couleurs de thème codées en dur dans cette surface ;
- conservation intégrale de la navigation, des appels API et des autorités métier existantes.

## Frontières d’autorité et de sécurité

- aucun endpoint, schéma, modèle, rôle ou permission n’est ajouté ou modifié ;
- aucun changement de persistance, membership, messagerie, brouillon, archive, épingle ou message enregistré ;
- aucun changement Nexus core/intégration, Premium, KnowCoins, appels, matériel, permission OS, juridique ou KMD-059 ;
- l’apparence effective continue d’être résolue par le provider existant, y compris ses fallbacks d’entitlement.

## Validation requise

1. CI monorepo standard verte sur le head final.
2. Build TypeScript/Expo de `@knowme/mobile` vert afin de valider l’usage de `MobileThemePalette` via `useAppearance`.
3. Suite unitaire complète verte, y compris les tests existants du système d’apparence.
4. Suite API E2E PostgreSQL verte afin de confirmer l’absence de régression d’autorité.
5. Vérifier dans le diff que les couleurs statiques du hub ont été retirées sans modifier les appels `/conversations` ni les sous-surfaces d’organisation.

## Migration

Aucune migration de base de données et aucun changement de données persistantes.

## Retour arrière

Restaurer les styles statiques de `apps/mobile/src/MessagesOrganizationExperience.tsx` et supprimer ce document. Aucun rollback de données, de schéma ou d’API n’est requis.

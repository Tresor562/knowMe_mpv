# KMD-049 — Fondation d’internationalisation et erreurs localisables

## Statut

Livraison en validation. La fusion est interdite tant que génération Prisma, synchronisation PostgreSQL, builds, tests unitaires et E2E ne sont pas entièrement verts.

## Objectif

Créer une source de vérité commune français/anglais pour Web, Mobile et API, synchroniser la préférence de langue sans écrasement multi-appareil et localiser les erreurs clients à partir des codes stables introduits par KMD-002.

## Blocs livrés

1. package partagé `@knowme/i18n-contract` ;
2. catalogue français canonique ;
3. catalogue anglais typé ;
4. locale de secours française ;
5. normalisation des balises régionales ;
6. parsing pondéré de `Accept-Language` ;
7. interpolation nommée ;
8. pluriels via `Intl.PluralRules` ;
9. formats de nombres, dates et temps relatifs ;
10. direction de texte prête pour le RTL ;
11. dictionnaire client des codes d’erreur stables ;
12. conservation des références support ;
13. schéma Prisma de préférence de langue ;
14. version optimiste multi-appareil ;
15. transaction sérialisable et gestion des conflits ;
16. audit des choix explicites ;
17. catalogue API public ;
18. endpoints authentifiés de lecture et mise à jour ;
19. export de compte version 10 conditionnel ;
20. suppression transactionnelle de la préférence ;
21. bootstrap Web avant hydratation ;
22. store Web externe et navigation globale localisée ;
23. erreurs Web localisées par code ;
24. réglage Web synchronisé ;
25. cache et provider Mobile racine ;
26. erreurs Mobile localisées par code ;
27. réglage Mobile natif dans le profil ;
28. tests de fallback, pluriels, formats et erreurs ;
29. E2E de détection, synchronisation, conflit, export et suppression ;
30. documentation d’architecture et règles d’extension.

## Garanties

- aucune traduction automatique du contenu utilisateur ;
- aucune langue non prise en charge enregistrée ;
- aucun écrasement silencieux entre appareils ;
- aucun changement implicite de fuseau horaire, devise ou règle de notification ;
- aucun détail interne ajouté aux erreurs ;
- `requestId` conservé pour le support ;
- une préférence seulement détectée ne crée aucune donnée persistante ;
- les exports historiques restent aux versions 6 à 9 tant qu’aucune langue n’est choisie ;
- aucune préférence de langue ne survit à la suppression du compte.

## Hors périmètre

- traduction automatique des publications et messages ;
- publication d’une locale RTL sans audit visuel ;
- traduction exhaustive immédiate de chaque écran historique ;
- gestion de contenu marketing distante ;
- modification des codes d’erreur API existants ;
- changement automatique de pays, devise ou fuseau.

## Validation obligatoire

- build du package partagé ;
- génération Prisma ;
- synchronisation PostgreSQL ;
- build NestJS ;
- build Next.js ;
- vérification TypeScript Expo ;
- tests unitaires existants et KMD-049 ;
- E2E KMD-049 ;
- toutes les suites E2E historiques ;
- vérification de la compatibilité des exports 6 à 9.

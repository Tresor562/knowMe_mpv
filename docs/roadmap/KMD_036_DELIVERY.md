# KMD-036 — Protocole de stickers signés et bibliothèque d’origine

## État

Livraison en validation sur la pull request associée à la branche `feat/kmd-036-sticker-marketplace`.

## Dépendances fusionnées

- KMD-015 — anti-spam persistant et modération ;
- KMD-029 — rendu public contrôlé ;
- KMD-034 — objets sociaux visuels ;
- KMD-035 — rendu composable et contrats de confidentialité.

## Périmètre réservé

KMD-036 couvre uniquement :

- le catalogue gratuit et versionné ;
- la signature HMAC des tokens de stickers ;
- la liaison à une conversation ;
- la résolution sûre ;
- l’envoi Web ;
- la lecture Web sticker-aware ;
- le client Mobile réutilisable.

La marketplace payante, la possession et les cadeaux de packs ne font pas partie de KMD-036.

## Barrières avant fusion

- build monorepo vert ;
- vérification qu’aucun secret n’entre dans les bundles clients ;
- validation des tokens falsifiés et inter-conversations ;
- absence de régression sur les messages texte ;
- documentation de la stabilité du secret et de la future rotation multi-clé.

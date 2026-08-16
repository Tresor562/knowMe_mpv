# KMD-061 — Registre autoritaire de liens courts

## État

En validation. Cette livraison doit être fusionnée uniquement après CI verte sur son head final.

## Dépendance canonique

KMD-060 / PR #109 est fusionné et fournit le contrat versionné `@knowme/link-contract`. KMD-061 consomme ce contrat ; il ne le duplique pas.

## Livré

- persistance Prisma des liens et receipts idempotents ;
- code public base64url de 16 caractères issu de 12 octets aléatoires ;
- création authentifiée et contrôlée par `short_links.creation` ;
- expiration bornée ;
- révocation idempotente ;
- endpoint d’aperçu anti-phishing sans identifiant de cible ;
- endpoint de résolution vers `/open/v1/...` et `knowme://v1/...` uniquement ;
- réautorisation serveur de la destination à chaque aperçu/résolution ;
- codes inconnus, expirés, révoqués et liens devenus non autorisés indistinguables publiquement ;
- compteurs de résolution agrégés sans IP brute ;
- export compte au format 19 lorsqu’un lien existe ;
- suppression transactionnelle des liens et receipts lors de la suppression du compte ;
- page Web `/s/:code` qui exige une action explicite avant continuation ;
- tests de domaine et E2E du cycle complet.

## Autorisation des cibles

- `profile` : compte existant, identifiant normalisé vers le username canonique ;
- `challenge` : créateur, défi public actif ou participant ;
- `community` : propriétaire, cercle public actif ou membre actif ;
- `gift` : notification de cadeau appartenant au destinataire ;
- `event` et `sticker-pack` : fermés par défaut dans cette livraison tant que leur modèle d’accès canonique n’est pas raccordé.

## Confidentialité

L’aperçu public ne révèle ni propriétaire, ni ID interne de destination. La résolution ne renvoie que le code, le type et les chemins KMD-060 nécessaires à la continuation. Le sous-système n’enregistre aucune IP brute pour ses analytics.

## Validation requise

- `pnpm --filter @knowme/api prisma:generate` ;
- `pnpm --filter @knowme/api prisma:push` ;
- `pnpm build` ;
- `pnpm test` ;
- `pnpm --filter @knowme/api test:e2e` ;
- PR mergeable sur le head final.

## Retour arrière

Désactiver `short_links.creation`. KMD-060 reste fonctionnel indépendamment du registre. Les liens persistés peuvent rester résolvables pendant une migration contrôlée ou être révoqués.

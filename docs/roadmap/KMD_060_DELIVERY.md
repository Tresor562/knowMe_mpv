# KMD-060 — Contrat de navigation profonde et liens partageables

## Objectif

Créer une frontière commune Web/Mobile pour ouvrir des cibles KnowMe explicites sans accepter de route arbitraire fournie par un client ou un lien externe.

KMD-060 est indépendant de KMD-059. Il peut donc être développé depuis `main` pendant que la validation matérielle réelle des appels reste en attente.

## Livrables

- package partagé `@knowme/link-contract` ;
- schéma versionné `knowme://v1/<kind>/<id>` ;
- chemin universel versionné `/open/v1/<kind>/<id>` ;
- allowlist de catégories partageables : profil, défi, communauté, événement, cadeau et pack de stickers ;
- validation stricte des identifiants ;
- rejet des query strings, fragments, credentials et chemins malformés dans le schéma applicatif ;
- route Web d’entrée qui ne redirige que vers des destinations Web existantes et vérifiées ;
- parseur Mobile partagé, sans interprétation de route arbitraire ;
- tests de construction, parsing et tentatives de traversal/smuggling.

## Frontières de sécurité

- aucun lien ne peut ouvrir une route d’administration ;
- aucun `next`, URL externe ou chemin libre n’est accepté comme destination ;
- l’identifiant est une donnée opaque et ne peut contenir que lettres ASCII, chiffres, `_` et `-` ;
- une catégorie reconnue mais non encore disponible sur le Web reçoit un fallback sûr au lieu d’une route inventée ;
- le contrat ne remplace jamais les contrôles d’autorisation de la destination finale.

## Hors périmètre volontaire

KMD-060 ne prétend pas livrer le futur service de liens courts `knowme.app/<code>` complet. Les éléments suivants nécessitent un registre serveur autoritaire et seront livrés séparément :

- codes courts non séquentiels persistés ;
- expiration ;
- révocation ;
- preview serveur anti-phishing ;
- analytics respectueux de la vie privée ;
- fichiers Apple Universal Links / Android App Links liés à un domaine de production confirmé.

Aucun domaine n’est donc codé en dur à partir du simple exemple `knowme.app` de la spécification produit.

## Retour arrière

Le package et la route `/open/v1/...` peuvent être retirés sans migration de données, car KMD-060 n’ajoute aucun état persistant. Le schéma mobile `knowme://` existait déjà dans la configuration Expo ; cette livraison formalise son contrat sans modifier les secrets, sessions ou permissions.

## Validation attendue

- build du monorepo vert ;
- tests `@knowme/link-contract` verts ;
- build TypeScript Mobile vert avec le package partagé ;
- build Next.js Web vert avec la route d’entrée ;
- aucune régression API/E2E existante.

## Suite recommandée

KMD-061 pourra ajouter le registre serveur de liens courts, l’expiration et la révocation, sans élargir le contrat de destination défini ici.

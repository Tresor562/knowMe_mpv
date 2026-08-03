# KMD-036 — Protocole de stickers signés et bibliothèque d’origine

## État

Livraison reconstruite proprement depuis `main`. L’ancienne branche de démonstration ne doit pas être fusionnée.

## Livré

### Catalogue fermé

- deux packs originaux et gratuits ;
- douze stickers Unicode bornés ;
- clés et versions immuables ;
- libellés et textes d’accessibilité ;
- invariants de catalogue testés ;
- aucune URL, donnée SVG, balise HTML ou source distante.

### Signature autoritaire

- format `KNOWME_STICKER_V1` ;
- HMAC SHA-256 ;
- clé active dédiée ;
- anciennes clés de lecture pour rotation ;
- comparaison en temps constant ;
- expiration bornée ;
- liaison stricte à la conversation ;
- liaison aux versions du pack et du sticker ;
- échec fermé en production lorsqu’aucune clé dédiée n’est configurée.

### Messagerie

- émission uniquement par l’API NestJS ;
- authentification obligatoire ;
- appartenance à la conversation contrôlée avant signature ;
- même politique anti-spam que les messages texte ;
- même transaction de persistance ;
- mêmes notifications et événements temps réel ;
- aperçu de notification neutre ;
- contenu invalide ou falsifié conservé comme texte opaque ;
- aucune interprétation HTML.

### Web

- bibliothèque intégrée à la page de conversation ;
- chargement depuis le catalogue authentifié ;
- envoi par endpoint dédié ;
- rendu structuré dans l’historique et en temps réel ;
- aperçu dans la liste des conversations ;
- libellés accessibles.

### Mobile

- client API authentifié ;
- types de présentation structurés ;
- composant natif réutilisable `StickerLibraryExperience` ;
- aucun pont Web ni secret embarqué ;
- aucun asset arbitraire accepté.

### Validation

- tests unitaires du catalogue, de la signature, de l’expiration, de la falsification, de la liaison conversationnelle et de la rotation ;
- E2E du catalogue authentifié, de l’appartenance, de l’envoi, de l’historique, des notifications, de la conversation croisée et de la non-régression texte ;
- configuration `.env.example` ;
- procédure de rotation dans le guide de déploiement ;
- documentation d’architecture complète.

## Garanties

- aucun prix ou statut envoyé par le client ;
- aucun inventaire parallèle ;
- aucun rôle, badge, entitlement ou avantage de jeu ;
- aucun pack payant ;
- aucun transfert ou revente ;
- aucun upload utilisateur ;
- aucun secret de signature exposé au Web ou au Mobile.

## Limites assumées

Le composant Mobile est livré comme surface native réutilisable. Son insertion dans chaque variante future de l’interface Messenger sera réalisée avec les prochaines évolutions du shell Mobile, afin de ne pas modifier précipitamment le grand composant historique.

Les packs créateurs, la marketplace, les stickers animés distants et les possessions sont hors périmètre.

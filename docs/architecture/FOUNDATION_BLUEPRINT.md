# KnowMe — Foundation Blueprint

## Architecture cible pour les fonctionnalités long terme

Ce document décrit les fondations à préparer avant Premium, boutique, jeux à mises, cadeaux, avatars avancés et Concept K complet. Il ne remplace pas les spécifications métier détaillées ; il fixe les frontières entre systèmes.

---

## 1. Principes d’architecture

### 1.1 Monolithe modulaire avant microservices

KnowMe conserve un monolithe NestJS modulaire tant que la charge et l’équipe ne justifient pas une séparation opérationnelle. Chaque domaine doit néanmoins posséder :

- ses contrôleurs ;
- ses services ;
- ses DTO ;
- ses règles d’autorisation ;
- ses événements métier ;
- ses tests ;
- une frontière claire de données.

Les domaines peuvent ensuite être extraits sans réécrire les règles métier.

### 1.2 Source de vérité unique par domaine

- identité et rôles : Identity & Access ;
- abonnement et droits : Billing & Entitlements ;
- solde KnowCoins : Wallet Ledger ;
- objets disponibles : Catalog ;
- possessions : Inventory ;
- animations : Experience Engine ;
- fichiers : Media ;
- textes traduits : Localization ;
- activation progressive : Feature Flags.

Aucun autre module ne doit maintenir une copie concurrente de ces vérités.

### 1.3 Événements métier après transaction

Les actions importantes émettent un événement après validation de la transaction :

- `friendship.accepted` ;
- `challenge.completed` ;
- `message.created` ;
- `reward.granted` ;
- `purchase.completed` ;
- `badge.unlocked`.

Les consommateurs produisent ensuite notifications, animations, analytics, quêtes ou recommandations. Un événement possède un identifiant unique et les consommateurs sont idempotents.

---

## 2. Domaines cibles

### 2.1 Identity & Access

Responsabilités :

- utilisateurs ;
- comptes staff ;
- rôles ;
- permissions ;
- vérifications ;
- sessions ;
- 2FA ;
- appareils ;
- audit de sécurité.

Tables cibles indicatives :

```text
StaffAccount
Role
Permission
RolePermission
UserRole
VerificationRequest
VerificationReview
SecurityEvent
TrustedDevice
```

Une permission est toujours vérifiée côté serveur. Les rôles système et communautaires utilisent le même vocabulaire, avec une portée différente.

### 2.2 Billing & Entitlements

Responsabilités :

- plans ;
- prix ;
- abonnements ;
- essais ;
- factures ;
- webhooks ;
- droits actifs ;
- remboursement et état de grâce.

Tables cibles :

```text
BillingProduct
BillingPrice
Subscription
SubscriptionEvent
Invoice
PaymentTransaction
EntitlementDefinition
UserEntitlement
```

Le prestataire externe reste la source de vérité du paiement, mais KnowMe conserve un historique local vérifiable.

### 2.3 Wallet Ledger

Responsabilités :

- écritures KnowCoins ;
- solde projeté ;
- réservations ;
- compensations ;
- commissions ;
- prévention des doubles crédits.

Tables cibles :

```text
Wallet
WalletEntry
WalletReservation
WalletTransfer
```

Règles :

- aucune modification directe du solde ;
- référence métier unique ;
- écriture compensatrice plutôt que suppression ;
- transaction de base de données pour débit et crédit ;
- audit complet.

### 2.4 Catalog & Inventory

Responsabilités :

- objets numériques ;
- variantes ;
- raretés ;
- collections ;
- disponibilité ;
- propriété ;
- location temporaire ;
- activation cosmétique.

Tables cibles :

```text
CatalogItem
CatalogVariant
CatalogAsset
CatalogCollection
CatalogCollectionItem
CatalogOffer
InventoryItem
EquippedItem
GiftTransfer
```

Types d’objets possibles : thème, icône, avatar, vêtement, cadre, aura, emoji, sticker, cadeau, personnage Concept K, son et effet.

### 2.5 Challenge Engine

Responsabilités :

- définition publique ;
- versions ;
- questions ;
- règles ;
- sessions ;
- réponses ;
- score ;
- résultats ;
- historique.

Tables cibles :

```text
Challenge
ChallengeVersion
ChallengeQuestionVersion
ChallengeSession
ChallengeSessionParticipant
ChallengeSessionAnswer
ChallengeResult
```

Une version publiée devient immuable. Une modification crée une nouvelle version.

### 2.6 Game Platform

Responsabilités :

- catalogue de jeux ;
- règles serveur ;
- parties ;
- tours ;
- matchmaking ;
- tournois ;
- classements ;
- replays ;
- anti-triche.

Interfaces communes :

```ts
interface GameAdapter<State, Action> {
  createInitialState(input: unknown): State;
  validateAction(state: State, action: Action, actorId: string): void;
  applyAction(state: State, action: Action): State;
  getOutcome(state: State): GameOutcome | null;
}
```

Le client ne décide jamais seul du résultat.

### 2.7 Experience Engine — Concept K

Responsabilités :

- registre des événements visuels ;
- sélection du personnage ;
- variantes selon rareté et thème ;
- préférences d’animations ;
- fallback statique ;
- chargement à la demande ;
- limites de fréquence.

Contrat client cible :

```ts
Experience.play('friend_request_accepted', {
  intensity: 'standard',
  context: { friendshipId }
});
```

Les clients Web et Mobile implémentent le même catalogue d’événements avec des rendus adaptés.

### 2.8 Media

Responsabilités :

- upload ;
- validation MIME réelle ;
- antivirus ;
- transcodage ;
- miniatures ;
- stockage ;
- URLs signées ;
- rétention ;
- suppression ;
- quotas.

Interface cible :

```ts
interface MediaStorage {
  put(input: MediaUpload): Promise<StoredMedia>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
}
```

Le stockage local reste réservé au développement.

### 2.9 Localization

Responsabilités :

- langue utilisateur ;
- catalogues de chaînes ;
- traductions de contenu ;
- détection ;
- RTL ;
- formats locaux ;
- cache de traduction.

Les clés d’interface ne contiennent jamais de texte métier variable. Les erreurs API utilisent des codes stables et les clients traduisent les messages publics.

### 2.10 Feature Flags

Responsabilités :

- activation globale ;
- activation par plateforme ;
- pourcentage de déploiement ;
- cohortes ;
- pays ;
- versions minimales ;
- arrêt d’urgence.

Tables cibles :

```text
FeatureFlag
FeatureFlagRule
FeatureFlagOverride
```

Les fonctionnalités sensibles comme paiements, vérification, IA, jeux à mises et marketplace restent désactivables sans déploiement.

---

## 3. Contrats transversaux

### 3.1 Identifiants et idempotence

Toute commande économique ou asynchrone accepte une clé d’idempotence. Le serveur stocke le résultat associé et retourne le même résultat en cas de répétition valide.

### 3.2 Audit

Les actions suivantes sont auditées :

- changement de rôle ;
- ajout ou révocation d’un staff ;
- examen de vérification ;
- sanction ;
- remboursement ;
- compensation KnowCoins ;
- modification du catalogue ;
- activation d’un feature flag sensible.

### 3.3 Notifications

Une notification contient :

- type stable ;
- destinataire ;
- titre et corps localisables ;
- données structurées ;
- route ;
- acteur ;
- entité ;
- dates de lecture et d’expiration éventuelle.

### 3.4 Erreurs

Format cible :

```json
{
  "code": "CHALLENGE_VERSION_LOCKED",
  "message": "Cette version du défi est déjà publiée.",
  "details": {},
  "requestId": "req_..."
}
```

Le code est stable. Le message peut être traduit.

---

## 4. Sécurité

### 4.1 Défense en profondeur

- validation DTO ;
- contrôles d’autorisation ;
- limitation de débit ;
- sessions révocables ;
- rotation des secrets ;
- CSP et protections Web ;
- analyse des médias ;
- chiffrement en transit et au repos ;
- journalisation sans secrets.

### 4.2 Économie et paiements

- montants en unités mineures ;
- devises ISO ;
- webhooks signés ;
- ordre non garanti des événements ;
- déduplication ;
- rapprochement périodique ;
- aucune donnée de carte complète stockée.

### 4.3 Jeux

- horodatage serveur ;
- état autoritaire serveur ;
- limites par action ;
- détection d’anomalies ;
- replays ;
- preuves de résultat ;
- appels de sanction séparés du moteur de jeu.

---

## 5. Observabilité

Chaque requête et événement important transporte un `requestId` ou `correlationId`.

Mesures minimales :

- taux d’erreur ;
- latence ;
- connexions temps réel ;
- échecs de paiement ;
- divergences de solde ;
- taille des files ;
- échecs de média ;
- taux de crash mobile ;
- consommation mémoire ;
- temps de rendu des animations.

Les données analytics produit sont séparées des journaux techniques et respectent les préférences utilisateur.

---

## 6. Stratégie de migration

Chaque nouveau système suit l’ordre :

1. modèle et contraintes ;
2. service interne ;
3. migration des anciennes données ;
4. lecture double temporaire si nécessaire ;
5. tests de cohérence ;
6. bascule par feature flag ;
7. suppression de l’ancien chemin après observation.

Exemple KnowCoins : introduire le ledger, créer une écriture d’ouverture correspondant au solde actuel, vérifier l’égalité, puis interdire les modifications directes.

---

## 7. Ordre recommandé d’implémentation

1. feature flags et audit renforcé ;
2. staff, rôles et permissions ;
3. entitlements indépendants d’un prestataire ;
4. wallet ledger ;
5. challenge versioning ;
6. localisation ;
7. media abstraction ;
8. catalogue et inventory ;
9. Concept K minimal ;
10. paiement réel ;
11. gamification ;
12. communautés et créateurs ;
13. jeux et Arena.

Chaque étape doit disposer d’un test E2E de sécurité et d’une stratégie de migration avant fusion.
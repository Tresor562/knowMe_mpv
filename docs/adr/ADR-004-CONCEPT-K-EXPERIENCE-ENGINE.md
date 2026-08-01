# ADR-004 — Concept K et moteur d’expérience

- **Statut :** Accepté pour architecture future
- **Date :** 2026-08-01

## Contexte

KnowMe veut transformer les actions importantes en expériences visuelles vivantes. Si chaque écran implémente ses propres animations, les performances, l’accessibilité et l’identité visuelle deviendront incohérentes.

## Décision

1. Le Web et le Mobile utilisent un `AnimationManager` ou `ExperienceEngine` commun au niveau du contrat.
2. Les écrans demandent un événement sémantique, pas un asset précis.
3. Le moteur choisit la variante selon plateforme, thème, personnage, rareté, performance et préférence utilisateur.
4. Chaque animation possède un fallback statique.
5. Les modes automatique, réduit et désactivé sont obligatoires.
6. Toute séquence est ignorable et ne bloque pas une action critique.
7. Les assets sont chargés à la demande et versionnés.
8. Les personnages sont originaux et passent par le catalogue numérique.

## Contrat indicatif

```ts
type ExperienceEvent =
  | 'account_created'
  | 'login_success'
  | 'friend_request_accepted'
  | 'challenge_created'
  | 'answer_correct'
  | 'answer_incorrect'
  | 'challenge_completed'
  | 'message_deleted'
  | 'level_up'
  | 'knowcoins_received'
  | 'purchase_completed';

interface ExperienceEngine {
  play(event: ExperienceEvent, context?: Record<string, unknown>): Promise<void>;
  stop(): void;
}
```

## Budget de performance

Chaque animation définit :

- taille maximale ;
- durée maximale ;
- nombre de particules ;
- possibilité de son et vibration ;
- appareils ciblés ;
- fallback réduit.

Les effets ne doivent pas retarder la réponse serveur ni empêcher la navigation.

## Conséquences

- identité cohérente ;
- accessibilité centralisée ;
- remplacement simple d’un rendu ;
- travail initial de création du registre et des assets.

## Mesures

- commencer avec quelques événements clés ;
- instrumenter temps de chargement et images par seconde ;
- tester les appareils d’entrée de gamme ;
- limiter la fréquence des animations répétitives ;
- désactiver automatiquement les variantes lourdes en mode économie d’énergie.
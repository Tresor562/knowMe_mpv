# KnowMe Motion — animation et emojis personnalisés

## Implémentation V1 (2026-10-11)

- **28 emojis Unicode** bénéficient d'une animation de courte durée, relançable au toucher.
- **KnowMe Motion** est un pack de **six créations originales**. Les identifiants `packKey`/`stickerKey` circulent via le système de **stickers signés** existant ; le serveur valide l'appartenance à la conversation avant envoi et ne fait confiance à aucun fichier externe transmis par le client.
- **Web** : graphiques SVG internes, animations CSS interrompues en mode `prefers-reduced-motion`.
- **Android** : rendu natif sans dépendance téléchargée, animations `Animated` avec `useNativeDriver`, suivi du réglage d'accessibilité système.
- **Dégradation sûre** : glyphes Unicode conservés dans le catalogue, noms accessibles, les messages texte existants ne changent pas.
- **Limitations** : les stickers KnowMe Motion sont des contenus de message à part entière ; l'insertion d'emojis dessinés *au milieu d'une phrase* nécessitera une présentation versionnée spécifique avec ses propres règles serveur. Les effets sont locaux ; aucune animation à deux participants n'est encore synchronisée par WebSocket. Les favoris/récents du clavier sont pour l'instant des états de session.

## Identifiants invariants

Pack : `knowme-motion` (version 1) :

| Identifiant | Fallback |
| --- | --- |
| `pulse-heart` | 💗 |
| `prism-star` | 🌟 |
| `orbit-spark` | ✨ |
| `galaxy-smile` | 😊 |
| `neon-flame` | 🔥 |
| `comet-rocket` | 🚀 |

La source de vérité des identifiants est `packages/animation-contract/src/custom-emoji.ts`; le serveur publie les entrées via `/stickers/catalog`.

## Import éventuel depuis Telegram / NexAI

Il est techniquement possible de retrouver un document emoji Telegram par son identifiant via l'API Telegram. **L'accès à un document n'autorise pas automatiquement sa réutilisation**. Les emojis premium et ceux de créateurs tiers ne sont pas transférables dans le catalogue KnowMe sans une licence explicite.

Un import ultérieur doit :

1. Être demandé explicitement par le titulaire du compte, sans parcourir les sessions NexAI d'autres utilisateurs ni aspirer leurs conversations.
2. Recevoir un pack précis et une **preuve de propriété ou de licence autorisant redistribution et modification** (ou une licence libre compatible).
3. Ne jamais exporter les jetons d'authentification Telegram, les identités d'autres utilisateurs, des messages privés ou des fichiers sans rapport avec le pack.
4. Téléverser les fichiers dans un stockage de quarantaine isolé, appliquer des limites de quantité/poids/frames et vérifier format, durée, intégrité, liens externes, contenu actif ou exécutable et sécurité.
5. Convertir les formats autorisés (TGS/Lottie ou WebM) dans une chaîne de traitement isolée et signée, générer miniatures, manifeste versionné, licence et crédits.
6. Soumettre le pack au catalogue serveur après validation manuelle des droits et des visuels. **Ne jamais appeler des créations de tiers « originales KnowMe ».**
7. Prévoir consentement révocable, suppression, journal d'audit et repli statique.

Cette V1 **n'implémente pas l'export Telegram**, ne lit aucune session NexAI et ne récupère aucun média tiers. Elle fournit un catalogue original sans dépendance Telegram.

## Contrôles de livraison

Vérifier les builds de `@knowme/animation-contract`, `@knowme/api`, `@knowme/web` et `@knowme/mobile`, les tests de stickers signés, l'accès membre/non-membre, les modes Android « réduire les animations », l'affichage hors ligne, les erreurs d'envoi et le flux de mise à jour d'APK.

La compilation d'un APK ne prouve pas à elle seule la fidélité visuelle : une revue sur appareil est requise avant annonce de disponibilité générale.

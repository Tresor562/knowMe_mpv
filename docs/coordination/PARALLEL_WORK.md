# KnowMe — coordination de plusieurs conversations et agents

**Repo canonique :** `Tresor562/knowMe_mpv` — **intégration :** `main`.

## Source de vérité (à ouvrir au début de chaque conversation)

1. Lire `/AGENTS.md`, `docs/NEXUS_INTEGRATION_CHECKPOINT.md`, `docs/roadmap/CURRENT_DELIVERY_CHECKPOINT.md` et les spécifications maîtres applicables.
2. Lire `docs/coordination/workstreams.json` et l'issue d'ancrage de son domaine.
3. Vérifier en direct `main`, toutes les PR ouvertes, leurs fichiers modifiés, les checks et les branches encore en cours. Un titre de branche, une ancienne conversation ou une issue n'est pas une preuve de livraison.
4. Consulter la roadmap générale #645 et, pour toute fonctionnalité concernée, les issues existantes avant d'en créer une nouvelle.
5. Si la fonctionnalité appartient déjà à une PR existante, poursuivre cette PR ou coordonner son intégration, plutôt que recréer un changement divergent.

## Les sept espaces

| Domaine | Issue | Responsable du périmètre |
| --- | --- | --- |
| `messaging` | [#693](https://github.com/Tresor562/knowMe_mpv/issues/693) | Messagerie, groupes, appels, audios, stickers |
| `social` | [#694](https://github.com/Tresor562/knowMe_mpv/issues/694) | Publications, commentaires, réactions, mentions |
| `reels` | [#695](https://github.com/Tresor562/knowMe_mpv/issues/695) | Stories, Réels, lecture longue, hors connexion |
| `profiles` | [#696](https://github.com/Tresor562/knowMe_mpv/issues/696) | Profils, amis, comptes, badges, paramètres |
| `marketplace` | [#697](https://github.com/Tresor562/knowMe_mpv/issues/697) | Boutique, objets, cadeaux, achats et APK |
| `infra` | [#698](https://github.com/Tresor562/knowMe_mpv/issues/698) | API transverse, Prisma, CI, VPS, Vercel, OTA |
| `design` | [#699](https://github.com/Tresor562/knowMe_mpv/issues/699) | Design system, navigation, thèmes, accessibilité |

**Les domaines répartissent la responsabilité fonctionnelle, pas la propriété exclusive de dossiers.** Les changements touchant un contrat commun, une migration, un fichier de navigation ou le lecteur partagé exigent coordination avec les autres domaines affectés.

## Protocole obligatoire pour les nouvelles conversations

**Au démarrage :** annoncer le domaine choisi et l'issue associée; relire GitHub en direct (ne pas prétendre voir les conversations en temps réel); lister les autres PR et risques de chevauchement. Utiliser une issue existante ou créer une issue de tâche portant la ligne `Workstream: <domaine>`.

**Pour chaque unité de travail :** créer depuis le `main` le plus récent une branche `chat/<domaine>/<fonction-courte>` (ex. `chat/reels/offline-cache`). Ne jamais réutiliser une branche d'un autre domaine. Modifier uniquement les fichiers nécessaires; ne jamais réinitialiser ou remplacer la branche d'autrui.

**Pour chaque PR :** vers `main`, inclure deux lignes exactes dans le corps :

```text
Workstream: reels
Coordination-Issue: #695
```

L'issue peut être le point d'ancrage du domaine ou une issue plus précise avec `Workstream: reels`. Préciser portée, fichiers sensibles, dépendances sur les autres PR, tests Web/Android/API, migrations, risques, rollback, preuve de CI et de validation appareil.

**En cas de modification simultanée :** l'action `KnowMe coordination guard` compare les fichiers touchés par la PR aux autres PR ouvertes ciblant la même branche. Pour les branches `chat/...`, le chevauchement est bloquant. Ne pas contourner en renommant la branche, en fermant arbitrairement une PR ou en renommant un fichier. Répartir les modifications, intégrer/fermer proprement les PR contradictoires, puis relancer la validation. Des fichiers différents peuvent quand même porter un conflit sémantique : faire une revue des contrats, APIs, migrations et comportements partagés.

**Avant fusion :** relire la branche `main` courante et tous les checks, résoudre les threads, exécuter les tests adaptés et qualifier **le HEAD exact**. Les PR empilées doivent être fusionnées dans l'ordre de leurs dépendances et rebasées sur `main`. Aucune fusion forcée ni publication sur la simple foi d'un build.

**Après fusion :** renseigner l'issue liée avec le SHA réellement fusionné, les tests, et le statut distinct de chaque client; ne clore l'issue que lorsque les critères de la tâche sont atteints. Informer les conversations dépendantes via les issues et PR. Une conversation sans accès à son ancienne exécution retrouve l'état grâce à ces références.

## Niveaux de preuve, séparés

`demandé` → `en développement` → `PR ouverte` → `CI validée` → `fusionnée` → `déployée` → `vérifiée sur Web / Android / appareil réel`.

Ne pas présenter comme livrée une branche, une PR ou un artefact APK non publié. Ne pas lancer de déploiement de production depuis les branches `chat/*`.

## Sécurité et limites réelles

- **Ce système partage l'état publié sur GitHub, pas l'activité privée/inachevée d'une autre conversation.** Chaque agent doit enregistrer son progrès dans son issue ou sa PR.
- Le contrôle par fichiers détecte des collisions textuelles sur des PR ouvertes; il ne garantit pas l'absence de conflits fonctionnels, de migration ou d'incompatibilité runtime.
- L'action GitHub rend le contrôle obligatoire en CI pour les branches `chat/*`, mais **seule une protection de `main` avec checks requis empêche une fusion manuelle qui ignore les checks**. Activer dans les paramètres GitHub, si disponible : exiger PR, CI `quality`, `coordination`, branche à jour, refus du force-push et des suppressions. Vérifier l'état de ces réglages avant de dire qu'ils sont actifs.
- Les PR historiques hors `chat/*` sont inspectées comme conflits potentiels; le garde ne modifie ni ne bloque rétroactivement les anciennes branches sur la seule absence des nouvelles métadonnées.
- Les contrats généraux KnowMe/Telegram et les vérifications de sécurité existants priment. Ne pas transférer des secrets, tokens, identifiants ni clés dans les issues.

## Liens de suivi immédiat

- [PR ouvertes](https://github.com/Tresor562/knowMe_mpv/pulls)
- [Issues ouvertes](https://github.com/Tresor562/knowMe_mpv/issues)
- [Actions CI](https://github.com/Tresor562/knowMe_mpv/actions)
- [Roadmap #645](https://github.com/Tresor562/knowMe_mpv/issues/645)

**Attention :** certaines anciennes PR dépendent explicitement d'une branche autre que `main`. Respecter les liens de dépendance; la règle nouvelle s'applique aux travaux démarrés après cette installation, pas à une réécriture de l'historique.

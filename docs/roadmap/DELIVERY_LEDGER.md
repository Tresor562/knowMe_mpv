# KnowMe — Registre canonique des livraisons

## Objectif

Ce registre distingue les identifiants historiques du backlog des identifiants réels de livraison.

Les anciens documents ont utilisé plusieurs fois des labels comme `KM-013`, `KM-014` ou `KM-015` pour des périmètres différents. Ces labels restent conservés dans les anciennes PR et dans les documents historiques, mais ne doivent plus être utilisés pour nommer un nouveau chantier.

## Convention

- `KMB-###` : élément conceptuel du backlog historique (`IMPLEMENTATION_BACKLOG.md`).
- `KMD-###` : livraison effectivement développée, validée par CI et fusionnée.
- les titres historiques des PR restent inchangés afin de préserver la traçabilité Git.
- toute nouvelle PR majeure doit indiquer son identifiant `KMD-###`, sa phase produit et ses dépendances déjà fusionnées.

## Livraisons fusionnées

| Livraison | Domaine | Pull request | État |
| --- | --- | --- | --- |
| KMD-001 | Feature flags serveur | #21 | Fusionnée |
| KMD-002 | Request IDs, erreurs stables et audit | #24 | Fusionnée |
| KMD-003 | Comptes officiels Équipe KnowMe | #25 | Fusionnée |
| KMD-004 | RBAC et permissions granulaires | #26 | Fusionnée |
| KMD-005 | Identité de compte et entitlements | #23 | Fusionnée |
| KMD-006 | Registre comptable KnowCoins | #28 | Fusionnée |
| KMD-007 | Moteur de récompenses anti-abus | #30 | Fusionnée |
| KMD-008 | Défis versionnés et immuables | #32 | Fusionnée |
| KMD-009 | Facturation et Premium autoritaires | #34 | Fusionnée |
| KMD-010 | Vérification d’identité et badges séparés | #36 | Fusionnée |
| KMD-011 | Sécurité des comptes, 2FA et appareils fiables | #40 | Fusionnée |
| KMD-012 | Confidentialité, consentements et conservation | #45 | Fusionnée |
| KMD-013 | Intégrité applicative et validation des achats | #44 | Fusionnée |
| KMD-014 | Pipeline média privé et sécurisé | #46 | Fusionnée |
| KMD-015 | Anti-spam persistant et modération traçable | #47 | Fusionnée |
| KMD-016 | Feedback autoritaire et historique immuable des défis V2 | #49 | Fusionnée |
| KMD-017 | Registre XP et niveaux autoritaires | #50 | Fusionnée |
| KMD-018 | Séries d’activité saines | #51 | Fusionnée |
| KMD-019 | Quêtes quotidiennes autoritaires | #52 | Fusionnée |
| KMD-020 | Badges et titres autoritaires | #54 | Fusionnée |
| KMD-021 | Classement XP hebdomadaire limité et volontaire | #55 | Fusionnée |
| KMD-022 | Coffre quotidien déterministe | #56 | Fusionnée |
| KMD-023 | Positive Challenges autoritaires | #58 | Fusionnée |
| KMD-024 | Fondation d’animation Concept K | #59 | Fusionnée |
| KMD-025 | Catalogue d’assets originaux Concept K | #60 | Fusionnée |
| KMD-026 | Santé, quarantaine et fallback des assets Concept K | #61 | Fusionnée |
| KMD-027 | Catalogue cosmétique, inventaire autoritaire et équipement visuel | #63 | Fusionnée |
| KMD-028 | Boutique cosmétique KnowCoins et acquisitions idempotentes | #64 | Fusionnée |
| KMD-029 | Rendu public contrôlé des équipements cosmétiques | #65 | Fusionnée |
| KMD-030 | Presets cosmétiques et thèmes de profil synchronisés | #66 | Fusionnée |
| KMD-031 | Moteur de 100 thèmes et d’identité visuelle Web/Mobile | #67 | Fusionnée |
| KMD-032 | Orchestration de paiements Flutterwave, CinetPay, Google Play et Apple | #68 | Fusionnée |
| KMD-033 | Interfaces clientes de paiement Web et Mobile | #69 | Fusionnée |
| KMD-034 | Cadeaux sociaux visuels et KnowCoins atomiques | #70 | Fusionnée |
| KMD-035 | Studio d’avatar composable et rendu autoritaire | #71 | Fusionnée |
| KMD-036 | Stickers signés autoritaires | #87 | Fusionnée |
| KMD-037 | Avatar Universe et Gift Exchange | #73 | Fusionnée |
| KMD-038 | Messenger, communautés et KnowMe Secret | #74 | Fusionnée |
| KMD-039 | KnowMe Secret public, activable et partageable | #75 | Fusionnée |
| KMD-040 | Concept K Profils vivants et Profile Guard | #76 | Fusionnée |
| KMD-041 | Confidentialité KnowCoins et profils collectifs | #77 | Fusionnée |
| KMD-042 | Gouvernance, moments et famille KnowMe | #78 | Fusionnée |
| KMD-043 | Sélecteur de membres et notifications temps réel | #79 | Fusionnée |
| KMD-044 | Préférences et gouvernance humaine | #80 | Fusionnée |
| KMD-045 | Horaires silencieux, résumés et reprise fiable | #81 | Fusionnée |
| KMD-046 | Orchestration distribuée des notifications | #83 | Fusionnée |
| KMD-047 | Résilience et gouvernance des notifications | #86 | Fusionnée |
| KMD-048 | Centre de notifications intelligent | #88 | Fusionnée |
| KMD-049 | Internationalisation Web/Mobile et erreurs localisables | #90 | Fusionnée |
| KMD-050 | Politique de téléchargement et gouvernance du cache média | #91 | Fusionnée |
| KMD-051 | Fondation Créateurs et audience | #93 | Fusionnée |
| KMD-052 | Game Platform autoritaire | #94 | Fusionnée |
| KMD-053 | Miroir d’affinité explicable | #95 | Fusionnée |
| KMD-054 | Matchmaking social volontaire et non sensible | #96 | Fusionnée |

## Livraison en validation

| Livraison | Domaine | Pull request | État |
| --- | --- | --- | --- |
| KMD-055 | Connexion sociale post-acceptation | #98 | CI en validation |

## Prochaine livraison réservée

Aucun identifiant après `KMD-055` n’est réservé à ce stade.

Le prochain identifiant ne pourra être attribué qu’après la fusion de KMD-055 et la réconciliation du backlog restant avec les frontières juridiques, de sécurité et de produit. Le chantier Arena avec mises demeure explicitement bloqué tant que les règles d’âge, de territoire, de fraude, de litige et de conformité financière ne sont pas validées.

## Frontières permanentes

Les rôles et badges Équipe KnowMe restent régis par RBAC et les comptes officiels. Aucun achat, cadeau, avatar, sticker, thème, notification, traduction, statut créateur, jeu, matchmaking ou webhook de paiement ne peut attribuer un rôle de staff, un badge Équipe KnowMe ou une permission administrative.

Le statut créateur reste distinct de Premium, de la vérification d’identité et du rôle staff. Les compteurs d’audience ne peuvent pas modifier les permissions, la visibilité privée ou les décisions de modération.

La Game Platform ne peut accepter du client ni score, ni gagnant, ni état final, ni mise. Les jeux ne peuvent pas modifier un solde, une permission ou un entitlement sans passer par un système autoritaire distinct explicitement livré.

Le Miroir d’affinité ne peut produire ni diagnostic, ni prédiction, ni recommandation relationnelle, ni classement public. Les réponses détaillées exigent le consentement mutuel et doivent être expurgées lors d’une suppression de compte.

Le matchmaking social ne peut utiliser ni réponse d’affinité, ni conversation privée, ni localisation précise, ni donnée sensible, ni score économique. Toute priorité payante et tout boost acheté sont interdits. Une mise en contact exige une acceptation mutuelle persistée.

L’acceptation mutuelle d’un match ne crée jamais automatiquement une amitié ou une conversation. Chaque participant doit enregistrer une intention KMD-055 distincte et privée. Seule l’intersection mutuelle active peut créer ou réutiliser un objet social, et le choix détaillé du partenaire ne doit jamais être exposé.

Les transports de notifications externes restent régis par KMD-046 et KMD-047. KMD-048 n’ajoute aucun second registre de jetons ou de fournisseurs.

Les anciens prototypes ou PR dupliquées ne réservent pas un nouvel identifiant canonique. Les remplacements doivent conserver un lien explicite vers la PR fusionnée correspondante.

## Règles de mise à jour

Après chaque fusion majeure :

1. ajouter la livraison au tableau des livraisons fusionnées ;
2. enregistrer la PR et le domaine exact ;
3. réserver le prochain identifiant seulement après validation du périmètre ;
4. ne jamais réutiliser un identifiant `KMD` ;
5. conserver les anciens labels comme alias historiques, sans les présenter comme identifiants canoniques.

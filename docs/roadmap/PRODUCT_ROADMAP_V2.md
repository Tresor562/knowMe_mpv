# KnowMe Product Roadmap V2

## Objectif

Cette roadmap ordonne la vision long terme sans transformer le MVP en chantier infini. Chaque phase produit une version utilisable, testable et mesurable.

---

## État de départ

La base actuelle comprend déjà les fondations suivantes :

- authentification et sessions renouvelables ;
- profils ;
- amis ;
- messagerie ;
- notifications structurées ;
- publications et commentaires ;
- défis ;
- modération ;
- administration ;
- clients Web et Mobile ;
- temps réel et présence.

Les prochaines étapes doivent consolider cette base avant d’ouvrir les systèmes commerciaux et économiques.

---

## Phase 0 — Documentation et gouvernance produit

### Livrables

- Master Product Specification V2 ;
- blueprint d’architecture ;
- ADR sur les systèmes critiques ;
- backlog structuré ;
- règles de décision produit ;
- feature flags pour les futures phases.

### Sortie attendue

L’équipe sait ce qui appartient au MVP, à l’Alpha, à la Bêta et au long terme. Les idées nouvelles sont rattachées à un domaine et une phase.

---

## Phase 1 — Alpha fiable

### Priorités

- corriger les parcours existants ;
- améliorer les états vides, erreurs et chargements ;
- stabiliser le temps réel ;
- renforcer la récupération de session ;
- améliorer blocage, restriction et confidentialité ;
- ajouter observabilité et identifiants de requête ;
- préparer stockage média externe ;
- automatiser les sauvegardes de base de données ;
- compléter les tests critiques Web et Mobile.

### Critères de sortie

- aucun parcours critique sans test E2E ;
- erreurs serveur traçables ;
- sessions révocables ;
- temps réel tolérant aux reconnexions ;
- politique de sauvegarde documentée ;
- première Alpha privée distribuable.

---

## Phase 2 — Confiance, staff et permissions

### Livrables

- table `StaffAccount` ;
- rôles et permissions ;
- badge Équipe KnowMe ;
- bouclier doré ;
- écran d’administration du staff ;
- audit complet ;
- séparation staff, vérifié, Premium et créateur ;
- demandes de vérification ;
- workflow d’examen et de révocation.

### Critères de sortie

- aucun e-mail staff codé en dur ;
- chaque permission sensible testée ;
- toute attribution ou révocation auditée ;
- le paiement ne peut pas attribuer directement une vérification.

---

## Phase 3 — Entitlements et Premium sans paiement réel

### Livrables

- plans ;
- droits ;
- abonnements simulés en environnement de développement ;
- vérification centralisée des droits ;
- feature flags ;
- écrans Premium ;
- premiers avantages non sensibles.

### Avantages initiaux possibles

- thèmes statiques Premium ;
- icônes alternatives ;
- réactions exclusives ;
- options de personnalisation ;
- choix de personnages Concept K.

### Critères de sortie

- aucun `isPremium` dispersé ;
- droits testables indépendamment d’un prestataire ;
- expiration et état de grâce pris en charge ;
- désactivation d’urgence possible.

---

## Phase 4 — Paiements et facturation

### Livrables

- intégration Web ;
- intégration App Store et Play Store ;
- Mobile Money selon marché ;
- webhooks signés et idempotents ;
- factures et reçus ;
- annulations ;
- remboursements ;
- relances après échec ;
- rapprochement des statuts.

### Critères de sortie

- aucune donnée de carte complète stockée ;
- répétition d’un webhook sans double effet ;
- abonnement synchronisé entre prestataire et KnowMe ;
- politique commerciale et fiscale validée.

---

## Phase 5 — KnowCoins Ledger

### Livrables

- wallet par utilisateur ;
- registre immuable ;
- écritures d’ouverture ;
- récompenses idempotentes ;
- historique utilisateur ;
- outils d’audit administrateur ;
- compensations et remboursements ;
- limites antifraude.

### Critères de sortie

- aucun solde modifié directement ;
- somme des écritures cohérente ;
- double requête sans double crédit ;
- toute correction conserve une trace.

---

## Phase 6 — Défis V2

### Livrables

- versions immuables ;
- édition d’un défi ;
- ajout ou retrait de questions ;
- visibilité ;
- règles de score ;
- anciennes participations figées ;
- feedback visuel par réponse ;
- résultat final scénarisé ;
- historique de parties.

### Critères de sortie

- une modification ne change aucun ancien résultat ;
- chaque partie référence une version ;
- scores calculés côté serveur ;
- mode animations réduites respecté.

---

## Phase 7 — Gamification saine

### Livrables

- XP ;
- niveaux ;
- séries ;
- quêtes ;
- badges ;
- titres ;
- classements limités ;
- coffre quotidien ;
- récompenses KnowCoins ;
- Positive Challenges.

### Critères de sortie

- récompenses idempotentes ;
- règles visibles ;
- aucun avantage pay-to-win ;
- mécanismes aléatoires documentés ;
- protections contre le farming abusif.

---

## Phase 8 — Concept K initial

### Livrables

- `AnimationManager` Web et Mobile ;
- catalogue d’événements commun ;
- préférences automatique, réduite et désactivée ;
- fallback statique ;
- chargement à la demande ;
- premiers personnages originaux ;
- instrumentation performance.

### Événements initiaux

- connexion réussie ;
- compte créé ;
- demande d’ami acceptée ;
- défi créé ;
- bonne ou mauvaise réponse ;
- défi terminé ;
- niveau supérieur ;
- KnowCoins reçus ;
- message supprimé.

### Critères de sortie

- animations ignorables ;
- aucun blocage du parcours ;
- appareils modestes testés ;
- sons et vibrations contrôlables.

---

## Phase 9 — Catalogue, inventaire et personnalisation

### Livrables

- catalogue unifié ;
- raretés ;
- collections ;
- possessions ;
- thèmes ;
- icônes ;
- cadres ;
- avatars simples ;
- objets saisonniers ;
- équipement et aperçu.

### Critères de sortie

- un objet n’est défini qu’une fois ;
- propriété séparée du catalogue ;
- expiration des objets temporaires ;
- assets validés et optimisés.

---

## Phase 10 — Cadeaux et Sticker Studio

### Livrables

- KnowMe Gifts ;
- boutique en KnowCoins ;
- envoi avec message ;
- anonymat contrôlé ;
- vitrine de profil ;
- packs de stickers ;
- auteurs, licences, catégories et tags ;
- marketplace pilote ;
- statistiques créateurs.

### Critères de sortie

- transactions atomiques ;
- modération des contenus ;
- droits d’auteur documentés ;
- cadeaux purement cosmétiques ;
- remboursements et litiges possibles.

---

## Phase 11 — Communautés et créateurs

### Livrables

- communautés publiques et privées ;
- rôles communautaires ;
- demandes d’adhésion ;
- publications ;
- événements ;
- salons vocaux ;
- mode Créateur ;
- followers ;
- statistiques ;
- chaînes de diffusion.

### Critères de sortie

- permissions testées ;
- outils de modération ;
- export et suppression des données ;
- protection contre spam et raids.

---

## Phase 12 — Jeux et tournois

### Livrables

- moteur commun ;
- quiz ;
- jeu d’affinité ;
- puissance 4 originale ;
- mémoire ;
- rapidité ;
- matchmaking ;
- tournois ;
- replays ;
- classements ;
- anti-triche.

### Critères de sortie

- serveur autoritaire ;
- résultat reproductible ;
- abandon et reconnexion gérés ;
- sanctions révisables ;
- aucune mise activée.

---

## Phase 13 — Arena avec mises, sous condition

Cette phase n’est ouverte qu’après validation juridique, financière, antifraude et liée à l’âge.

### Livrables possibles

- réservations de KnowCoins ;
- pot ;
- commission ;
- remboursement en cas d’annulation ;
- limites ;
- géoblocage ;
- contrôle d’âge ;
- litiges ;
- anti-collusion.

### Condition d’arrêt

Si un marché assimile ces mises à un jeu d’argent non autorisé, la fonctionnalité reste désactivée dans ce marché.

---

## Phase 14 — IA, traduction et recherche universelle

### Livrables

- traduction facultative ;
- résumés ;
- recherche sémantique ;
- suggestions de défis ;
- assistant de tournoi ;
- biographies assistées ;
- recommandations explicables ;
- outils de modération assistée.

### Critères de sortie

- consentement et désactivation ;
- contenu original accessible ;
- protection des données ;
- contrôle humain pour décisions sensibles ;
- coûts et limites mesurés.

---

## Phase 15 — Memories, hors ligne et multiplateforme

### Livrables

- KnowMe Memories ;
- mode Nostalgie ;
- calendrier d’activité ;
- sauvegardes chiffrées ;
- brouillons hors ligne ;
- synchronisation différée ;
- widgets ;
- clients desktop ;
- mode Couple et Famille avec consentement.

---

## Règles de priorité

Une fonctionnalité monte dans la roadmap si elle :

1. améliore directement les défis, jeux ou conversations ;
2. réduit un risque de sécurité ou de perte de données ;
3. débloque plusieurs fonctionnalités futures ;
4. répond à un besoin confirmé par les utilisateurs ;
5. possède un coût d’exploitation soutenable.

Elle descend dans la roadmap si elle :

- duplique un système ;
- exige une validation juridique non obtenue ;
- fragilise les appareils modestes ;
- augmente fortement la modération sans outils adaptés ;
- crée du pay-to-win ;
- détourne KnowMe de sa mission relationnelle.
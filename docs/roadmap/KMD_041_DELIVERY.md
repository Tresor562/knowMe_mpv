# KMD-041 — Confidentialité des profils et relations collectives

## Livré

### Confidentialité financière

- liste blanche de statistiques publiques ;
- suppression profonde des clés financières connues ;
- nouvelles clés privées par défaut ;
- KnowCoins gagnés et dépensés privés ;
- solde et données de portefeuille absents de la vue publique ;
- garanties explicites dans la réponse de confidentialité ;
- tests anti-régression.

### Statistiques fiables

- événements Prisma idempotents ;
- opérations bornées par statistique ;
- agrégation transactionnelle ;
- reconstruction depuis l’historique ;
- historique accessible seulement au propriétaire ;
- aucun endpoint client pour s’auto-attribuer des statistiques ;
- métriques financières et d’usage classées privées.

### Profils collectifs

- demandes d’adhésion persistantes ;
- événements d’XP collectifs idempotents ;
- niveaux 1 à 5 non achetables ;
- liste des relations du propriétaire ;
- page publique filtrée ;
- membres actifs uniquement ;
- refus d’invitation ;
- départ ;
- pause ;
- reprise ;
- fin définitive ;
- retrait d’un membre ;
- demandes de guilde ;
- validation par propriétaire, administrateur ou officier ;
- centre Web `/profile-circles` ;
- page Web `/circles/:slug`.

## Vérifications attendues

- Prisma generate ;
- Prisma db push PostgreSQL ;
- build API ;
- build Web ;
- build Mobile ;
- tests unitaires ;
- tests E2E existants.

## Prochains blocs

- transfert sécurisé de propriété ;
- rôles éditables avec permissions détaillées ;
- arbre familial graphique ;
- couverture Duo réellement fusionnée ;
- transitions horizontales Duo ;
- publication de moments et Stories collectives ;
- branchement des modules défis, jeux et cadeaux au moteur d’XP ;
- moteur Followers réel pour les audiences collectives ;
- modération des demandes et biographies collectives ;
- notifications temps réel d’invitation et d’adhésion ;
- expérience mobile native finale.

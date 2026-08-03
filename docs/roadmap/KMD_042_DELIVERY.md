# KMD-042 — Gouvernance et contenus collectifs

## Livré

### Gouvernance

- rôles Owner, Admin, Officer et Member ;
- matrice de permissions ;
- restrictions spécifiques aux Duos ;
- promotion et rétrogradation contrôlées ;
- transfert de propriété à deux étapes ;
- expiration de 1 à 168 heures ;
- acceptation transactionnelle ;
- annulation ;
- historique privé des transferts ;
- audit des décisions.

### Contenus

- moments texte, photo, dessin, GIF, cadeau et succès ;
- audiences Public et Membres ;
- file de modération ;
- approbation, masquage et retrait ;
- XP idempotente après approbation ;
- Stories texte, photo, vidéo, cadeau et succès ;
- expiration 24 / 48 / 72 heures selon le niveau ;
- Stories expirées automatiquement exclues.

### Famille

- liens Parent, Enfant, Fratrie, Cousin, Partenaire, Responsable et Autre ;
- proposition uniquement entre membres actifs ;
- consentement de l’autre personne ;
- paire unique ;
- acceptation, refus et retrait ;
- liens en attente absents de la vue publique ;
- arbre familial public déclaré.

### Web

- centre `/profile-circle-governance` ;
- Stories sur `/circles/:slug` ;
- moments collectifs ;
- arbre familial accepté ;
- transfert, rôles et modération ;
- décisions familiales.

## Vérifications attendues

- génération Prisma ;
- synchronisation PostgreSQL ;
- build API ;
- build Web ;
- build Mobile ;
- tests unitaires ;
- E2E existants.

## Prochains blocs

- recherche des membres par pseudo ;
- notifications temps réel ;
- médias réels et modération ;
- réactions et commentaires ;
- Story plein écran ;
- arbre familial graphique ;
- transitions Duo fusionnées ;
- historique de rôles ;
- récupération sécurisée de propriété ;
- clients mobiles natifs.

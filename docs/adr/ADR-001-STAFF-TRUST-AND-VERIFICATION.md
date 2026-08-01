# ADR-001 — Staff, rôles et vérification

- **Statut :** Accepté pour architecture future
- **Date :** 2026-08-01

## Contexte

KnowMe doit distinguer les comptes officiels, les administrateurs, les modérateurs, les créateurs, les abonnés Premium et les identités vérifiées. Une liste d’e-mails codée en dur serait difficile à maintenir, risquée et impossible à auditer correctement.

## Décision

1. Les comptes officiels sont gérés dans une table `StaffAccount` liée à un utilisateur.
2. Les accès utilisent des rôles et permissions explicites.
3. Le badge Équipe KnowMe est différent du badge vérifié.
4. La vérification d’identité utilise un workflow séparé avec demande, examen et révocation.
5. Un abonnement payant ne peut jamais attribuer seul une vérification.
6. Toute modification de staff, rôle ou vérification produit une entrée d’audit.
7. Aucun e-mail officiel n’est codé dans le client ou le serveur.

## Modèle indicatif

```text
StaffAccount
- id
- userId
- staffRole
- status
- activatedAt
- revokedAt
- createdById
- revokedById
- reason

Role
Permission
RolePermission
UserRole

VerificationRequest
VerificationReview
```

## Conséquences positives

- ajout et révocation sans déploiement ;
- audit complet ;
- séparation claire entre confiance, abonnement et administration ;
- permissions réutilisables dans les communautés.

## Risques

- complexité supérieure à un champ `role` ;
- besoin d’un écran d’administration sécurisé ;
- migration du rôle existant.

## Mesures

- migration progressive ;
- rôle existant lu pendant la transition ;
- tests E2E de chaque permission sensible ;
- double confirmation pour l’attribution des permissions les plus puissantes.
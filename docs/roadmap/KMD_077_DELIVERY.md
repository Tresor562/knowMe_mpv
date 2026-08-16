# KMD-077 — Dossiers de conversations autoritaires

## Objectif

Permettre à chaque personne d'organiser ses conversations dans des dossiers privés sans modifier la conversation elle-même ni partager son classement avec les autres membres.

## Livrables

- modèle privé `ConversationFolder` appartenant à un utilisateur ;
- nom normalisé et unique dans l'espace de cet utilisateur ;
- position bornée pour l'ordre d'affichage ;
- une affectation active maximum par utilisateur et conversation ;
- `GET /conversation-folders` ;
- `POST /conversation-folders` ;
- `PATCH /conversation-folders/:folderId` ;
- `DELETE /conversation-folders/:folderId` ;
- `PUT /conversation-folders/:folderId/conversations/:conversationId` ;
- `DELETE /conversation-folders/assignments/:conversationId` ;
- revalidation de l'appartenance à la conversation lors d'une affectation ;
- purge des affectations devenues inaccessibles lors d'une lecture ;
- suppression en cascade du compte, de la conversation ou du dossier ;
- E2E PostgreSQL couvrant isolation, collision de nom, affectation, déplacement, renommage et suppression.

## Frontières permanentes

- les dossiers sont strictement privés à leur propriétaire ;
- classer une conversation ne modifie aucun membre, rôle, message ou permission ;
- un utilisateur ne peut affecter qu'une conversation à laquelle il appartient actuellement ;
- une conversation ne peut être que dans un dossier personnel à la fois pour un même utilisateur ;
- le classement d'un membre n'est jamais propagé aux autres membres ;
- aucun dossier Nexus distinct ni comportement Premium n'est ajouté par KMD-077.

## Migration

Création des tables `ConversationFolder` et `ConversationFolderAssignment`, avec index de lecture et clés étrangères `ON DELETE CASCADE` vers `User`, `Conversation` et le dossier.

## Retour arrière

Le module peut être retiré puis ses deux tables supprimées sans modifier les conversations ni les messages sources.

## Validation requise

Prisma generate/push, build du monorepo, tests unitaires et E2E PostgreSQL doivent être entièrement verts avant fusion.

# KnowMe — protocole « bien »

Le message **bien** dans une **nouvelle conversation** est la commande convenue pour commencer à développer un domaine KnowMe. Dans une conversation KnowMe déjà attribuée, « bien » reprend le même domaine. Respecter toute autre intention explicite de l'utilisateur.

## Avant toute modification

1. Consulter `AGENTS.md`, `docs/coordination/PARALLEL_WORK.md`, `docs/coordination/workstreams.json`, la roadmap #645, `main` et les PR/branches en cours. Lire les spécifications maîtres du domaine choisi.
2. Consulter le registre dynamique sur la branche **`coordination/workstream-assignments`** au chemin **`docs/coordination/assignments.json`**. Le ref GitHub de lecture est obligatoire ; ne pas confondre avec les fichiers de documentation dans `main`.
3. Choisir dans cet ordre : le premier domaine `free` ou `completed` dans la liste `policy.priority`; à défaut le domaine `paused` dont la date d'activité est la plus ancienne; à défaut envisager une session `active` inactive depuis plus de 24 h **après vérification manuelle des PR et travaux encore en cours**. Une session active récente n'est pas libre.
4. Générer un identifiant externe unique de session de type `session-<uuid>` : ChatGPT ne fournit pas ici d'identifiant universel de conversation. Pour la même conversation, réutiliser l'identifiant précédemment attribué.
5. **Réserver atomiquement** : après lecture du blob SHA du registre, remplacer le fichier par une version qui marque le domaine `active`, avec `ownerRef`, `claimedAt`, `updatedAt`, `issue`, `task`, `branch` et éventuellement `resumeFrom`. Utiliser le SHA comme condition dans `update_file` et préciser `branch="coordination/workstream-assignments"`. En cas de conflit GitHub 409/422, relire et recommencer la sélection : ne pas écraser une attribution concurrente. La lecture seule ne vaut pas réservation.
6. Consulter l'issue du domaine #693 à #699, ses fonctionnalités manquantes et les PR existantes. Développer les fonctionnalités **et les écrans Web/Android associés** plutôt que seulement organiser les tâches; créer une PR isolée `chat/<domaine>/<fonction>`, exécuter les tests et préserver les régressions.
7. Publier **à chaque réponse de travail** un point des domaines : **pris** (`active`), **en pause** (`paused`) et **libres** (`free/completed`). Ajouter ce qui a été réellement codé, testé, fusionné, déployé et vérifié; ne pas confondre ces étapes.
8. À chaque poursuite, actualiser `updatedAt`. À la fin d'un lot sans autre exécution en cours, mettre son domaine `paused` en conservant branche, PR et tâche, pour permettre une reprise **après** les domaines libres. `completed` exige des preuves de livraison. Ne pas considérer la fermeture d'une fenêtre comme un événement détectable.

## Règles de reprise

- Première nouvelle discussion « bien » : premier domaine libre selon `messaging`, `social`, `reels`, `profiles`, `marketplace`, `infra`, `design`.
- Discussions suivantes : chaque fois, réserver un autre domaine libre avant de reprendre un domaine en pause.
- S'il n'y a plus de libres, reprendre un domaine en pause à partir de ses anciennes branches, PR et issues plutôt que recommencer la même fonctionnalité à zéro.
- S'il n'existe que des domaines actifs, ne pas inventer qu'une autre conversation est « arrêtée ». Vérifier l'inactivité et le risque de chevauchement avant une reprise; sinon déclarer l'absence de créneau sûr.

**Occupation de conversation ≠ travail GitHub existant.** Les anciennes PR peuvent exister sans qu'aucune conversation soit réservée sous ce nouveau protocole. Ce registre enregistre seulement les attributions explicitement confirmées depuis son installation.

**Pas de travail asynchrone implicite :** chaque conversation exécute ses modifications au cours de ses propres tours. Les autres conversations privées et leurs actions non publiées ne sont pas consultables directement; c'est GitHub qui constitue le point de synchronisation.

## Outils

L'utilitaire `scripts/assign-knowme-workstream.mjs` (token GitHub d'écriture dans la variable d'environnement `GH_TOKEN`) fournit : `status`, `claim`, `touch --owner <id>`, `pause --owner <id> [--branch <ref>] [--task <texte>] [--pr <numéro>]` et `complete --owner <id>`. Il conserve le registre dans la branche dédiée, sans déclencher de déploiement Web/APK. Un assistant possédant le connecteur GitHub peut faire les mêmes lectures/écritures conditionnelles.

Le CLI **ne vole pas automatiquement** une réservation active, même ancienne. Sa reprise exige une vérification externe, puis une mise à jour coordonnée de l'état du registre.

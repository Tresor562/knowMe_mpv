# KMD-165 — PostgreSQL backup and recovery readiness

## Phase produit

Phase 1 — Alpha fiable.

## Objectif

Rendre les sauvegardes PostgreSQL opérables et vérifiables avant une release commerciale, sans prétendre qu'une sauvegarde externe, une restauration de production ou un exercice de reprise ont déjà été exécutés.

## Périmètre livré

- `pnpm db:backup` crée un dump PostgreSQL au format custom via `pg_dump` ;
- les sauvegardes n'embarquent pas la propriété/les privilèges d'origine ;
- le fichier local est limité à l'utilisateur courant (`0600`) ;
- un manifeste adjacent contient un SHA-256, la date et le format, mais aucune URL de base de données ;
- `pnpm db:restore -- --file <backup.dump> --confirm RESTORE_KNOWME` refuse toute restauration sans confirmation explicite ;
- la restauration exige `RESTORE_DATABASE_URL`, distinct du contrat normal `DATABASE_URL` ;
- le manifeste et le SHA-256 sont vérifiés avant `pg_restore` ;
- `pg_restore` utilise `--exit-on-error`, `--clean` et `--if-exists` afin d'échouer clairement sur une restauration incohérente ;
- `.backups/`, les dumps et manifests sont ignorés par Git pour réduire le risque de fuite accidentelle ;
- les contrats de sécurité du helper sont couverts par les tests Node lancés par `pnpm test`.

## Procédure de sauvegarde

Pré-requis : outils PostgreSQL compatibles installés et `DATABASE_URL` défini.

```bash
pnpm db:backup
```

Par défaut le dump est écrit dans `.backups/`. Un chemin explicite est possible :

```bash
pnpm db:backup -- --output /secure/path/knowme-2026-08-21.dump
```

Le dump contient des données sensibles et doit être chiffré au repos par le stockage de destination. Il ne doit jamais être envoyé dans Git, les logs CI ou un canal public.

## Procédure de restauration contrôlée

Une restauration doit d'abord être répétée dans un environnement isolé avec un compte PostgreSQL dédié.

```bash
export RESTORE_DATABASE_URL='postgresql://.../knowme_restore'
pnpm db:restore -- --file /secure/path/knowme-2026-08-21.dump --confirm RESTORE_KNOWME
```

Après restauration :

1. exécuter Prisma et les vérifications de compatibilité attendues pour la version applicative ;
2. lancer les tests d'intégrité/E2E pertinents ;
3. vérifier les comptes, relations, conversations, défis, notifications et droits d'accès ;
4. ne remettre le trafic qu'après validation opérateur explicite.

## Critères de release restant externes

KMD-165 fournit l'outillage et les garde-fous, mais ne prouve pas encore :

- qu'une sauvegarde distante chiffrée est planifiée automatiquement ;
- qu'une politique de rétention conforme au marché est configurée ;
- qu'une restauration complète a été exécutée sur l'infrastructure de production ;
- que les RPO/RTO réels ont été mesurés ;
- que le fournisseur d'hébergement garantit la redondance géographique requise.

Ces preuves doivent venir de l'environnement réel et ne doivent pas être simulées dans le dépôt.

## Rollback

Le rollback applicatif consiste à revenir les fichiers de scripts, les commandes `db:backup`/`db:restore`, la documentation et les règles `.gitignore` de ce KMD. Aucun schéma Prisma ni aucune donnée utilisateur n'est modifié par le merge de KMD-165.

Une restauration déjà exécutée est une opération de données destructive et ne se rollback pas en revertant Git : elle exige une autre sauvegarde valide ou un mécanisme de reprise du fournisseur.

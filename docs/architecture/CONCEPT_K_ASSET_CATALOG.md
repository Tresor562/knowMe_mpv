# Concept K — catalogue des personnages et assets

## Personnages originaux

Chaque personnage possède une clé et une version immuables. La première politique du catalogue impose :

- `originalWork: true` ;
- `licenseKey: KNOWME_ORIGINAL` ;
- un nom et une description publics ;
- une activation explicite ;
- un acteur administratif et une raison de publication.

Un personnage désactivé ne peut plus être sélectionné, même si ses anciens manifests restent conservés pour l’audit.

## Manifests d’assets

Chaque asset est défini une seule fois par sa clé et sa version. Le manifest contient :

- l’événement Concept K ;
- la variante `FULL` ou `REDUCED` ;
- la plateforme et la classe d’appareil ;
- une URL HTTPS ou un chemin interne `/assets/` ;
- un hash SHA-256 ;
- la taille, le type MIME et la durée ;
- une fenêtre de diffusion ;
- un pourcentage de rollout ;
- l’acteur administratif et la raison.

La taille initiale est limitée à 1 Mo et la durée ne peut dépasser le budget du contrat d’animation partagé.

## Résolution

Le serveur résout d’abord le plan d’accessibilité KMD-024. Une variante statique interrompt immédiatement la recherche d’asset.

Pour une animation autorisée, il :

1. cherche uniquement les manifests actifs et dans leur fenêtre ;
2. exige la variante déterminée par le plan ;
3. filtre selon la plateforme et la classe d’appareil ;
4. exclut les personnages inactifs ;
5. applique un bucket déterministe SHA-256 par compte et asset ;
6. préfère les correspondances exactes puis la version la plus récente ;
7. retourne le hash, la taille, le MIME et l’identité du personnage ;
8. utilise le fallback statique si aucun manifest n’est éligible.

Le client ne peut ni choisir son bucket, ni forcer un asset, ni augmenter le rollout.

## Rollout et économie

Le rollout est compris entre 0 et 100 %. Une mise à zéro produit immédiatement un fallback sans supprimer l’historique du manifest.

Premium, les KnowCoins, les achats et les rôles sociaux ne modifient jamais la sélection ou la priorité de téléchargement.

## Administration

Les mutations sont protégées par `concept_k.manage`. Toute création de personnage, publication d’asset ou modification de rollout génère un journal d’audit.

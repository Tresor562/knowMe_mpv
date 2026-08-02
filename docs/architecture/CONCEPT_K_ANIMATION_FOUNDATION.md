# Concept K — fondation d’animation

## Contrat commun

Le package `@knowme/animation-contract` constitue la source partagée entre l’API, le Web et le Mobile. Il contient :

- la version du catalogue ;
- les clés d’événements ;
- les fallbacks statiques ;
- les budgets de durée ;
- les capacités sonores et haptiques ;
- le moteur déterministe de résolution.

Aucun client ne possède un catalogue divergent.

## Préférences

Chaque compte possède un mode :

- `AUTO` : animation complète, sauf contrainte système ou appareil modeste ;
- `REDUCED` : variante réduite lorsqu’elle existe, sinon fallback statique ;
- `OFF` : fallback statique uniquement.

La préférence système de réduction des mouvements est prioritaire sur `AUTO`. Le son est désactivé par défaut. Les vibrations légères restent contrôlables séparément.

## Garanties de parcours

Toutes les réponses de résolution indiquent :

- `blocking: false` ;
- `skippable: true` ;
- une variante `FULL`, `REDUCED` ou `STATIC` ;
- un symbole et un libellé statiques ;
- une durée maximale ;
- un chargement `LAZY`.

Une erreur de chargement ou de télémétrie ne peut jamais faire échouer l’action métier qui a déclenché l’événement.

## Télémétrie

La télémétrie stocke uniquement :

- la clé d’événement ;
- la version du catalogue ;
- le mode et la variante résolus ;
- le résultat technique ;
- la durée ;
- la taille de l’asset ;
- la plateforme et la classe d’appareil ;
- une raison technique bornée.

Aucun message, réponse, contenu de défi, nom, e-mail ou texte utilisateur n’est collecté. Les événements sont idempotents et la politique initiale de conservation est de 30 jours.

## Budgets

- durée client maximale acceptée : 10 secondes ;
- taille d’asset maximale acceptée par événement de télémétrie : 2 Mo ;
- signalement `DURATION_OVER_BUDGET` au-delà de deux fois le budget de l’événement ;
- signalement `ASSET_OVER_BUDGET` au-delà de 1 Mo ;
- fallback statique obligatoire pour chaque entrée du catalogue.

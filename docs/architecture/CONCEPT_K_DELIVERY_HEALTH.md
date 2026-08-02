# Concept K — santé technique des assets

## Objectif

Cette couche détecte les manifests difficiles à charger ou dont l’intégrité ne correspond pas au hash publié. En cas de problème collectif confirmé, la résolution revient au fallback statique sans bloquer l’action principale de l’utilisateur.

## Reçus techniques

Un reçu contient seulement l’identifiant du manifest, le résultat technique, la durée, la plateforme, la classe d’appareil et, pour un problème d’intégrité, le hash observé. Aucun message, réponse, profil ou contenu de défi n’est enregistré.

Le serveur confirme que le compte était éligible au manifest dans ce contexte. Une seule mesure est retenue par compte, manifest et journée UTC. Les rejeux renvoient la mesure déjà conservée.

## Seuil de santé

La fenêtre initiale couvre 24 heures. Une quarantaine automatique nécessite en même temps :

- cinq mesures ou davantage ;
- quatre échecs ou davantage ;
- un taux d’échec d’au moins 80 %.

Une mesure isolée ne suffit donc jamais à changer l’état d’un manifest.

## Quarantaine

Quand le seuil est franchi, le manifest devient inactif, la date et la raison sont conservées, et un audit système unique est écrit. Les résolutions suivantes utilisent le fallback statique. Premium et les achats ne permettent pas de contourner cet état.

## Restauration

La restauration exige la permission `concept_k.manage` et une raison explicite. L’acteur et la date sont conservés. Les anciennes mesures restent consultables afin de préserver la traçabilité.

## Cycle de vie du compte

Les mesures techniques sont incluses dans l’export du compte concerné et supprimées avec ce compte.

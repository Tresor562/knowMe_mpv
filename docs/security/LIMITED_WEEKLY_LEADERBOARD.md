# KMD-021 — Classement XP hebdomadaire limité

## Objectif

Le classement permet une comparaison légère sans transformer KnowMe en système de pression permanente. Il repose exclusivement sur le registre XP immuable.

## Participation volontaire

Un compte est visible uniquement lorsque les deux conditions suivantes sont réunies :

1. l’utilisateur active explicitement le classement hebdomadaire ;
2. sa préférence globale de découvrabilité est active.

L’opt-out ou la désactivation de la découvrabilité retire immédiatement le compte de la réponse publique. Aucun compte n’est inscrit par défaut.

## Identité affichée

Le classement expose seulement un pseudonyme public choisi et validé. Il n’expose ni e-mail, ni identifiant de compte, ni rôle, ni statut de vérification.

## Score autoritaire

Le score est agrégé depuis `XpLedgerEntry` entre le lundi 00:00 UTC inclus et le lundi suivant exclu. Aucun endpoint ne permet de soumettre, corriger ou augmenter un score.

Le score classant est plafonné à 500 XP par semaine :

- l’XP réel reste intégralement conservé ;
- le surplus n’augmente plus le rang ;
- le plafond réduit l’intérêt du farming intensif.

## Portée limitée

- cinquante entrées visibles au maximum ;
- fenêtre hebdomadaire uniquement ;
- aucun classement permanent ;
- aucune récompense, KnowCoin ou avantage Premium ;
- aucun boost payant ;
- égalités déterministes et reproductibles.

## Audit et vie privée

Chaque changement réel d’opt-in ou d’opt-out est audité. Les rejeux identiques n’ajoutent pas de nouvel audit.

La préférence figure dans l’export de compte v6 et est supprimée avec le compte.

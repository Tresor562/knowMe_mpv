# KMD-059 — Disponibilité et préparation des appels

## Objectif

Donner à chaque personne le contrôle de sa disponibilité et de ses appareils avant un appel, tout en gardant la décision d'admission autoritaire côté serveur et les flux média strictement locaux.

## Bloc API livré

- préférences persistantes d'appels entrants, de média, de plage silencieuse et de préparation des appareils ;
- validation stricte des minutes et du fuseau IANA ;
- mises à jour atomiques avec version optimiste ;
- application des préférences dans la transaction de création d'appel ;
- refus générique qui ne révèle pas la règle privée ayant bloqué l'appel ;
- audit des changements sans secret ni donnée WebRTC ;
- export des préférences et de l'historique d'appel minimisé ;
- suppression ordonnée avec pseudonymisation des sessions et événements d'appel ;
- tests unitaires des horaires locaux et couverture E2E du contrat HTTP et de l'admission.

## Frontière de confidentialité

Le serveur ne demande, ne reçoit et ne conserve ni liste de périphériques, ni identifiant matériel, ni permission du navigateur, ni flux audio/vidéo. Il conserve seulement les choix de produit nécessaires à l'admission et aux valeurs initiales de l'écran de préparation.

## Sémantique des horaires

Les bornes sont des minutes locales inclusives au début et exclusives à la fin. Une borne de début supérieure à la borne de fin traverse minuit. Deux bornes égales représentent une journée entière silencieuse lorsque la fonction est activée.

## Suite réservée

Le bloc Web doit ajouter l'aperçu local, la sélection audio/vidéo, les états de permission et la restitution de l'indisponibilité. Il doit consommer le contrat API sans envoyer de données matérielles au serveur.

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

## Bloc Web livré

- formulaire versionné des préférences avec rechargement sûr en cas de conflit optimiste ;
- états explicites de permission et d'échec sans déclenchement automatique du navigateur ;
- aperçu local volontaire, sélection microphone/caméra et invalidation du test après un changement d'appareil ;
- application locale des valeurs initiales du micro et de la caméra ;
- obligation de préparation appliquée avant émission ou acceptation lorsque la préférence l'exige ;
- sérialisation par liste blanche, testée pour exclure les identifiants matériels et les métadonnées de réponse ;
- contraintes média et classification des erreurs couvertes par des tests unitaires Web.

La connexion WebRTC ne réutilise l'aperçu qu'après une action explicite d'appel. Un appel audio retire toute piste vidéo locale avant la négociation. Aucun identifiant d'appareil n'est envoyé au contrat API.

## Bloc Mobile livré

- formulaire de disponibilité branché sur le même contrat versionné et récupération sûre après conflit optimiste ;
- validation locale du format des heures avant l'envoi et sérialisation par liste blanche testée ;
- états explicites des permissions microphone/caméra sans demande automatique au chargement ;
- test audio fondé sur l'autorisation native et aperçu caméra volontaire avant/arrière sans capture ;
- arrêt de l'aperçu par démontage du composant natif et libération lors de la sortie de l'écran ;
- messages natifs de permission configurés pour les futurs binaires iOS et Android ;
- aucune persistance ni transmission d'identifiant matériel, de permission ou d'image locale.

Sur Mobile, le système d'exploitation reste l'autorité pour le routage du microphone et de la sortie audio. L'interface n'invente donc pas une sélection d'appareil que les API natives retenues n'exposent pas de façon portable.

## Suite

Valider les permissions, le remontage de l'aperçu et le changement de caméra sur la matrice réelle Web/iOS/Android. Aucun élargissement du contrat serveur n'est requis.

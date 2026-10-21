# KnowMe Android — mise à jour en arrière-plan

Workstream: infra · issue #698.

## Parcours

1. Une APK signée contenant le nouveau module natif détecte une version supérieure sur le flux HTTPS KnowMe.
2. L'utilisateur confirme « Mettre à jour ». Le module natif valide l'URL officielle, la version et l'empreinte SHA-256 fournie par le manifeste, puis lance **Android DownloadManager**. La modale disparaît immédiatement.
3. Android gère le téléchargement, sa notification de progression, les transferts lorsque KnowMe est réduite et les interruptions réseau (selon la politique de l'OS).
4. Dès que la fenêtre se ferme, un bandeau KnowMe lit le statut du DownloadManager toutes les deux secondes lorsque l'application est au premier plan. Il affiche les octets et le pourcentage uniquement si Android connaît la taille totale ; sinon, l'état de téléchargement sans pourcentage fictif. Le suivi est retrouvé au retour dans l'application.
5. En fin de transfert, le récepteur Android affiche une notification pour rouvrir KnowMe. Sans permission de notifications, KnowMe détecte également l'APK prête et offre « Installer / reprendre ». En cas d'échec natif, le bandeau affiche l'erreur et propose de télécharger à nouveau depuis le manifeste officiel.
6. Le bouton « Installer » effectue une copie en cache interne, puis le validateur natif vérifie la **SHA-256**, le **package** et le **versionCode** avant de lancer **l'interface officielle d'installation Android**. Aucune installation silencieuse. Le lancement de l'installateur n'est PAS une preuve de réussite.
7. Après installation effective, au premier démarrage de la nouvelle APK, le module compare le numéro de version installé à celui de l'APK préparée et montre une fenêtre de confirmation. La confirmation de l'utilisateur acquitte l'état persistant et efface le fichier téléchargé. En cas de refus de l'installation Android, le fichier demeure prêt pour réessayer.
8. Si le flux API est temporairement inaccessible après le téléchargement, l'APK déjà enregistrée reste détectable via le gestionnaire Android.

## Sécurité / contraintes

- URL VPS KnowMe exacte dans le client et domaine/chemin imposés dans le module natif ; aucune URL non fiable depuis des extras de notification.
- Téléchargement dans le répertoire privé de l'application (pas dans le dossier public Downloads).
- Un seul téléchargement actif à la fois ; une nouvelle version remplace l'ancienne, un appui répété ne duplique pas la tâche.
- Android peut demander une autorisation d'installation ; l'autorisation n'est jamais contournée. La signature finale de l'APK reste contrôlée par le gestionnaire Android.
- Les versions précédemment installées sans ces méthodes natives ne peuvent pas obtenir le comportement persistant par un simple changement JavaScript/OTA : **une nouvelle APK native signée est nécessaire**.
- Le système peut différer un transfert selon ses conditions réseau/énergie. « Arrière-plan » ne signifie pas « installation silencieuse ».

## Vérifications de livraison avant publication

- Exécuter `pnpm --filter @knowme/mobile test` et `pnpm --filter @knowme/mobile build` sur le head exact de la PR.
- Générer une **APK complète** par le workflow Android, installer sur un appareil réel avec le **même certificat**, et vérifier la version de destination.
- Essais : fermer la modale, minimiser/forcer l'arrêt de l'interface (selon restrictions OS), couper puis retrouver le réseau, terminer sans notification autorisée, relancer l'application, refuser puis accepter l'installation, hash erroné, APK invalide, stockage insuffisant, clic répété.
- Vérifier la notification et l'installation sur Android 13, 14, 15. Ne pas affirmer la livraison tant que l'APK n'est pas publiée et installée en essai.

## Retour arrière

- Ne pas fusionner la PR, ou revenir au commit antérieur et construire une nouvelle APK signée.
- Les téléchargements privés existants sont ignorés par les versions sans ce module ; Android n'installe rien sans action explicite.

## Dépendances

- PR #609 et #611 modifient l'écran de mise à jour et sont encore ouvertes ; **faire résoudre les conflits de coordination avant fusion**. Ne pas déployer cette branche directement.

## Critères de reprise et de confirmation (correctif suivi)

- Téléchargement démarré puis modale fermée : bandeau de progression réel, sans bloquer KnowMe.
- Réseau interrompu : état de téléchargement suspendu géré par Android, puis reprise selon le système ; erreur définitive visible et action « Réessayer ».
- Taille inconnue : aucun pourcentage arbitraire, barre de progression cachée.
- Téléchargement achevé : notification et bouton « Installer / reprendre » sans déclarer l'APK installée.
- Installateur lancé puis refusé : possibilité de relancer l'installation, aucun faux message de réussite.
- APK effectivement installée : confirmation à l'ouverture de la nouvelle version, une fois seulement après acquittement.
- Réouverture de KnowMe sans Internet : progression et APK préparée toujours consultables par le module natif.
- Ces fonctions nécessitent un **nouvel APK signé** contenant le module ; ni une PR ni une mise à jour OTA JavaScript ne réparent rétroactivement les anciennes APK.

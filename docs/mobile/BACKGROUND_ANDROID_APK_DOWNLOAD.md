# KnowMe Android — mise à jour en arrière-plan

Workstream: infra · issue #698.

## Parcours

1. Une APK signée contenant le nouveau module natif détecte une version supérieure sur le flux HTTPS KnowMe.
2. L'utilisateur confirme « Mettre à jour ». Le module natif valide l'URL officielle, la version et l'empreinte SHA-256 fournie par le manifeste, puis lance **Android DownloadManager**. La modale disparaît immédiatement.
3. Android gère le téléchargement, sa notification de progression, les transferts lorsque KnowMe est réduite et les interruptions réseau (selon la politique de l'OS).
4. En fin de transfert, le récepteur Android affiche une notification pour rouvrir KnowMe. Sans permission de notifications, un retour dans KnowMe détecte également l'APK prête.
5. Le bouton « Installer » effectue une copie en cache interne, puis le validateur natif existant vérifie la **SHA-256**, le **package** et le **versionCode** avant de lancer **l'interface officielle d'installation Android**. Aucune installation silencieuse.
6. Si le flux API est temporairement inaccessible après le téléchargement, l'APK déjà enregistrée reste détectable via le gestionnaire Android.

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

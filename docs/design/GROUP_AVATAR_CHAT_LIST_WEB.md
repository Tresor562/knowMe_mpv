# KnowMe — photos de groupe privées dans la liste Web des discussions

Workstream: design
Coordination-Issue: #699
Cross-workstream: messaging #693 and infra #698

## Contrat livré par ce lot

- La liste Web `/messages` affiche l'image réelle d'un groupe lorsqu'un membre authentifié peut lire `GET /conversations/:id/group/avatar`.
- Le fichier n'est jamais récupéré comme une URL publique : `apiFetchBlob` émet le JWT existant et ne conserve le résultat qu'en `blob:` local au composant monté. L'URL est révoquée au changement de session, de conversation, d'actualisation ou lors du démontage.
- Les conversations privées gardent leur propre avatar utilisateur ; aucun avatar personnel n'est utilisé par erreur comme photo de groupe.
- Un IntersectionObserver déclenche le chargement seulement lorsque l'avatar entre dans la zone de lecture (ou presque) ; les longues listes ne chargent pas tous les médias hors écran.
- Une image absente, un backend ancien/indisponible, un 403/404 ou un média inattendu conserve l'initiale du nom comme repli. La fonctionnalité d'administration du groupe ne change pas.
- Le bouton « Actualiser » renouvelle les images consultées après rafraîchissement de la liste autorisée ; une photo supprimée cesse alors d'être affichée.
- Pas de nouvelle table, migration, stockage local durable, URL signée publique ni changement de contrat Messaging partagé.

## Validation requise

Playwright `group-avatar-list.spec.ts` :
1. Groupe visible, téléchargement authentifié et rendu d'un `blob:` privé ;
2. Retrait de photo côté API suivi d'une actualisation, retour à l'initiale ;
3. Conversation non listée (utilisateur non membre), aucune requête image.

Exiger CI complète, garde anti-chevauchement, APK Build Once (vérification de non-régression seulement) sur le SHA exact. Un APK construit ne prouve pas que cet écran Web fonctionne en React Native.

## Limites et dépendances

- **Backend :** la migration `20261018234000_group_avatar` et le déploiement API sur le VPS restent à prouver par Infra #698 ; un Vercel `READY` n'en constitue pas la preuve.
- **Temps réel :** une modification depuis un autre appareil ne pousse pas encore `group:updated` dans la liste sans rafraîchissement ; le prochain lot Messaging doit ajouter un événement serveur + un cache à version/hash sans exposer les fichiers aux non-membres.
- **Android natif :** `RealtimeMessagesPanel.tsx` et son picker nécessitent une intégration distincte dans Messaging #693 (collisions avec anciennes PR). Ce composant Web ne les remplace pas.
- **Confidentialité :** ne pas conserver les images dans IndexedDB/localStorage/service worker ; ne jamais émettre de lien lisible publiquement. Après expulsion, le backend doit refuser toute nouvelle lecture. Un rafraîchissement efface le blob client après ce refus.

Rollback : revert de la PR autonome et restauration de l'initiale seule dans `apps/web/app/messages/page.tsx`.

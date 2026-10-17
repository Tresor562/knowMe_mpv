# KnowMe — règle permanente : configuration dynamique avant nouvelle build

Date : 17 octobre 2026. **Source de vérité pour les futurs travaux sur KnowMe.**

## Demande produit

Lorsqu'on crée ou attribue un badge, active une fonction existante, change la présentation d'un
module ou publie des contenus cosmétiques, l'utilisateur ne doit **pas** devoir installer
systématiquement une nouvelle APK et le site ne doit **pas** subir un redéploiement du code
pour de simples changements de données. Le Web et Android doivent partager la même autorité VPS.

Le changement de comportement doit être **immédiatement récupérable**, avec événement Socket.IO
sur session connectée, rafraîchissement périodique (~60 s) et à la reprise au premier plan.
Les actions d'administration passent par RBAC, journal d'audit et gestion des collisions de révisions.

## Ce que le lot introduit

- Catalogue JSON versionné `RuntimeExperienceConfig` validé par l'API, sans HTML/code exécutable.
- Endpoints `GET /runtime-experience` (catalogue), `PUT /admin/runtime-experience` (publication optimiste).
- Badges officiels `verified_blue` et `staff_gold` : **styles seulement**, aucune attribution via
  le catalogue. Les droits et la vérification restent du domaine Auth/Verification/Staff.
- Badges décoratifs : `UserCosmeticBadge`, CRUD d'attribution réservé à
  `cosmetics.manage`, `GET /runtime-experience/badges/:username`.
- Modules de présentation `notice`, `tile`, `link` construits uniquement avec des primitives
  clientes connues; lien limité aux routes internes. Une route non implémentée ne devient pas fonctionnelle.
- Web et Android mettent en cache la dernière configuration valide, affichent les badges et
  récupèrent les modifications sans rebâtir l'APK ou relancer Next.js.
- Feature Flags existants `feature-flags` restent l'autorité pour activer les fonctions déjà intégrées.

## Déploiement initial (obligatoire)

1. Revue, tests, sauvegarde PostgreSQL, compilation API/Web/Android.
2. Fusionner le code validé seulement après contrôle CI et revue; déployer le backend avec
   `prisma migrate deploy`, vérifier l'API.
3. Déployer une version Web contenant les lecteurs de configuration.
4. Construire et installer **une APK compatible** contenant le moteur dynamique.
   Les anciennes APK ne comprennent pas les nouveaux messages ni les nouvelles routes.
5. Tester : attribuer à un compte un badge décoratif, voir le résultat côté profils, feed,
   commentaires sur Web et Android, retirer le badge, déconnecter/reconnecter, revenir en ligne.
6. Répéter avec une modification du style bleu (sans changer les privilèges), publication de
   module, kill-switch d'une fonctionnalité préexistante, vérification des journaux.
7. Rollback en restaurant la dernière configuration compatible; ne pas revenir en arrière
   par remplacement silencieux du schéma des badges certifiés.

## Deux classes de changement

**Sans APK/redéploiement Web** :
attributions, modèles de badges compatibles avec `check/star/spark`, modules construits
avec des primitives déjà présentes, contenu, paramètres et feature flags existants.

**Avec nouvelle build ou déploiement** :
nouveau code natif, permissions Android, nouvelles bibliothèques, nouveaux composants visuels
non pris en charge par le moteur, changements structurels du schéma, nouvelles routes
qui nécessitent du nouveau code côté client ou serveur.

## OTA JavaScript Expo — deuxième phase, NE PAS activer prématurément

La version actuelle utilise toujours l'installateur APK du VPS. Pour offrir en plus des
mises à jour du bundle JS, ajouter `expo-updates` compatible **SDK 53**, un `runtimeVersion`
qui ne change que quand la couche native change, et un serveur de publication Expo Updates v1
sur le VPS. L'API doit vérifier `expo-platform`, `expo-runtime-version`, channel et
signature; publier atomiquement seulement après vérification du manifeste, des empreintes
SHA-256 et de la compatibilité; refuser toute mise à jour inter-runtime.
Protéger les manifestes par signature et certificat embarqué; rollback et stockage
immuable des assets. Installer une APK contenant le runtime OTA avant d'envoyer un bundle.

Ne pas confondre OTA JavaScript, configuration dynamique et installation Android :
OTA ne peut pas installer de nouveau code natif ni outrepasser les permissions Android.
Ne jamais annoncer OTA « opérationnel » tant qu'une vraie APK, les flux réseau et
la restauration en cas d'échec n'ont pas été validés.

## Invariants permanents

- Aucune couleur, notification, chaîne de configuration, achat ou badge décoratif ne peut
  accorder certification, rôle staff, Premium, droits d'accès, KnowCoins ou permissions.
- Aucune évaluation à distance de JavaScript, HTML ou expression non validée.
- Changement de badge et révocation doivent se refléter partout, y compris les écrans futurs.
- Compatibilité avec les clients anciens, plus journalisation de chaque action.
- Préférer le pilotage à distance pour chaque nouvelle fonctionnalité ajoutée au backlog.
- GitHub ≠ VPS : un commit ou une PR ne prouve jamais un déploiement en production.

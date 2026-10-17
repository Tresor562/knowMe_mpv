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

## OTA JavaScript Expo — intégré dans le code, activation VPS encore conditionnelle

- Dépendance native `expo-updates@0.28.18` (SDK 53) et lockfile pnpm actualisé.
- Runtime natif `knowme-android-ota1`; canal Android `preview`; URL
  `https://31-56-85-53.sslip.io/knowme-api/mobile-updates/ota`.
- Bundle JS et ressources compatibles : contrôle de mise à jour au lancement et à la
  remise au premier plan, téléchargement, proposition de redémarrage, repli sur
  la version embarquée si le réseau échoue.
- NestJS : serveur Expo Updates Protocol v1 (`mobile-updates/ota`) avec
  contrôle de plateforme, runtime, canal, empreintes des ressources,
  manifests signés RSA-SHA256 et publication locale.
- Publication atomique des exports Expo sur le VPS à l'aide de
  `scripts/publish-knowme-ota.mjs`. La publication est en mode simulation par défaut.

### Sécurité de production

Le serveur est **désactivé par défaut** et exige une URL HTTPS, un fichier
privé de signature RSA côté VPS et `KNOWME_OTA_ENABLED=true`.
Un client configuré pour vérifier les signatures exige en plus le certificat
public correspondant dans la couche Android, signé avant la compilation de l'APK.
La version actuelle du client n'embarque **pas encore** ce certificat.
Les clients non signés sont refusés par défaut ; `KNOWME_OTA_ALLOW_UNSIGNED_CLIENTS=true`
permet explicitement une **phase de compatibilité moins sûre**, à ne pas utiliser
comme protection de production. Ne jamais affirmer que le déploiement OTA est sécurisé
ou actif sans une APK testée ayant une chaîne de confiance vérifiée.

### Publication sur un VPS effectivement connecté

1. Installer **une première APK** avec cette version native et vérifier la
   compilation, la signature de l'APK et le stockage de l'application.
2. Installer l'API mise à jour avec sauvegarde PostgreSQL et migrations validées.
3. Préparer un certificat Expo public embarqué dans une APK et la clé privée RSA
   correspondante **uniquement sur le VPS** (jamais dans GitHub, Vercel ou l'APK).
4. Configurer `KNOWME_OTA_STORAGE_DIR`, `KNOWME_OTA_PUBLIC_URL`,
   `KNOWME_OTA_SIGNING_KEY_PATH`, `KNOWME_OTA_ENABLED=true` et ne pas ouvrir
   le canal non signé en production.
5. Produire `dist` avec `expo export --platform android --output-dir dist` ;
   enregistrer le JSON de `expo config --type public --json` sous
   `dist/expoConfig.json`.
6. Sur le VPS, depuis le dépôt officiel, effectuer d'abord la simulation :
   `node scripts/publish-knowme-ota.mjs --dist=apps/mobile/dist --runtime=knowme-android-ota1 --channel=preview --url=https://31-56-85-53.sslip.io/knowme-api/mobile-updates/ota`
   puis, après validation sur appareil et sauvegardes, rejouer avec `--publish`.
7. Tester un changement JS compatible, l'installation du bundle, le redémarrage,
   les requêtes de contrôle, le retour arrière, et les anciennes APK.

Le serveur Expo OTA ne remplace **jamais** une nouvelle build pour
les modules natifs, les permissions Android ou une autre version de runtime.
Un commit GitHub ne déploie pas à lui seul le backend sur le VPS.

## Invariants permanents

- Aucune couleur, notification, chaîne de configuration, achat ou badge décoratif ne peut
  accorder certification, rôle staff, Premium, droits d'accès, KnowCoins ou permissions.
- Aucune évaluation à distance de JavaScript, HTML ou expression non validée.
- Changement de badge et révocation doivent se refléter partout, y compris les écrans futurs.
- Compatibilité avec les clients anciens, plus journalisation de chaque action.
- Préférer le pilotage à distance pour chaque nouvelle fonctionnalité ajoutée au backlog.
- GitHub ≠ VPS : un commit ou une PR ne prouve jamais un déploiement en production.

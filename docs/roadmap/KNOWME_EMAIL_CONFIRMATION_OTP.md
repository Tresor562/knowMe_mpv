# KnowMe — confirmation email et récupération par code

Le système utilise l'authentification NestJS/Prisma déjà en place. Les OTP sont
limités à six chiffres, dix minutes de validité, cinq tentatives et un seul usage.

## Configuration serveur

Définir EMAIL_OTP_SECRET (32 caractères minimum) dans le secret manager
de l'API, distinct de JWT_SECRET et ACCOUNT_RECOVERY_SECRET.

KNOWME_EMAIL_ENDPOINT, KNOWME_EMAIL_API_KEY et KNOWME_EMAIL_FROM
permettent de paramétrer l'envoi transactionnel (API compatible Resend).
Sinon les variables ACCOUNT_RECOVERY_EMAIL_* existantes sont réutilisées.
L'expéditeur doit être vérifié, avec SPF, DKIM et DMARC. Aucun secret dans l'APK
ou dans NEXT_PUBLIC_*.

## Procédure de mise en production

1. Sauvegarder PostgreSQL et appliquer la migration Prisma.
2. Configurer fournisseur email et secret HMAC, tester SPF/DKIM/DMARC.
3. Déployer l'API et vérifier ses routes, puis le site et l'APK.
4. Tester avec boîte réelle inscription, renvoi, mauvais code, expiration,
   reset, changement d'adresse, fermeture des sessions et alertes.

Les comptes existants sont conservés et ne seront pas déconnectés. L'ancienne
récupération par lien reste disponible en parallèle.

## Routes

POST /auth/email/confirm (email,code) : session après confirmation.
POST /auth/email/resend (email) : renvoi de code.
POST /auth/password-recovery/code (email) : envoi de code (réponse uniforme).
POST /auth/password-reset/code (email,code,password) : nouveau mot de passe.
GET /auth/email/status (JWT) : statut.
POST /auth/email/change/request (JWT,newEmail,password) : code vers nouvelle adresse.
POST /auth/email/change/confirm (JWT,code) : applique l'adresse confirmée.


## Brancher Resend (sans changer le code)

Le backend KnowMe envoie directement via \`POST https://api.resend.com/emails\`.
Aucune librairie supplémentaire n'est requise. Configurer les secrets **sur l'API
NestJS déployée sur le VPS**, pas seulement sur le projet Vercel qui héberge le site.

1. Créer/autoriser un compte Resend : https://resend.com/signup
2. Dans https://resend.com/api-keys, générer une clé limitée à l'envoi.
3. Définir dans le gestionnaire de secrets de l'API :
   - \`RESEND_API_KEY\` : valeur secrète de la clé d'envoi.
   - \`EMAIL_OTP_SECRET\` : valeur secrète aléatoire de 32+ caractères, distincte du JWT.
   - \`RESEND_FROM_EMAIL\` : identité expéditeur sur **un domaine dont on contrôle le DNS**
     et qui est vérifié dans https://resend.com/domains (ex. \`KnowMe <security@domaine-possédé>\`).
4. Dans la zone DNS du domaine, appliquer exactement les enregistrements indiqués par
   Resend pour DKIM/SPF (et DMARC). Vérifier que Resend indique l'envoi autorisé.
5. Appliquer la migration Prisma, redémarrer l'API et tester l'inscription d'un
   compte sur une vraie boîte email ; contrôler les logs d'envoi dans Resend.

### Démarrage gratuit sans domaine — **tests uniquement**

Resend fournit \`onboarding@resend.dev\` pour envoyer à **l'adresse du compte
Resend uniquement**. Cela ne permet pas de faire fonctionner l'inscription publique.
Afin de ne pas tromper les utilisateurs, KnowMe refuse toute autre destination
avec cet expéditeur. Activer temporairement sur une API de test seulement :

\`\`\`dotenv
RESEND_API_KEY="(secret stocké sur le serveur)"
RESEND_FROM_EMAIL="KnowMe <onboarding@resend.dev>"
KNOWME_EMAIL_TEST_MODE="true"
RESEND_TEST_RECIPIENT="adresse-du-compte-resend@example.com"
EMAIL_OTP_SECRET="(secret aléatoire de 32 caractères minimum)"
\`\`\`

Ne jamais exposer les secrets, créer un compte Resend à la place de son
propriétaire, ni configurer un faux domaine non vérifié. Les domaines Vercel
\`.vercel.app\` ne donnent pas le contrôle DNS nécessaire à une vérification Resend.

### Limitations et tests d'acceptation

- La création de clé et la vérification du domaine requièrent l'intervention de
  l'administrateur Resend / DNS ; aucun connecteur Resend n'est installé.
- Un appel API accepté ne prouve pas la livraison dans la boîte : vérifier le
  statut Resend et la réception réelle.
- Ne pas déployer la vérification obligatoire avant que le domaine, les
  identifiants, la base de données, les tests et l'APK soient prêts.

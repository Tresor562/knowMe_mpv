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

# Sécurité renforcée

## Ajouts

- limitation globale des requêtes ;
- limites plus strictes sur inscription, connexion et renouvellement ;
- sessions persistantes ;
- refresh tokens opaques ;
- rotation du refresh token ;
- révocation d’une session ;
- déconnexion de toutes les sessions ;
- refus de connexion pour les comptes suspendus.

## Routes

- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/sessions`
- `DELETE /auth/sessions/:id`

## Production

À renforcer avant lancement :

- cookies HttpOnly et Secure pour le refresh token ;
- CSRF si authentification par cookies ;
- rotation des secrets JWT ;
- détection d’activité anormale ;
- alertes de nouvelle connexion ;
- stockage d’IP conforme à la politique de confidentialité.

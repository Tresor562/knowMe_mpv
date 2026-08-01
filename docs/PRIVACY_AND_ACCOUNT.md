# Vie privée et gestion du compte

## Routes

- `PATCH /account/profile`
- `GET /account/export`
- `DELETE /account`

## Export

L’export renvoie un document JSON contenant :

- profil ;
- centres d’intérêt ;
- publications ;
- commentaires et mentions J’aime ;
- participations aux défis ;
- messages ;
- conversations ;
- relations ;
- notifications ;
- métadonnées de sessions.

Le hash du mot de passe n’est jamais exporté.

## Suppression

La suppression exige le mot de passe actuel.

Les relations configurées avec `onDelete: Cascade` sont supprimées avec le compte.

## Attention juridique

La page de confidentialité incluse est un brouillon technique. Elle doit être adaptée aux pays visés et validée avant tout lancement public.

# Intelligence KnowMe — MVP

Cette première version ne dépend pas d’un modèle externe.

Elle calcule une compatibilité à partir de :

- centres d’intérêt communs ;
- réponses identiques aux défis ;
- complétude des profils.

## Routes

- `PUT /intelligence/interests`
- `GET /intelligence/interests`
- `GET /intelligence/compatibility/:userId`
- `GET /intelligence/recommendations`
- `GET /intelligence/suggested-challenges`

## Limites

Le score est heuristique. Il ne doit pas être présenté comme une analyse psychologique scientifique.

Une future version pourra intégrer :

- embeddings ;
- recommandations collaboratives ;
- génération de questions ;
- modération ;
- résumés de profils.

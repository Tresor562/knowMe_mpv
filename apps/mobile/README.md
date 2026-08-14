# KnowMe Mobile

Application Expo/React Native de KnowMe.

## Démarrage local

1. Copier `.env.example` vers `.env`.
2. Adapter `EXPO_PUBLIC_API_URL` à l’environnement utilisé.
3. Depuis la racine du monorepo, lancer `pnpm install`.
4. Démarrer l’API avec `pnpm --filter @knowme/api dev`.
5. Démarrer Expo avec `pnpm --filter @knowme/mobile dev`.

Sur un téléphone physique, `localhost` pointe vers le téléphone. Utiliser donc l’adresse IP locale de l’ordinateur qui exécute l’API, par exemple `http://192.168.1.20:4000`.

## Vérification TypeScript

```bash
pnpm --filter @knowme/mobile build
pnpm --filter @knowme/mobile test
```

Ces commandes exécutent le contrôle TypeScript et les tests purs du client Mobile. Elles font partie de la CI du monorepo.

## Préparation des appels

L’écran « Préparer mes appels » est accessible depuis l’accueil. Il synchronise les mêmes préférences de disponibilité versionnées que le Web et ne demande les permissions microphone/caméra qu’après l’action « Tester mes appareils ».

- l’aperçu caméra reste local et ne capture ni photo ni vidéo ;
- le choix caméra avant/arrière n’est ni envoyé ni persisté ;
- le système mobile conserve le contrôle du microphone et de la sortie audio actifs ;
- les messages natifs de permission sont configurés par le plugin `expo-camera`, donc leur modification exige un nouveau binaire natif.

## Builds EAS

Avant le premier build :

```bash
npx eas-cli login
npx eas-cli init
```

La commande `eas init` remplacera la valeur temporaire `REPLACE_WITH_EAS_PROJECT_ID` dans `app.json`.

Profils disponibles :

```bash
npx eas-cli build --profile development --platform android
npx eas-cli build --profile preview --platform android
npx eas-cli build --profile production --platform all
```

Le profil `preview` produit un APK Android installable pour les tests internes. Le profil `production` est destiné aux boutiques.

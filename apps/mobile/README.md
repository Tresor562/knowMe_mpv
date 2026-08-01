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
```

Cette commande exécute `tsc --noEmit` et fait partie de la CI du monorepo.

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

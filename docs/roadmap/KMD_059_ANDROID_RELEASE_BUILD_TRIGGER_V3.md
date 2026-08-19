# KMD-059 Android standalone release build trigger v3

This technical-only branch exists to force a fresh Android release build after fixing the Expo monorepo entrypoint and building the internal Mobile contract packages before Metro bundling.

The generated APK must embed the JavaScript bundle and start without Metro. No product, API, schema, permission, entitlement, Nexus, legal, or security-boundary change is introduced.

Build trigger revision: 2.

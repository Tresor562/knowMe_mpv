# KnowMe — audit de santé des versions publiques

**Domaine :** `infra` · Issue [#698](https://github.com/Tresor562/knowMe_mpv/issues/698).

## Ce qui est vraiment testé

Le workflow `KnowMe public release health audit` interroge uniquement en HTTPS et lecture seule :
- version de l'API et état PostgreSQL depuis le VPS ;
- version Web autohébergée depuis le VPS ;
- version Web de `knowme-nextech.vercel.app` (Vercel) ;
- manifeste de mises à jour Android autohébergé.

Il compare les identités de commit, versions et révisions du contrat lorsque disponibles.
Il signale les erreurs de réseau, formats JSON dangereux, URL de téléchargement APK non
canoniques, absence de release et désynchronisations distinctes Web VPS / Web Vercel.

## Ne pas confondre diagnostic et publication

- **healthy** : métadonnées des endpoints cohérentes, *pas* une preuve de publication mobile réussie.
- **degraded** : avertissement, par exemple Vercel décalé, mise à jour Android non annoncée,
  ou politique de déploiement Web non vérifiée.
- **critical** : API ou base indisponible, manifeste Android invalide, ou divergence du Web VPS
  alors que sa publication est explicitement déclarée activée.

La variable GitHub Actions `KNOWME_WEB_DEPLOY_ENABLED` ne reflète pas automatiquement le VPS.
En l'absence de valeur sûre (`true` ou `false`), l'audit utilise l'état **unknown** : ne jamais
inventer que le site Web VPS est suspendu. Même configurée, cette valeur ne prouve pas
l'état effectif de `/opt/nex/...` sur le VPS. Vérifier les logs du timer et sa configuration
avant de lever le gel Web.

Un audit ne vérifie **ni la signature ni les octets de l'APK téléchargée**, la notification
Android, les installations réelles, la disponibilité du site sur un téléphone, ni la
protection GitHub `main`. Utiliser les tests de distribution Android, les preuves
de signatures et un appareil réel ; l'issue [#703](https://github.com/Tresor562/knowMe_mpv/issues/703)
reste ouverte pour la protection obligatoire de `main`.

## Exécution

Lancer `node --test scripts/knowme-release-health-audit.test.mjs` pour les tests locaux.
Le workflow sur `main` propose un lancement manuel ou une collecte toutes les six heures.
Chaque exécution sauvegarde un JSON horodaté et un résumé lisible dans GitHub Actions.
Sur PR, seules les vérifications isolées sont lancées, sans appel de déploiement.

**Retour arrière :** retirer le workflow et le script (aucune migration ni écriture en
production). La publication Web/APK continue d'utiliser les mécanismes existants.

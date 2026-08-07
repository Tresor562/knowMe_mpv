Before modifying this repository, read `/AGENTS.md` and `/docs/NEXUS_INTEGRATION_CHECKPOINT.md` completely, then inspect current `main`, open PRs, active branches, and CI.

Canonical KnowMe repository: `Tresor562/knowMe_mpv`.
Do not substitute `knowMe_secret` for the Nexus integration.

At the 2026-08-07 checkpoint, KMD-057 / PR #101 and KMD-058 / PR #102 are unfinished. Never add Nexus integration code to those branches. Finish and validate KnowMe core work first.

Nexus AI core lives in `Tresor562/Nexus-Ai-` and owns reusable AI-side contracts. Final app-side Nexus integration belongs on dedicated integration branches from then-current stable `knowMe_mpv/main`, after reading both repositories' continuity documents.

If remembered conversation context conflicts with live GitHub state, live GitHub state plus repository continuity documents win.

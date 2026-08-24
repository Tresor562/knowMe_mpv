# KMD-222 — Trusted proxy release hardening

## Goal

Make client-IP attribution used by Express/NestJS explicit before a market release, so rate limiting and any IP-derived abuse controls do not silently depend on deployment topology assumptions.

## Delivered

- `TRUSTED_PROXY_HOPS` is parsed as a bounded integer from 0 through 5.
- Production startup fails closed when the value is missing or invalid.
- Development/test keeps the conservative Express default (`0`, trust no proxy hops) when omitted.
- The configured value is applied to Express `trust proxy` before request middleware is registered.
- `pnpm check:release` now verifies that a market-release environment made an explicit trusted-proxy choice.
- Unit and release-preflight tests cover direct deployments, bounded reverse-proxy topologies, missing configuration and ambiguous/unsafe values.

## Deployment choice

`TRUSTED_PROXY_HOPS=0` means the API is reached directly and forwarded client-address headers are not trusted.

A positive value means exactly that many reverse-proxy hops are trusted. Operators must determine the actual ingress topology before setting it. Do not copy a value from another environment.

## Security boundary

A numeric hop policy is only safe when the API cannot be reached through a shorter untrusted path than the configured topology. KMD-222 does not prove firewall rules, private ingress, CDN/load-balancer configuration, Kubernetes ingress configuration, or proxy header rewriting in the real deployment.

It also does not provide a distributed multi-instance throttling store, WAF/DDoS protection or load-test-derived rate limits. Those remain separate release/infrastructure evidence gates.

## Migration

No Prisma migration and no persisted user-data change.

Before release:

1. map every network path from public client to the API;
2. choose `TRUSTED_PROXY_HOPS` explicitly for that environment;
3. ensure direct/shorter untrusted access to the API is blocked when the value is greater than zero;
4. run `pnpm check:release`;
5. validate client-IP attribution in the actual deployed topology before relying on it for abuse controls.

## Rollback

Revert KMD-222 and remove `TRUSTED_PROXY_HOPS` from release configuration. Express then returns to its previous default behavior. Do not use rollback as a substitute for correcting a misconfigured production ingress.

## Evidence not claimed

KMD-222 does **not** claim that production proxy topology, firewall rules, CDN behavior, source-IP preservation, WAF/DDoS controls, distributed throttling or deployed 429 monitoring have been physically validated.

# KMD-225 — Production HTTPS request guard

## Goal

Prevent a market release from serving normal API traffic over cleartext HTTP when TLS termination or trusted-proxy forwarding is misconfigured.

KnowMe already sends HSTS in production, but HSTS is a response policy and does not itself prove that the current request arrived through HTTPS. KMD-225 adds a runtime request boundary after Express `trust proxy` is configured so that `request.secure` reflects the deployment's explicitly trusted proxy topology.

## Changes

- production API requests must be recognized as secure by Express or they receive a fixed `426 HTTPS_REQUIRED` response;
- the guard is installed after `trust proxy` configuration and before CORS, security headers and HTTP observability middleware;
- the response never redirects or reflects the original URL, preventing reset tokens, query parameters or other sensitive request data from being copied into a `Location` header or error body;
- `/health`, `/health/live` and `/health/ready` remain available to internal cleartext health probes;
- `/health/metrics` is not exempt and remains subject to HTTPS plus its existing authentication/authorization boundary;
- non-production environments are unchanged.

## Security rationale

A production deployment may terminate TLS at a load balancer or reverse proxy. KMD-222 already requires the trusted-proxy hop count to match the real topology. KMD-225 consumes that trusted Express result instead of trusting `X-Forwarded-Proto` directly.

If the proxy topology is wrong or the request reaches the API without a trusted HTTPS indication, normal API traffic fails closed instead of silently accepting credentials, recovery tokens or user data over cleartext transport.

## Tests

Unit coverage proves that:

- non-production traffic remains unaffected;
- secure production requests continue normally;
- cleartext production application requests fail with `426 HTTPS_REQUIRED`;
- the fixed failure body does not reflect a sensitive token from the request URL;
- only the three internal health endpoints are exempt;
- metrics are not exempt.

## Migration

No Prisma migration and no persisted user-data change.

Operationally, a production environment behind TLS termination must configure `TRUSTED_PROXY_HOPS` to the verified number of trusted proxy hops so Express can derive `request.secure` from the trusted forwarding chain. Direct public cleartext access to the application port must be blocked by infrastructure.

## Rollback

Revert KMD-225. Existing HSTS and trusted-proxy controls remain, but the API would again lack an application-level fail-closed check for cleartext production requests.

## Deliberate boundary

This milestone does not provision certificates, configure a CDN/load balancer/firewall, prove the production proxy chain, test real DNS/TLS, or guarantee that the application port is unreachable from the public Internet. Those remain infrastructure validations and must not be claimed without evidence from the target environment.

## Merge gate

Merge only after the exact PR head passes the repository CI gate: production dependency audit, Prisma generation, migration deploy, zero drift, complete monorepo build, root tests, Chromium Web E2E and PostgreSQL API E2E.

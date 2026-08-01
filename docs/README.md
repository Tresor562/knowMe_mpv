# Documentation KnowMe

## Références principales

- [Master Product Specification V2](./KNOWME_MASTER_PRODUCT_SPECIFICATION_V2.md) — vision officielle, principes, domaines et roadmap globale.
- [Foundation Blueprint](./architecture/FOUNDATION_BLUEPRINT.md) — frontières techniques et ordre de construction des fondations.
- [Product Roadmap V2](./roadmap/PRODUCT_ROADMAP_V2.md) — phases, livrables et critères de sortie.

## Architecture Decision Records

- [ADR-001 — Staff, rôles et vérification](./adr/ADR-001-STAFF-TRUST-AND-VERIFICATION.md)
- [ADR-002 — Abonnements, paiements et droits](./adr/ADR-002-BILLING-AND-ENTITLEMENTS.md)
- [ADR-003 — Registre KnowCoins](./adr/ADR-003-KNOWCOINS-LEDGER.md)
- [ADR-004 — Concept K et moteur d’expérience](./adr/ADR-004-CONCEPT-K-EXPERIENCE-ENGINE.md)
- [ADR-005 — Feature flags et livraison progressive](./adr/ADR-005-FEATURE-FLAGS-AND-PHASED-ROLLOUT.md)

## Règle de maintenance

Toute nouvelle fonctionnalité majeure doit :

1. être reliée à une phase de la roadmap ;
2. respecter les ADR existants ;
3. ajouter un ADR si elle introduit une décision architecturale durable ;
4. décrire ses risques de sécurité, vie privée, performance et exploitation ;
5. inclure des critères de validation avant développement.
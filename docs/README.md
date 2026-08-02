# Documentation KnowMe

## Références principales

- [Master Product Specification V2](./KNOWME_MASTER_PRODUCT_SPECIFICATION_V2.md) — vision officielle, principes, domaines et roadmap globale.
- [Foundation Blueprint](./architecture/FOUNDATION_BLUEPRINT.md) — frontières techniques et ordre de construction des fondations.
- [Product Roadmap V2](./roadmap/PRODUCT_ROADMAP_V2.md) — phases, livrables et critères de sortie.
- [Registre canonique des livraisons](./roadmap/DELIVERY_LEDGER.md) — identifiants `KMD`, PR fusionnées et prochaine livraison réservée.
- [Implementation Backlog](./roadmap/IMPLEMENTATION_BACKLOG.md) — backlog historique ; ses anciens labels `KM-###` sont désormais interprétés comme des références `KMB-###`.

## Architecture Decision Records

- [ADR-001 — Staff, rôles et vérification](./adr/ADR-001-STAFF-TRUST-AND-VERIFICATION.md)
- [ADR-002 — Abonnements, paiements et droits](./adr/ADR-002-BILLING-AND-ENTITLEMENTS.md)
- [ADR-003 — Registre KnowCoins](./adr/ADR-003-KNOWCOINS-LEDGER.md)
- [ADR-004 — Concept K et moteur d’expérience](./adr/ADR-004-CONCEPT-K-EXPERIENCE-ENGINE.md)
- [ADR-005 — Feature flags et livraison progressive](./adr/ADR-005-FEATURE-FLAGS-AND-PHASED-ROLLOUT.md)

## Règle de maintenance

Toute nouvelle fonctionnalité majeure doit :

1. recevoir un identifiant canonique `KMD-###` non réutilisable ;
2. être reliée à une phase de la roadmap ;
3. respecter les ADR existants ;
4. ajouter un ADR si elle introduit une décision architecturale durable ;
5. décrire ses risques de sécurité, vie privée, performance et exploitation ;
6. inclure des critères de validation avant développement ;
7. être ajoutée au registre des livraisons après fusion.
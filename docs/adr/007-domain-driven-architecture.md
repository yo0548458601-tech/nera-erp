# ADR-007 — Domain Driven Architecture

**Status:** Accepted
**Date:** 2026-07-09
**Migration note:** Originally recorded as `ADR-0002` in `docs/decisions/ADR-0002-domain-driven.md` during the Foundation Phase, with header status `Proposed`. Migrated here as **Accepted**, correcting a stale status label: `docs/CORE_PLATFORM_BLUEPRINT.md` already listed this ADR among the "approved foundation" documents "binding for all future development," and every later document in this repository (including `NERA_CONSTITUTION.md`'s "Modular by Design" and "No Business Logic Duplication" principles) already treats it as decided. This migration corrects the label to match what was already true; it does not introduce a new decision. The original approval date is preserved. `docs/decisions/ADR-0002-domain-driven.md` now redirects here.

---

## Context

Nera is designed as a platform for many business capabilities. As the platform grows, business functionality must remain organized, independently maintainable and safe to evolve.

The architecture must ensure that business capabilities are separated by clear boundaries so that modules can grow without creating hidden coupling. Without explicit domain boundaries, the platform would become difficult to extend, difficult to test, and difficult to reason about.

## Decision

Nera organizes business capabilities using a domain-driven architecture. Each business capability belongs to exactly one domain. Each domain owns its business rules, its persistence layer, its public interfaces, and its internal implementation details.

- Domains must not access another domain's database directly.
- Communication between domains happens only through public services.
- Shared utilities are allowed only inside shared infrastructure packages.
- Circular dependencies are forbidden.
- Every module must be independently testable.
- Every module should be removable without breaking unrelated modules.
- AI agents must communicate with modules exactly like any other client.
- This structure must preserve the possibility of future microservice extraction.

## Consequences

**Benefits:** clear ownership of business behavior; strong modular boundaries; better testability; safer evolution over time; easier future extraction to services; reduced coupling between capabilities.

**Trade-offs:** more explicit interfaces; more discipline required during implementation; slightly more upfront design effort.

### Example Domain Boundaries

Customer domain, Sales domain, Inventory domain, Finance domain, Projects domain, HR domain — each owns its own rules and data model. If the Sales domain needs customer information, it uses a public service or approved interface rather than reading customer tables directly.

### Best Practices

- Give each domain a clear business purpose.
- Keep domain logic inside the domain.
- Expose only explicit public services.
- Put shared cross-cutting concerns in shared infrastructure packages.
- Keep dependencies one-way.
- Model behavior around business intent rather than technical convenience.
- Design modules so they can be tested in isolation.
- Keep public contracts stable and well documented.

### Anti-patterns

- A domain reading another domain's database tables directly.
- Shared business logic copied into multiple modules.
- Circular dependencies between modules.
- A module depending on another module's internal implementation.
- Business rules spread across unrelated modules.
- A module that cannot be tested without the entire platform.

## Alternatives Considered

No alternative to domain-driven organization is recorded in the original ADR. The anti-patterns list above functions as the implicit rejected alternative: a platform without explicit domain boundaries, where business logic and data access are not owned by a single, clear domain.

## Follow-up Actions

When introducing a new domain (business module):

1. Define its business boundary clearly.
2. Assign ownership of its rules and persistence.
3. Define public services for integration.
4. Keep shared utilities outside the domain.
5. Ensure the domain can be tested independently.
6. Preserve the ability to extract it later if needed.

Existing modules should be reviewed for boundary violations before being expanded. `docs/MODULE_MAP.md` records each module's engine dependencies and boundaries per this ADR going forward.

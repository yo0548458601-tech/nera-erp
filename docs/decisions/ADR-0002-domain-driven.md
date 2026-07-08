# ADR-0002 — Domain Driven Architecture

Status: Proposed

Date: 2026-07-09

---

# Context

Nera is designed as a platform for many business capabilities.

As the platform grows, business functionality must remain organized, independently maintainable and safe to evolve.

The architecture must ensure that business capabilities are separated by clear boundaries so that modules can grow without creating hidden coupling.

Without explicit domain boundaries, the platform would become difficult to extend, difficult to test and difficult to reason about.

---

# Decision

Nera will organize business capabilities using a domain-driven architecture.

Each business capability belongs to exactly one domain.

Each domain owns:

- Its business rules
- Its persistence layer
- Its public interfaces
- Its internal implementation details

Domains must not access another domain's database directly.

Communication between domains happens only through public services.

Shared utilities are allowed only inside shared infrastructure packages.

Circular dependencies are forbidden.

Every module must be independently testable.

Every module should be removable without breaking unrelated modules.

AI agents must communicate with modules exactly like any other client.

This structure must preserve the possibility of future microservice extraction.

---

# Consequences

Benefits:

- Clear ownership of business behavior
- Strong modular boundaries
- Better testability
- Safer evolution over time
- Easier future extraction to services
- Reduced coupling between capabilities

Trade-offs:

- More explicit interfaces
- More discipline required during implementation
- Slightly more upfront design effort

---

# Examples

Example domain boundaries:

- Customer domain
- Sales domain
- Inventory domain
- Finance domain
- Projects domain
- HR domain

Each domain owns its own rules and data model.

If the sales domain needs customer information, it must use a public service or approved interface rather than reading customer tables directly.

---

# Best Practices

- Give each domain a clear business purpose.
- Keep domain logic inside the domain.
- Expose only explicit public services.
- Put shared cross-cutting concerns in shared infrastructure packages.
- Keep dependencies one-way.
- Model behavior around business intent rather than technical convenience.
- Design modules so they can be tested in isolation.
- Keep public contracts stable and well documented.

---

# Anti-patterns

- A domain reading another domain's database tables directly.
- Shared business logic copied into multiple modules.
- Circular dependencies between modules.
- A module depending on another module's internal implementation.
- Business rules spread across unrelated modules.
- A module that cannot be tested without the entire platform.

---

# Migration Notes

When introducing a new domain:

1. Define its business boundary clearly.
2. Assign ownership of its rules and persistence.
3. Define public services for integration.
4. Keep shared utilities outside the domain.
5. Ensure the domain can be tested independently.
6. Preserve the ability to extract it later if needed.

Existing modules should be reviewed for boundary violations before being expanded.

---

# Final Note

Domain boundaries are architectural safeguards.

They protect maintainability, testability and long-term platform evolution.

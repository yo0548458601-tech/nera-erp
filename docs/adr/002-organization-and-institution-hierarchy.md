# ADR-002 — Organization and Institution Hierarchy

**Status:** Accepted
**Date:** 2026-07-19

---

## Context

Milestone 1's first draft of the product blueprint treated "tenant," "institution," and "organization" as roughly interchangeable, and at one point proposed row-level security keyed on `institution_id`. This was flagged as an open decision because the existing schema (from P004) already models `Organization`, `OrganizationUnit`, and `OrganizationMembership`, with `organization_id` as the scoping column throughout, and because not every customer of the platform will use the concept of an "institution" at all (a commercial company or a municipality, per `PROJECT_VISION.md`'s target audience, may have no reason to subdivide itself that way). Treating `institution_id` as the tenant boundary would have been wrong for those customers and would have contradicted the already-implemented schema.

The owner resolved this ambiguity directly, and this ADR records that resolution.

## Decision

1. **Organization is the tenant and the primary security boundary.** Every tenant-owned record is scoped by `organization_id`. Row Level Security is, and remains, keyed on `organization_id` — not `institution_id`.
2. **An Organization may contain one or more Institutions.** Institution is an optional business hierarchy _below_ the Organization, not an alternative or replacement tenant concept:

   ```
   Organization
   ├── Institution
   ├── Institution
   └── Institution
   ```

3. **The platform must support organizations that do not use the concept of an institution at all.** Institution is optional business structure, not a mandatory layer every organization must populate.
4. Records that belong to a specific institution **may** carry `institution_id` **in addition to** `organization_id` — never instead of it.
5. **`institution_id` must never be trusted without also validating organization ownership.** Any query or access check that filters by `institution_id` must also confirm that institution belongs to the caller's `organization_id`; `institution_id` alone is never sufficient to establish tenant isolation, since a future implementation bug that omits the organization check would otherwise leak data across organizations that happen to reuse institution identifiers or IDs.
6. **No schema migration is performed in this milestone.** This ADR documents the intended hierarchy; implementation (adding an `institutions` table, adding optional `institution_id` columns where relevant, and the associated RLS policy work) is left for a future approved sprint. The existing P004 schema (`Organization`, `OrganizationUnit`, `OrganizationMembership`) is unchanged by this ADR.

## Consequences

- Every engine and module design produced from this point forward treats `organization_id` as the mandatory tenant-scoping column and `institution_id` as an optional, secondary, organization-validated scoping column — never as a replacement.
- `docs/ENGINE_MAP.md`'s "Tenant / Institution" engine entry, and every reference elsewhere in the blueprint to a "tenant/institution boundary," must be corrected to say "Organization boundary" for tenant isolation, with Institution described separately as an optional sub-hierarchy.
- A future sprint (not scheduled by this ADR) must design and implement: an `institutions` table under `Organization`, optional `institution_id` columns on the record types that need institution-level scoping, and the specific query/RLS pattern that enforces rule 5 above.
- Until that future sprint, no engine or module may introduce `institution_id` as a security boundary, and no RLS policy may key on `institution_id` alone.

## Alternatives Considered

- **`institution_id` as the tenant boundary** (the direction implied by Milestone 1's first draft) — rejected. It does not fit organizations that don't use institutions at all, and it does not match the already-implemented `Organization`-based schema.
- **Institution as a fully separate, parallel tenant concept** (an org and an institution both independently top-level) — rejected. It would double the tenant-isolation surface to secure and reason about, for a hierarchy relationship (`Organization` contains `Institution`) that is naturally a parent/child structure, not two independent boundaries.
- **Renaming `Organization` to `Institution` everywhere** — rejected. `Organization` already exists as the implemented tenant table from P004; renaming it would be a schema change, and this milestone explicitly performs no schema migration.

## Follow-up Actions

- Correct every Milestone 1 document (`NERA_CONSTITUTION.md`, `PRODUCT_VISION.md`, `ROADMAP.md`, `ENGINE_MAP.md`, `MODULE_MAP.md`) to reflect Organization as the tenant boundary and Institution as an optional child hierarchy, per the Milestone 1 update that accompanies this ADR.
- Schedule the schema/RLS implementation described in Decision item 6 as its own sprint once approved — candidate placement is the `Tenant / Institution` engine work already on `ROADMAP.md`, but the exact sprint number is not fixed by this ADR.
- P008 must not introduce `institution_id`-keyed RLS; any P008 work touching `Organization` must be consistent with this ADR.

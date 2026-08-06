# ADR-013 — Document Engine V1 Product Policy

**Status:** Accepted
**Date:** 2026-08-02

---

## Context

`ADR-011` (Storage Provider Selection) and `ADR-012` (PDF Generation Approach) resolved the
Document Engine's infrastructure and rendering architecture, but explicitly left five genuine
product decisions open, required before a P014 Implementation Prompt could be prepared: allowed
file types, maximum upload size, deletion/retention behavior, the document-to-record linking
model, and the default signed-download URL expiration. The Owner has now approved all five. This
ADR is the durable record of those decisions — `ENGINE_MAP.md` and `ROADMAP.md` are updated
alongside it, but this ADR is the source of truth for the decisions themselves, per
`NERA_CONSTITUTION.md` §9.6/§13 and `NERA_ARCHITECTURAL_INVARIANTS.md` §16.

These decisions govern P014 and are binding on every downstream consumer (P017 Purchase Orders,
P018 Invoices, P019 Payment Approval & Payments, and any later module attaching files) unless a
future ADR explicitly supersedes them, per `NERA_CONSTITUTION.md` §9.7/§12.

## Decision

### A. Allowed file types (P014 V1)

**Allowed:** PDF, JPG/JPEG, PNG, DOCX, XLSX.

**Not allowed in P014 V1:** executable files; scripts; HTML; SVG; macro-enabled Office formats
(DOCM, XLSM); any format not explicitly on the allowlist above. The allowlist is closed, not
open-by-default — a new format requires its own future decision, not an implicit extension.

Validation is defense-in-depth, matching the "minimal upload-time protection" baseline already
established during P014's scoping: the client-supplied extension and declared `Content-Type` are
never trusted alone. The server validates the extension, the declared content type, **and** the
file signature/magic bytes where the format supports reliable signature verification (PDF, JPG,
PNG, and the ZIP-based OOXML container both DOCX and XLSX use all have verifiable signatures;
where a specific sub-check is not reliably possible, extension + declared-type validation still
apply). Full antivirus/malware scanning remains outside P014 V1 and is not silently introduced
under cover of this decision — it remains a distinct, separately-scoped future capability.

### B. Maximum upload size

**25 MB per file**, server-enforced. A rejected oversized upload must not leave an available
Document record or an accessible physical object — this is the same "no orphan, no premature
availability" discipline `ADR-011`'s internal `uploading`/`available`/`failed` lifecycle already
establishes; an oversized file fails validation before a row is ever created as `available`, and
any partially-written object is cleaned up by the same compensation/reconciliation path `ADR-011`
Decision item 5 defines. No new lifecycle state is introduced by this decision.

### C. Deletion and retention

Three distinct, explicitly separated behaviors:

1. **Normal deletion** immediately: revokes all access; prevents any new signed URL from being
   issued; marks the document deleted through the project's normal soft-delete model
   (`deleted_at`, matching `NERA_CONSTITUTION.md` §7.4's default deletion strategy and every other
   soft-deleted table in the repository); and **retains the physical object temporarily** for
   recovery. The ordinary delete path **must never silently become an immediate physical purge.**
2. **Recovery period: 30 days from deletion.** During this window, an appropriately authorized
   user may restore the document, reversing the soft-delete and restoring access.
3. **After 30 days**, the physical object becomes eligible for permanent deletion.
4. **Administrator hard delete** — an appropriately authorized administrator may permanently
   delete a document before the 30-day window ends, but only through an explicit, distinct
   hard-delete action that: presents a clear irreversible-action warning and requires explicit
   confirmation; is fully recorded in the Audit Log (`NERA_CONSTITUTION.md` §6.5's "nothing an
   administrator does is invisible"); and deletes the physical object, making restoration
   impossible. This is a deliberately separate code path from normal deletion, not a flag on it —
   the same "hard delete is an explicit, authorized, audited exception, never the default"
   principle `NERA_CONSTITUTION.md` §7.4 already states for every other table.
5. P014 implements and tests the retention/purge service (or maintenance command) that enforces
   the 30-day eligibility window. Consistent with `ADR-011`'s established infrastructure boundary
   (Decision item 12), **wiring this service's recurring production schedule is P025's job**,
   unless the Owner separately approves an earlier infrastructure/scheduling decision — P014 ships
   a tested, working, idempotent service with no production schedule attached to it yet, exactly
   as `ADR-011`'s reconciliation service does.

### D. Generic document-to-record linking

A single physical Document may be linked to more than one business record, through a **generic,
module-agnostic many-to-many linking model** — never a single invoice-specific,
purchase-order-specific, or payment-specific foreign key placed directly on the Document. The
Document Engine remains ignorant of business concepts such as "Invoice" or "Purchase Order",
per `NERA_CONSTITUTION.md` §3.1 (Platform First) and §12 (no industry-specific concept inside a
Core Engine) — the same principle `ADR-012` Decision item 7 already applies to PDF templates.

The durable link record must carry information equivalent in meaning to: the Document's id; the
target record's type; the target record's id; the organization scope; and the relevant timestamps
and deletion state. **The exact schema, table/column naming, and Prisma model shape are not fixed
by this ADR** — they are finalized in the P014 implementation plan, following the repository's
already-verified conventions (English, `snake_case`, pluralized tables; `organization_id`
mandatory with `FORCE ROW LEVEL SECURITY` and an `*_organization_isolation` policy, per
`NERA_ARCHITECTURAL_INVARIANTS.md` §3.5; `created_at`/`updated_at`/soft-delete `deleted_at`, per
§4.3) — this ADR fixes the _model_, not the _DDL_.

Requirements binding on the P014 implementation:

- One physical Document can be linked to multiple records without duplicating the underlying file
  or its storage object.
- Duplicate identical links (the same Document linked twice to the same target record) are
  prevented.
- Every link is tenant-scoped (`organization_id`) and authorization-checked like any other
  mutation — `checkPermission()` inside `getOrganizationContext`, per the established P013A/P013B
  pattern.
- Removing one link must never silently delete the physical Document while other valid links to it
  remain — the Document's own lifecycle (Decision item C above) is independent of any single link's
  lifecycle.
- Downstream modules (Purchase Orders, Invoices, Payments, and any future consumer) use the
  Document Engine's own contract to create/query/remove links — they never manipulate storage
  directly, matching the same "no engine bypass" rule `ADR-011` and `ADR-012` already establish.

### E. Signed-download URL expiration

**Default: 15 minutes (900 seconds).** A signed URL is created only after, in order: permission
verification (`checkPermission()`); organization/tenant ownership verification (the requested
Document's `organization_id` matches the caller's); and confirmation that the Document's status is
`available` and not deleted — the same three-part authorization gate `ADR-011` Decision item 7
already requires, restated here as a product-level default rather than introduced as a new
mechanism. No permanent, public, or unsigned Document URL is ever stored or returned, matching
`ADR-011` Decision item 16.

## Consequences

- P014's implementation plan can now be written against a complete, closed set of product
  requirements — no remaining "Owner must decide" placeholder blocks it.
- The three-tier deletion model (soft-delete → 30-day recovery → eligible purge, with a distinct
  administrator hard-delete escape hatch) adds real implementation surface: a status/timestamp
  distinguishing "deleted, recoverable" from "purged", a restore action, and a separate,
  heavily-guarded hard-delete action — this is accepted complexity, not deferred or simplified
  away, because the alternative (a single delete action with no recovery window) does not match
  the Owner's approved behavior.
- The generic many-to-many linking model means P014 ships a link table/model that no module uses
  yet (Suppliers/Purchase Orders/Invoices are all still unbuilt) — an intentional "build the shared
  primitive once, correctly" choice consistent with Platform First, not speculative
  overengineering, since P017/P018/P019 are already roadmapped to need it.
- The 25 MB limit and closed file-type allowlist are V1 defaults; a future sprint may revisit
  either via its own scoped decision (not necessarily a full ADR, unless it becomes a stack/vendor
  question) once real usage data exists.
- Retention/purge scheduling remaining P025's responsibility means P014's 30-day window is
  correctly enforced by application logic and testable on demand, but does not actually run on a
  timer in production until P025 wires it — an accepted, explicit gap, not an oversight.

## Alternatives Considered

- **A broader or fully open file-type allowlist** — rejected; every additional format is
  additional attack surface (per the file-signature-validation discipline already required), and
  the Owner-approved five formats cover P014's known V1 consumers (PDF/JPG/PNG for
  scans/photos/attachments, DOCX/XLSX for supplier-provided documents).
- **A larger or unlimited upload size** — rejected; 25 MB is a deliberate, explicit server-enforced
  ceiling, not a default inherited from a library or framework.
- **Immediate hard deletion on every delete action** — rejected; provides no recovery window and
  contradicts `NERA_CONSTITUTION.md` §7.4's soft-delete default.
- **No administrator override / hard-delete path at all** — rejected; `NERA_CONSTITUTION.md` §6.5
  explicitly permits an administrator to always delete data, subject to authorization and full
  audit — omitting this path would under-deliver the Constitution's own stated administrator
  capability.
- **A single foreign key on the Document row pointing at one business record** — rejected;
  forecloses the explicitly-required one-Document-to-many-records case, and would force a future
  migration once P017/P018 both need to reference the same document (e.g., a single scanned
  contract attached to both a Purchase Order and its resulting Invoice).
- **A longer or shorter default signed-URL expiration** — 15 minutes was chosen as a working
  default balancing usability (enough time to view/download without repeated re-authorization)
  against exposure window; not extensively benchmarked, and revisitable as an implementation-level
  tuning decision without requiring a new ADR, since it does not change the architecture in
  `ADR-011`/`ADR-012`.

## Follow-up Actions

- P014's implementation plan finalizes the exact link-table schema/naming per Decision item D,
  following verified repository conventions.
- P014 implements and tests the retention/purge service per Decision item C.5; P025 (or an
  earlier, separately-approved infrastructure decision) wires its production schedule.
- P014 implements file-type/size/signature validation per Decision item A/B, reusing the
  server-proxied upload flow already fixed by `ADR-011`.
- `ENGINE_MAP.md` §6 and `ROADMAP.md`'s P014 row are updated alongside this ADR to reflect these
  decisions as resolved (see the accompanying documentation-closeout change) — `ENGINE_MAP.md`'s
  Document Engine status remains **planned** until P014 is actually implemented and merged; this
  ADR resolves product policy, not implementation state.
- This ADR does not authorize a P014 Implementation Prompt by itself if any other genuine blocker
  remains open at the time one is prepared (see the accompanying Sprint report's blocker list).

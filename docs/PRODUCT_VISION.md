# PRODUCT_VISION.md

# Nera Product Vision

**Version:** 1.0
**Status:** Approved
**Milestone:** Milestone 1 — Product Blueprint

> This document describes the product: what it is, for whom, and what Version 1.0 delivers.
> For principles and non-negotiable rules, see `NERA_CONSTITUTION.md`.
> For sequencing, see `ROADMAP.md`. For the underlying platform inventory, see `ENGINE_MAP.md` and `MODULE_MAP.md`.
> For the architecture decisions behind this vision (product philosophy, the Organization/Institution model, AI's role, vendor abstraction, the plugin platform), see `docs/adr/` — the canonical architecture decision history.
>
> **`docs/PRODUCT_VISION.md` is the canonical product vision document, by owner decision.** The pre-existing `docs/PROJECT_VISION.md` is not deleted or rewritten as part of Milestone 1 — it must be reviewed and merged into this document before it is removed, as its own later approved documentation-cleanup task. See `ROADMAP.md` Section 9.

---

# 1. Target Product

Nera is a general-purpose, modular ERP platform.

The platform core is industry-neutral. Business modules carry industry-specific concepts, terminology and rules. The first modules being built happen to serve a Torah institution's finance operations, but nothing about the platform core assumes that: a commercial company, a municipality, or a healthcare provider must be equally well served by the same core, with different modules enabled.

Nera is built to grow for years without forcing an organization to redesign or replace it as it grows — configuration and modules extend the platform; the platform itself does not need to be rewritten to serve a new kind of organization.

---

# 2. Target Users

- **First customer profile:** a yeshiva or Torah institution, whose office/finance staff manage suppliers, purchasing, invoices and payments largely by hand today.
- **Primary V1 user roles:**
  - **Finance / back-office staff** — enter suppliers, purchase orders and invoices; prepare payments.
  - **Approvers / managers** — review and approve purchase orders and payments before money moves.
  - **Administrators** — configure roles, permissions, custom fields, and oversee the audit trail.
- **Future user types** (post-V1, as modules are added): HR/personnel staff, student/registrar staff, and eventually end-users specific to whichever modules are enabled for a given organization (and, where the organization uses the concept, a specific institution within it — see `NERA_CONSTITUTION.md` Section 7 and ADR-002).

---

# 3. Product Promise

> "The system feels like someone is working with me."
> "The system does not make mistakes."

Nera behaves like a highly accurate professional colleague: it does the repetitive, error-prone parts of a business process, surfaces what it's unsure about, and always leaves the final call to the user.

**Golden principle: Nera never replaces professional judgment. Nera assists. The user decides.**

Accuracy is prioritized over speed. Where a faster path would risk a wrong answer, an unclear answer, or an unreviewable answer, Nera takes the slower, correct path.

---

# 4. V1 Scope

Version 1.0 must deliver, end to end, on real data, with full audit and tenant isolation:

| Area                     | What it means in V1                                                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Contacts / Entities**  | A shared identity record for people and organizations, reused by every module (a supplier is an organization entity with a supplier role/profile). |
| **Suppliers**            | Supplier records, branches and contacts, built on top of Entities.                                                                                 |
| **Purchase Orders**      | Creating and tracking purchase orders against a supplier, with approval.                                                                           |
| **Invoices / Documents** | Recording supplier invoices, attaching source documents, and storing them durably.                                                                 |
| **Payment Approval**     | A controlled approval step before a payment is allowed to proceed, enforced by the Workflow Engine.                                                |
| **Payments**             | Recording payments, their status, and their link back to the invoice and purchase order that justified them.                                       |
| **MASAV**                | Producing a valid MASAV batch bank-transfer file for approved payments.                                                                            |
| **Workflow**             | The generic approval/step engine that Payment Approval (and later flows) are built on.                                                             |
| **Reporting**            | A first set of concrete, real reports over real Supplier/Finance data — not a generic report builder.                                              |
| **Forms**                | Basic structured data collection, built on the existing Customization/Configuration capability.                                                    |
| **Global Search**        | Search across entities and V1 module data, respecting permissions.                                                                                 |

---

# 5. Out of Scope for V1

These are explicitly **not required** for V1. They are not rejected — they are deferred, and the platform must not be architected in a way that makes adding them later expensive.

| Deferred item                             | Why it's safe to defer                                                                                                                                                                                                                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Employees**                             | Structurally similar to Suppliers (an Entity + a role), but not on the path to first business value (money moving to suppliers). Can be added as a module without touching the core.                                                                                                |
| **Students**                              | Depends on the Finance core (tuition billing) existing first; also carries the most institution-specific terminology, which should mature as a module once the core financial primitives are proven.                                                                                |
| **Avreichim**                             | Same reasoning as Students — a stipend/beneficiary module that depends on Finance and Payments existing first.                                                                                                                                                                      |
| **Notifications (as a dedicated engine)** | V1 Workflow approvals are surfaced in-app (a "pending approvals" view) rather than through a multi-channel Notification Engine. A full Notification Engine (channels, templates, escalation) is deferred; see `ENGINE_MAP.md`.                                                      |
| **Automation**                            | Workflow already covers "someone must approve X." A rules/schedule-driven Automation Engine (with test mode, preview, and emergency stop, as required by `ARCHITECTURE.md`) is real scope, not a small add-on, and is deferred until there is a proven need for it beyond Workflow. |

Also explicitly out of scope for V1, independent of the list above: an app/plugin marketplace (the _contracts_ for one are part of V1 design work, not a running marketplace); a fully generic report or form builder; AI-driven automation of the invoice flow (see Section 7 — the flow is documented, not built).

---

# 6. First Business Value

The first real, end-to-end business flow Nera delivers is:

```
Supplier → Purchase Order → Invoice → Payment Approval → MASAV → Mark Paid → Store Documents
```

Every step in this flow is real: a real supplier record, a real purchase order, a real invoice with a stored source document, a real approval decision by a real authorized user, a real MASAV file, and a real, audited "paid" status — not a demo or a static placeholder.

**Suppliers and Finance are the first product areas that should make Nera feel alive.** They are prioritized over every other V1 area because they are the shortest path to a real, trustworthy, end-to-end result a user can point to.

---

# 7. AI Vision

AI in Nera is an assistance layer, governed by `NERA_CONSTITUTION.md` Section 5 and ADR-004 (AI Assistance and User Control). It is not being implemented in V1, but V1's workflows and data model are designed so it can be added later without re-architecture.

The target future flow that the architecture must support (documented now, **not implemented now**):

```
Email received
  → invoice attachment detected
  → document extracted
  → supplier identified
  → invoice fields extracted
  → duplicate detection
  → validation
  → user review
  → approval
  → business workflow continues
```

Every step after "user review" already exists conceptually in V1 (invoice recording, duplicate detection patterns already used by the Entity Engine, approval via Workflow). The steps before it — email ingestion, document extraction, supplier matching, field extraction — belong to a future **Integration Engine** and **AI Assistance Engine** (see `ENGINE_MAP.md`), which will hand off into the same review-and-approval path a human uses today. This is the reason Invoices in V1 are modeled with clearly separated "extracted/proposed data" and "confirmed data" in mind, even though nothing populates the proposed side automatically yet.

---

# 8. User Experience Vision

- **Full control, proactively assisted.** The user is never blocked from doing something themselves, and the system never acts without a clear, visible reason and an available undo/reject path.
- **Explainable by default.** Every warning (for example, a duplicate-supplier match) and every suggestion states what it found and why, per `NERA_CONSTITUTION.md` Section 11.
- **Hebrew, RTL, accurate.** The interface is Hebrew-first with full RTL support; correctness of displayed data (amounts, dates, statuses) is never sacrificed for a simpler UI.
- **Nothing disappears silently.** Rejections, deletions and corrections are visible and reversible where the data model allows it (soft delete, audit trail), consistent with `NERA_CONSTITUTION.md` Section 7.

---

# 9. Success Criteria

V1 is successful when:

1. A real supplier invoice can travel the full path — Supplier → Purchase Order → Invoice → Payment Approval → MASAV → Mark Paid → Store Documents — in production, for a real institution, without manual database intervention.
2. Every step in that flow is authorized server-side, tenant-isolated, and fully audited — verifiable by inspecting the audit log, not just by observing correct UI behavior.
3. A user can ask "why was I asked to approve this" or "why does this look like a duplicate" and get a real, specific answer from the system, not a static message.
4. Two organizations using Nera at the same time never see each other's data, verified by an explicit RLS/tenant-isolation test keyed on `organization_id`, not just by code review. Where an organization uses institutions, an institution-scoped record is also verified to reject an `institution_id` that does not belong to the caller's organization. See ADR-002.
5. Reporting, Forms and Global Search work against real V1 data (not demo data) and respect the same permission model as every other surface.
6. No module outside Suppliers/Finance/Workflow/Reporting/Forms/Search was required to ship V1 — proving that the deferred items in Section 5 truly were safe to defer.
7. Adding a module deferred from V1 (for example, Employees) can be done by building on existing engines (Entity, Authorization, Audit, Workflow, Document) without modifying platform core code — proving the "Platform First" principle held in practice, not just on paper.

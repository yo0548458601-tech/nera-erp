# MODULE_MAP.md

# Nera Module Map

**Version:** 1.0
**Status:** Approved
**Milestone:** Milestone 1 — Product Blueprint

> Business Modules implement business capabilities and live under `modules/` (`ARCHITECTURE.md` Section 6). They must remain independent, use Core Engines instead of duplicating infrastructure, and never import another module's internals (`NERA_CONSTITUTION.md` Section 3).
>
> **Suppliers and Finance are the first modules intended to deliver visible business value** — see `PRODUCT_VISION.md` Section 6. Every other module in this document is either downstream of them (Purchasing, Invoices, Payment Approval, Payments, MASAV) or explicitly deferred past V1.
>
> Every module below is scoped by **Organization** (`organization_id`), the platform's tenant boundary. Where a module's records optionally belong to a specific **Institution** within an organization, that is an additive `institution_id`, never a substitute for `organization_id` — see ADR-002 in `docs/adr/`, the canonical architecture decision history for this and every other cross-cutting decision referenced in this document.

---

# 0. Note: Entities / Contacts Is Not a Business Module

`Contacts` in today's navigation and the underlying Entity Engine (`packages/engines/entities`, see `ENGINE_MAP.md` Section 4) are a **platform capability**, not a business module. They provide the shared person/organization identity record every module below builds on. A module never models its own copy of "a person" or "an organization" — it attaches a role and a module-specific profile to an existing Entity. This map starts from Suppliers rather than Contacts for that reason.

---

# 1. Suppliers

- **Purpose:** Maintain supplier records the rest of the Finance flow depends on. The first module built (`ROADMAP.md`, P016), establishing the `modules/<name>` pattern every later module follows.
- **Owned business entities:** Supplier profile (a `module_profile` on top of an Entity, per the Entity Engine's design), supplier branches, supplier contacts, supplier-specific status (active/inactive/blocked).
- **Workflows:** None owned directly in V1 — a supplier record does not itself require approval to create; approval enters at the Purchase Order stage.
- **Engine dependencies:** Entity (identity/profile), Authorization, Audit, Configuration/Metadata (custom fields on suppliers), Document (attached agreements/certificates, optional in V1).
- **Integrations:** None in V1. A future accounting-system sync is plausible post-V1, through the Integration Engine.
- **Permissions:** Reuses the existing `entities.*` permission family (`entities.edit`, `entities.view_sensitive`, `entities.merge`, `entities.duplicate_override`, `entities.archive`) plus a new `suppliers.*` set for supplier-specific actions (e.g. blocking a supplier), registered into the shared permission catalog per `ENGINE_MAP.md` Section 2's extension pattern.
- **Reports:** "Supplier list," "Supplier spend summary" (the latter depends on Finance data existing).
- **Extension points:** Supplier `module_profile` fields are configurable via Configuration/Metadata, same as any Entity-based module.
- **V1 status:** **In scope — first module built.**

---

# 2. Purchasing / Purchase Orders

- **Purpose:** Create and track purchase orders against a Supplier, with approval before commitment.
- **Owned business entities:** Purchase order, purchase order line items, purchase order status history.
- **Workflows:** Purchase order approval (via Workflow Engine) — amount- or category-based rules deciding who must approve.
- **Engine dependencies:** Workflow, Document (attach quotes/specs), Audit, Authorization, Entity/Suppliers (the ordering supplier).
- **Integrations:** None in V1.
- **Permissions:** `purchase_orders.create`, `purchase_orders.approve`, `purchase_orders.cancel` (new, registered into the shared catalog).
- **Reports:** "Open purchase orders," "Purchase orders by supplier."
- **Extension points:** Approval rule configuration (thresholds, required approver role) via Configuration/Metadata; future three-way match (PO ↔ receipt ↔ invoice) is a named future extension, not built in V1.
- **V1 status:** **In scope.** Depends on Suppliers and Workflow existing first.

---

# 3. Invoices

- **Purpose:** Record a supplier invoice, link it to its Purchase Order, and store its source document.
- **Owned business entities:** Invoice, invoice line items, invoice status (received / under review / approved / paid), the link to a Purchase Order and to stored Documents.
- **Workflows:** Invoice review is a precursor to Payment Approval, not a separate workflow in V1 — an invoice becomes eligible for Payment Approval once its required fields are confirmed.
- **Engine dependencies:** Document (source file), Entity/Suppliers (the invoicing supplier), Audit, Authorization.
- **Integrations:** None in V1. This is the module the future AI-assisted email-to-invoice flow (`PRODUCT_VISION.md` Section 7) ultimately populates — see the data-model note below.
- **Permissions:** `invoices.create`, `invoices.edit`, `invoices.view_sensitive` (amounts may be sensitive in some institutions' permission model).
- **Reports:** "Outstanding invoices," "Invoices by supplier."
- **Extension points:** The invoice data model explicitly separates a "confirmed" field set from a reserved "proposed/extracted" field set (populated only by a human today, and by AI Assistance post-V1) — see `ENGINE_MAP.md` Section 13.
- **V1 status:** **In scope.** Depends on Suppliers, Purchase Orders, and Document.

---

# 4. Payment Approval

- **Purpose:** A controlled, auditable approval step before a payment is allowed to proceed — the explicit product requirement that money never moves without a human decision recorded against it.
- **Owned business entities:** Deliberately thin — a Payment Approval is a Workflow instance targeting an Invoice/Payment, plus institution-specific approval rules (e.g. the ADR-008 example: "may approve only invoices below ₪10,000"). It does not duplicate Invoice or Payment data.
- **Workflows:** Owns the approval workflow definition itself; execution is delegated entirely to the Workflow Engine, per `ARCHITECTURE.md` Section 11 ("modules must not implement their own approval logic").
- **Engine dependencies:** Workflow, Authorization (record-level rules), Audit.
- **Integrations:** None.
- **Permissions:** `finance.payment_priority`, `finance.clear_priority_markers` (already defined in the permission catalog) plus a new `payments.approve` permission with record-level amount-threshold support.
- **Reports:** "Pending payment approvals," "Approval turnaround time."
- **Extension points:** Approval rule thresholds/roles are configuration, not code, per `NERA_CONSTITUTION.md` Section 3.4.
- **V1 status:** **In scope.** Depends on Invoices and Workflow.

---

# 5. Payments

- **Purpose:** Record the payment itself once approved — the ledger entry, its method, and the "mark paid" action that closes the loop back to the Invoice.
- **Owned business entities:** Payment record, payment method, payment status, link to the approved Invoice/Purchase Order.
- **Workflows:** Consumes the outcome of Payment Approval; does not run its own approval.
- **Engine dependencies:** Workflow (approval outcome), Audit (append-only, since this is money), Authorization, Document (payment confirmation/receipt storage).
- **Integrations:** MASAV (below) is how a Payment is actually executed for bank transfers.
- **Permissions:** `finance.view`, plus new `payments.mark_paid`, `payments.void` (void, not delete — soft-delete/reversal discipline per `NERA_CONSTITUTION.md` Section 7.4, given this is financial data).
- **Reports:** "Payments made," "Payments by supplier," "Cash flow (outbound)."
- **Extension points:** Payment method list is configuration (Configuration/Metadata), so a new payment method doesn't require code changes.
- **V1 status:** **In scope.** Depends on Payment Approval.

---

# 6. MASAV

- **Purpose:** Produce a valid MASAV (Israeli batch bank-transfer) file for a set of approved Payments, and record the outcome of that transfer batch.
- **Owned business entities:** MASAV batch (the set of payments included, generation timestamp, file reference, submission status).
- **Workflows:** None additional — operates only on Payments that have already completed Payment Approval.
- **Engine dependencies:** Document (store the generated file), Audit, Integration (the file-exchange mechanism, in its narrowest V1 form), Authorization.
- **Integrations:** The MASAV file format/exchange itself; a sandbox/test mode is mandatory before any real submission path, given the risk profile of real money movement (see `ROADMAP.md`, P020).
- **Permissions:** New `masav.generate`, `masav.submit` — kept separate from `payments.mark_paid` so file generation and the authority to actually move money can be governed independently if an institution wants that separation.
- **Reports:** "MASAV batch history," "Failed/rejected transfers" (once a real bank feedback loop exists — may extend past V1).
- **Extension points:** None planned for V1; a future multi-bank-format extension point is plausible but not designed now.
- **V1 status:** **In scope.** Last module in the Milestone 3 chain; depends on Payments.

---

# 7. Finance (Core)

- **Purpose:** The umbrella ledger/financial system of record that Invoices, Payment Approval, Payments and MASAV all report into — general income/expense tracking beyond the supplier-specific pipeline (e.g. a manual expense not tied to a Purchase Order).
- **Owned business entities:** General ledger entries, income records, expense records not necessarily tied to a Supplier/Purchase Order.
- **Workflows:** Reuses Payment Approval for any expense above a configured threshold, same as supplier invoices.
- **Engine dependencies:** Workflow, Audit, Authorization, Document.
- **Integrations:** None beyond MASAV for outbound payment execution.
- **Permissions:** `finance.view` (already defined), plus `finance.create_entry`, `finance.edit_entry`.
- **Reports:** "Income vs. expense," "General ledger export."
- **Extension points:** Category/account structure is configuration.
- **V1 status:** **In scope**, delivered incrementally alongside Invoices/Payments — Finance is the module family name; Invoices/Payment Approval/Payments/MASAV above are its V1-critical members, called out individually because each has a distinct workflow position in the first business value flow.

---

# 8. Future Optional Modules (Not V1)

Each of the following reuses the Entity + role + module-profile pattern proven by Suppliers, and is deferred per `PRODUCT_VISION.md` Section 5 or newly acknowledged here as a recognized future module with no committed design yet.

| Module        | Purpose (directional)                                                       | Primary engine dependency        | V1 status                                                       |
| ------------- | --------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------- |
| **Employees** | Staff records, organizational role, unit assignment.                        | Entity, Authorization            | Deferred — not required for first business value.               |
| **Students**  | Student records, enrollment, tuition billing.                               | Entity, Finance (Core)           | Deferred — depends on Finance Core existing first.              |
| **Avreichim** | Kollel-scholar records, institutional affiliation, stipend payments.        | Entity, Finance (Core), Payments | Deferred — depends on Finance Core and Payments existing first. |
| **Assets**    | Organizational asset tracking (location, custody, depreciation).            | Entity, Document                 | Deferred — no committed design.                                 |
| **Inventory** | Stock/product tracking and availability.                                    | Document, Reporting              | Deferred — no committed design.                                 |
| **CRM**       | Sales/relationship pipeline beyond the Supplier-facing Contacts capability. | Entity, Workflow                 | Deferred — no committed design.                                 |

None of these may introduce institution- or industry-specific terminology into a Core Engine or the platform core, per `NERA_CONSTITUTION.md` Section 12 — each stays a self-contained module under `modules/`.

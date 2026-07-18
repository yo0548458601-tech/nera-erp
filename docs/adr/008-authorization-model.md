# ADR-008 — Authorization Model

**Status:** Accepted
**Date:** 2026-07-09
**Migration note:** Originally recorded as `ADR-0003` in `docs/decisions/ADR-0003-authorization-model.md` during the Foundation Phase, with header status `Proposed`. Migrated here as **Accepted**, correcting a stale status label: `docs/CORE_PLATFORM_BLUEPRINT.md` already listed this ADR among the "approved foundation" documents "binding for all future development," and the already-implemented `packages/engines/authorization` code already builds on this model. This migration corrects the label to match what was already true; it does not introduce a new decision. The original approval date is preserved. `docs/decisions/ADR-0003-authorization-model.md` now redirects here. See also the reconciliation note under Follow-up Actions regarding this ADR's hierarchy naming and ADR-002.

---

## Context

Nera is a platform intended to support many organizations with different structures, departments, teams and users. Authorization must be flexible enough to support enterprise-scale governance while remaining understandable and auditable.

The platform must support permissions across: Organizations, Branches, Departments, Teams, Roles, Permission Groups, and Individual Users. Permissions must be configurable rather than hardcoded, and every permission must be stored in the database. The authorization model must support both broad role-based access and fine-grained record-level restrictions.

## Decision

Nera uses a configurable authorization model based on hierarchical permission assignment and evaluation.

The model supports the actions: Create, Read, Update, Delete, Approve, Cancel, Export, Import, Print, Manage — plus record-level permissions such as "can view only own customers," "can edit only department records," "can approve only invoices below ₪10,000," "can view only assigned tasks."

Authorization is evaluated through a hierarchy: **Organization → Branch → Department → Role → User.** Higher levels may inherit permissions downward. Users may receive additional permissions, and may also receive explicit denials.

### Authorization Hierarchy

1. Organization
2. Branch
3. Department
4. Team
5. Role
6. Permission Group
7. User

Permissions may be assigned at any level. Permissions flow downward unless explicitly restricted. User-level permissions override inherited permissions only when explicitly defined by the evaluation model.

### Permission Resolution Flow

1. Collect all applicable permissions for the user.
2. Include inherited permissions from higher levels.
3. Include explicit user-level permissions.
4. Apply explicit denials.
5. Evaluate record-level conditions.
6. Resolve the final permission decision.

If there is a conflict, the most specific explicit rule wins. If there is no matching permission, the default result is **deny**. This default-deny rule, and the "most specific explicit rule wins" precedence, are exactly what the already-implemented `resolveEffectivePermission()` in `packages/engines/authorization` follows (see `ENGINE_MAP.md`, Authorization).

## Consequences

**Benefits:** flexible enterprise authorization; configurable permissions without code changes; stronger governance and compliance; better support for organizational complexity; clear support for record-level security; better auditability.

**Trade-offs:** more complex configuration model; requires clear governance and review; needs strong testing and auditing.

### Examples

- **Department Manager** — may have Read, Update and Approve permissions for invoices in their department.
- **Record-Level Restriction** — a user may view only records assigned to their team.
- **Explicit Denial** — a user may inherit Update permission from a role but receive an explicit denial for a sensitive module.
- **AI Action** — an AI assistant requests access to a customer record; the request is evaluated as the requesting user and must pass the same permission checks as any human user (see ADR-004, AI Assistance and User Control).

### Best Practices

- Prefer configuration over hardcoded permissions.
- Use the least privilege principle.
- Keep permission definitions explicit and auditable.
- Use record-level rules for sensitive or scoped data.
- Review inherited permissions carefully.
- Separate business permissions from technical permissions.
- Ensure every authorization decision is logged.

### Anti-patterns

- Hardcoding permissions inside application code.
- Giving broad access to avoid configuration effort.
- Allowing direct bypass of authorization checks.
- Treating AI as a privileged bypass path.
- Relying on UI hiding as security.
- Allowing role definitions without auditability.

### Security Principles

- Authorization must be enforced on the server side. Client-side permission checks are never sufficient.
- Default deny is mandatory. Least privilege is mandatory.
- Every permission decision must be auditable.
- System administrators may bypass business permissions, but all actions remain visible and logged.

### AI Integration

AI must never bypass permissions. AI executes actions as the requesting user. Every AI action must pass authorization checks. Every AI action must be written to the Audit Log. (Restated and extended by ADR-004, AI Assistance and User Control.)

### System Administrator

A special System Administrator role exists. It bypasses business permissions. However: every action is audited, nothing is invisible, and administrative actions remain reviewable and traceable.

## Alternatives Considered

No alternative authorization model is recorded in the original ADR. The anti-patterns list above functions as the implicit rejected alternative: hardcoded, UI-only, or AI-privileged-bypass approaches to authorization.

## Follow-up Actions

- When introducing this model: define permission groups and role mappings; move existing permission logic into database-backed configuration; ensure every permission check uses the same evaluation engine; audit all existing privileged access; add migration rules for inherited permissions and denials; validate that AI actions go through the same permission pipeline.
- **Reconciliation needed with ADR-002 (Organization and Institution Hierarchy):** this ADR's hierarchy (`Organization → Branch → Department → Role → User`) already places Organization at the top, consistent with ADR-002's decision that Organization is the tenant/security boundary — the two ADRs do not contradict each other on that point. However, this ADR's `Branch` and `Department` levels are a different, finer-grained business hierarchy than ADR-002's `Institution`, and the already-implemented `PermissionScope` type in `packages/engines/authorization` uses a _third_ naming (`'institution'` as a scope level) that predates both ADRs. Whether `Branch`/`Department` and `Institution` are the same concept, nested concepts, or genuinely separate hierarchies is **not resolved by this migration** and must be settled by a future ADR (candidate: during P011, Authorization Engine — Server Enforcement) before server-side enforcement is implemented — see `ENGINE_MAP.md`, Authorization and Organization / Institution entries.

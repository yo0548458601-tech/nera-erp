# ADR-0003 — Authorization Model

Status: Proposed

Date: 2026-07-09

---

# Context

Nera is a platform intended to support many organizations with different structures, departments, teams and users.

Authorization must be flexible enough to support enterprise-scale governance while remaining understandable and auditable.

The platform must support permissions across:

- Organizations
- Branches
- Departments
- Teams
- Roles
- Permission Groups
- Individual Users

Permissions must be configurable rather than hardcoded.

Every permission must be stored in the database.

The authorization model must support both broad role-based access and fine-grained record-level restrictions.

---

# Decision

Nera will use a configurable authorization model based on hierarchical permission assignment and evaluation.

The model will support:

- Create
- Read
- Update
- Delete
- Approve
- Cancel
- Export
- Import
- Print
- Manage

It will also support record-level permissions such as:

- Can view only own customers
- Can edit only department records
- Can approve only invoices below ₪10,000
- Can view only assigned tasks

Authorization will be evaluated through a hierarchy:

Organization
↓
Branch
↓
Department
↓
Role
↓
User

Higher levels may inherit permissions downward.

Users may receive additional permissions.

Users may also receive explicit denials.

---

# Consequences

Benefits:

- Flexible enterprise authorization
- Configurable permissions without code changes
- Stronger governance and compliance
- Better support for organizational complexity
- Clear support for record-level security
- Better auditability

Trade-offs:

- More complex configuration model
- Requires clear governance and review
- Needs strong testing and auditing

---

# Authorization Hierarchy

The authorization hierarchy is:

1. Organization
2. Branch
3. Department
4. Team
5. Role
6. Permission Group
7. User

Permissions may be assigned at any level.

Permissions flow downward unless explicitly restricted.

User-level permissions override inherited permissions only when explicitly defined by the evaluation model.

---

# Permission Resolution Flow

Permission evaluation will follow this flow:

1. Collect all applicable permissions for the user.
2. Include inherited permissions from higher levels.
3. Include explicit user-level permissions.
4. Apply explicit denials.
5. Evaluate record-level conditions.
6. Resolve the final permission decision.

If there is a conflict, the most specific explicit rule wins.

If there is no matching permission, the default result is deny.

---

# Examples

Example 1: Department Manager

A department manager may have Read, Update and Approve permissions for invoices in their department.

Example 2: Record-Level Restriction

A user may view only records assigned to their team.

Example 3: Explicit Denial

A user may inherit Update permission from a role but receive an explicit denial for a sensitive module.

Example 4: AI Action

An AI assistant requests access to a customer record.

The request is evaluated as the requesting user and must pass the same permission checks as any human user.

---

# Best Practices

- Prefer configuration over hardcoded permissions.
- Use the least privilege principle.
- Keep permission definitions explicit and auditable.
- Use record-level rules for sensitive or scoped data.
- Review inherited permissions carefully.
- Separate business permissions from technical permissions.
- Ensure every authorization decision is logged.

---

# Anti-patterns

- Hardcoding permissions inside application code.
- Giving broad access to avoid configuration effort.
- Allowing direct bypass of authorization checks.
- Treating AI as a privileged bypass path.
- Relying on UI hiding as security.
- Allowing role definitions without auditability.

---

# Migration Notes

When introducing this model:

1. Define permission groups and role mappings.
2. Move existing permission logic into database-backed configuration.
3. Ensure every permission check uses the same evaluation engine.
4. Audit all existing privileged access.
5. Add migration rules for inherited permissions and denials.
6. Validate that AI actions go through the same permission pipeline.

---

# Security Principles

- Authorization must be enforced on the server side.
- Client-side permission checks are never sufficient.
- Default deny is mandatory.
- Least privilege is mandatory.
- Every permission decision must be auditable.
- System administrators may bypass business permissions, but all actions remain visible and logged.

---

# AI Integration

AI must never bypass permissions.

AI executes actions as the requesting user.

Every AI action must pass authorization checks.

Every AI action must be written to the Audit Log.

---

# System Administrator

A special System Administrator role exists.

It bypasses business permissions.

However:

- Every action is audited.
- Nothing is invisible.
- Administrative actions remain reviewable and traceable.

---

# Final Note

Authorization is a core platform capability.

It must remain configurable, auditable, scalable and compatible with future growth.

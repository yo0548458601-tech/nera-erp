/**
 * Audit Engine (`ENGINE_MAP.md` Section 5; P010 - see `docs/ROADMAP.md`).
 *
 * A single, append-only writer for the `audit_logs` table (schema unchanged
 * from P004 - see `packages/database/prisma/schema.prisma`). The only
 * mutation this package exposes is `recordAudit`: no update, no delete,
 * matching `NERA_CONSTITUTION.md` Section 7.6 ("Audit records are
 * append-only and are never edited or deleted through normal application
 * behavior"). That guarantee is enforced at the application layer only (this
 * package's public API surface) - no database-level trigger/REVOKE is added
 * in this sprint; see the P010 documentation notes in `ENGINE_MAP.md`.
 *
 * Database access path (owner-approved for P010):
 *
 *   @nera/audit-engine -> @nera/database
 *
 * This engine depends on `@nera/database`'s real Prisma client directly. It
 * does NOT bind Prisma behind `@nera/core`'s `DatabaseProvider` contract -
 * that contract remains deliberately unbound per ADR-009, and binding it is
 * explicitly out of scope for P010.
 *
 * Testing note (owner decision, P010): automated tests in this package use a
 * fake/mocked `AuditLogDbClient`, never a live Postgres connection. The
 * write implementation below is real and Prisma-backed; only the *test
 * verification* of it is fake-based in this sprint. Live-database
 * integration testing is deferred to a later persistence/RLS sprint that
 * already requires database-backed CI (see `ROADMAP.md`, P012).
 *
 * No read/query API is exposed in this sprint. `ENGINE_MAP.md` Section 5
 * documents a future "read/query API for an audit log viewer," but a
 * permission-aware read cannot be honestly built before P011 (Authorization
 * Engine - Server Enforcement) exists: there is no real enforcement
 * mechanism yet to check a caller against. Building a query function now
 * would either (a) silently expose every organization's audit trail to any
 * caller, or (b) fake an authorization check this package has no authority
 * to perform. Both are worse than omitting the function entirely. A query
 * API is deferred to P011 or later, once a real, resolved authorization
 * decision exists to require as input.
 */

import { appPrisma, type AuditLog, Prisma } from '@nera/database';

/**
 * The minimal slice of a Prisma-compatible client this engine needs -
 * structurally satisfied by the real `prisma` client from `@nera/database`,
 * and by any test fake that implements just this one method. This is not a
 * new vendor-abstraction layer (binding a provider contract is explicitly
 * out of scope for P010, per ADR-009) - just the smallest possible seam for
 * dependency injection in tests.
 */
export type AuditLogDbClient = {
  auditLog: {
    create(args: { data: Prisma.AuditLogUncheckedCreateInput }): Promise<AuditLog>;
  };
};

/**
 * A human actor, scoped to the membership (org-level role assignment) they
 * were acting under, if known. Pass `null` for `RecordAuditInput.actor` for
 * a system-initiated action with no human actor - both underlying columns
 * (`actor_user_profile_id`, `actor_membership_id`) are nullable in the
 * schema for exactly this case.
 */
export type AuditActor = {
  userProfileId: string;
  membershipId?: string | null;
};

export type RecordAuditInput = {
  /** The tenant this action occurred in. Always required - audit records are never tenant-less. */
  organizationId: string;
  /** `null` for a system-initiated action (no human actor). */
  actor: AuditActor | null;
  /** A short, stable action identifier, e.g. `"entity.updated"`, `"permission_rule.changed"`. */
  action: string;
  entityType: string;
  entityId: string;
  /**
   * The record's prior state, or `null` if there was none (e.g. a create
   * action). Omit the field (`undefined`) only when the value is genuinely
   * not applicable to this action type, not as a substitute for `null`.
   */
  oldValues?: unknown;
  newValues?: unknown;
  metadata?: unknown;
  /**
   * Overrides the record's timestamp. Omit to use the schema's own
   * `@default(now())` behavior (recommended for almost every real call site
   * - only pass this when replaying/backfilling a historical event).
   */
  occurredAt?: Date;
};

export type AuditRecord = AuditLog;

export type AuditEngine = {
  recordAudit(input: RecordAuditInput): Promise<AuditRecord>;
};

const REQUIRED_STRING_FIELDS = ['organizationId', 'action', 'entityType', 'entityId'] as const;

function assertValidRecordAuditInput(input: RecordAuditInput): void {
  for (const field of REQUIRED_STRING_FIELDS) {
    const value = input[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`recordAudit: "${field}" is required and must be a non-empty string.`);
    }
  }
}

/**
 * Maps an optional, caller-provided JSON-ish value onto Prisma's nullable
 * `Json?` column contract: `undefined` (field not provided) is passed
 * through as `undefined` so Prisma omits the key entirely and the column
 * keeps its own default; `null` (explicitly "no value") maps to
 * `Prisma.DbNull`, the sentinel Prisma requires to write a real SQL `NULL`
 * into a nullable JSON column (a plain `null` literal is a JSON *value*,
 * not a "no value" marker, and is rejected by the generated types for this
 * reason). Any other value is passed through unchanged.
 */
function toJsonInput(
  value: unknown
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return Prisma.DbNull;
  }
  return value as Prisma.InputJsonValue;
}

/**
 * Factory, not a singleton - matches the rest of `packages/engines/*` and
 * `@nera/core`'s stateless-function convention (see `createProviderRegistry`,
 * `createPluginRegistry`). Defaults to `appPrisma`, the least-privilege
 * application client (P013A), so a production caller can write
 * `createAuditEngine()` with no arguments and get real writes with no extra
 * wiring, without ever defaulting to the administrative client; tests inject
 * a fake `AuditLogDbClient` explicitly instead. Callers needing atomicity
 * with a paired domain write (see `docs/ROADMAP.md` P013A) pass the same
 * transaction client (`tx`) both `getOrganizationContext` and
 * `createAuditEngine` should use, so the audit row commits or rolls back
 * together with the mutation it records.
 */
export function createAuditEngine(client: AuditLogDbClient = appPrisma): AuditEngine {
  return {
    async recordAudit(input) {
      assertValidRecordAuditInput(input);

      const data: Prisma.AuditLogUncheckedCreateInput = {
        organizationId: input.organizationId,
        actorUserProfileId: input.actor?.userProfileId ?? null,
        actorMembershipId: input.actor?.membershipId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        oldValues: toJsonInput(input.oldValues),
        newValues: toJsonInput(input.newValues),
        metadata: toJsonInput(input.metadata),
        ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
      };

      return client.auditLog.create({ data });
    },
  };
}

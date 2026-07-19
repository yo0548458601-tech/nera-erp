import { type EntityRoleId } from './roles';

/**
 * Architectural contract for future payment/MASAV modules - NOT implemented
 * in this sprint. No payment or MASAV logic exists yet.
 *
 * The invariant this type encodes: a financial stream always belongs to one
 * specific role assignment, never to the bare entity. This is what lets one
 * person be both an employee and an avreich without a future module
 * accidentally combining their salary and their stipend into a single
 * stream, accounting code, or MASAV row. A beneficiary entity is not the
 * same thing as a business payment role - "who receives the money" and
 * "under which role/stream it was earned" are different questions.
 */
export type FinancialStreamContext = {
  /** The specific role assignment this stream belongs to - never the bare entityId. */
  roleAssignmentId: string;
  entityId: string;
  role: EntityRoleId;
  organizationId?: string;
  /** Module-defined, e.g. "salary", "stipend", "donation" - kept separate per role. */
  paymentType: string;
  /** Module-defined accounting code, kept separate per role/stream. */
  accountingCode?: string;
};

/**
 * A read-only rollup across an entity's separate financial streams, for
 * display only (e.g. "total received this month across all roles"). This
 * must never become a merged transactional record - each stream keeps its
 * own payments, accounting code and MASAV rows.
 */
export type EntityFinancialSummary = {
  entityId: string;
  streams: Array<Pick<FinancialStreamContext, 'roleAssignmentId' | 'role' | 'paymentType'>>;
};

/**
 * Guard rail for future payment modules: throws if two streams claim the
 * same role assignment, which would indicate they were incorrectly merged
 * instead of kept separate per role.
 */
export function assertDistinctRoleStreams(streams: FinancialStreamContext[]): void {
  const seen = new Set<string>();
  for (const stream of streams) {
    if (seen.has(stream.roleAssignmentId)) {
      throw new Error(
        `Financial streams must stay separate per role assignment; duplicate roleAssignmentId "${stream.roleAssignmentId}" would combine two streams.`
      );
    }
    seen.add(stream.roleAssignmentId);
  }
}

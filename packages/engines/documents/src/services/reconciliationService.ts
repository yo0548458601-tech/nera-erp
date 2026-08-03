import { prisma } from '@nera/database';
import type { StorageProvider } from '@nera/core';
import {
  createDocumentRepository,
  type DocumentRepositoryDbClient,
} from '../persistence/documentRepository.js';

/**
 * 1-hour grace period (Owner decision, P014 planning) - ADR-011 Decision
 * item 5 explicitly left this value open ("selected and documented in the
 * complete P014 Implementation Prompt").
 */
export const RECONCILIATION_GRACE_PERIOD_MS = 60 * 60 * 1000;

export type ReconciliationResult = {
  processedDocumentIds: string[];
  failures: { documentId: string; error: string }[];
};

/**
 * The single backstop for both unresolved upload-lifecycle cases - a stale
 * "uploading" row and a "failed" row both converge on the same targeted,
 * idempotent `delete(key)` (ADR-011 Decision item 5). Platform-wide (every
 * organization, not one) - must run against the admin `prisma` client, never
 * `appPrisma` (see `documentRepository.ts`'s module doc comment for why).
 * No production schedule is wired by P014 (ADR-011 Decision item 12) - see
 * `runReconciliation.ts` for the maintenance-command entry point this
 * function backs.
 */
export async function runDocumentReconciliation(
  storageProvider: StorageProvider,
  gracePeriodMs: number = RECONCILIATION_GRACE_PERIOD_MS,
  now: Date = new Date(),
  client: DocumentRepositoryDbClient = prisma
): Promise<ReconciliationResult> {
  const repository = createDocumentRepository(client);
  const cutoff = new Date(now.getTime() - gracePeriodMs);
  const stuck = await repository.findStuckForReconciliation(cutoff);

  const processedDocumentIds: string[] = [];
  const failures: { documentId: string; error: string }[] = [];

  for (const document of stuck) {
    try {
      // An object-not-found result is successful idempotent cleanup (ADR-011 Decision item 5).
      await storageProvider.delete(document.storageKey);
      await repository.markReconciled(document.id);
      processedDocumentIds.push(document.id);
    } catch (error) {
      failures.push({
        documentId: document.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { processedDocumentIds, failures };
}

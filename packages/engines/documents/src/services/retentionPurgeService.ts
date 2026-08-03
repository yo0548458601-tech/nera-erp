import { prisma } from '@nera/database';
import type { StorageProvider } from '@nera/core';
import {
  createDocumentRepository,
  type DocumentRepositoryDbClient,
} from '../persistence/documentRepository.js';

/** 30-day recovery window (ADR-013 Decision item C.2/C.3). */
export const RETENTION_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export type RetentionPurgeResult = {
  processedDocumentIds: string[];
  failures: { documentId: string; error: string }[];
};

/**
 * Enforces the 30-day eligibility window (ADR-013 Decision item C.5):
 * physically removes the storage object for every soft-deleted document
 * whose recovery window has elapsed, then marks the row purged.
 * `purgedByUserId` is `null` here - this is the automatic, unattended path,
 * distinct from an administrator's explicit hard-delete action (see
 * `documentRepository.ts`'s `hardDeleteDocument`). Platform-wide - must run
 * against the admin `prisma` client, never `appPrisma` (see
 * `documentRepository.ts`'s module doc comment). No production schedule is
 * wired by P014 (ADR-011 Decision item 12; ADR-013 Decision item C.5) - see
 * `runRetentionPurge.ts` for the maintenance-command entry point.
 */
export async function runDocumentRetentionPurge(
  storageProvider: StorageProvider,
  retentionPeriodMs: number = RETENTION_PERIOD_MS,
  now: Date = new Date(),
  client: DocumentRepositoryDbClient = prisma
): Promise<RetentionPurgeResult> {
  const repository = createDocumentRepository(client);
  const cutoff = new Date(now.getTime() - retentionPeriodMs);
  const eligible = await repository.findPurgeEligible(cutoff);

  const processedDocumentIds: string[] = [];
  const failures: { documentId: string; error: string }[] = [];

  for (const document of eligible) {
    try {
      await storageProvider.delete(document.storageKey);
      await repository.markPurged(document.id, null);
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

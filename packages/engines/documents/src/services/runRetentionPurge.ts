import 'dotenv/config';
import { prisma } from '@nera/database';
import {
  createS3StorageProvider,
  loadS3StorageProviderConfigFromEnv,
} from '../s3StorageProvider.js';
import { runDocumentRetentionPurge } from './retentionPurgeService.js';

/**
 * Maintenance-command entry point (`npm run documents:purge --workspace=@nera/document-engine`).
 * No production recurring schedule is wired here - that remains P025's job
 * (ADR-013 Decision item C.5), unless the Owner separately approves an
 * earlier infrastructure decision.
 */
async function main() {
  const storageProvider = createS3StorageProvider(loadS3StorageProviderConfigFromEnv());
  const result = await runDocumentRetentionPurge(storageProvider);
  console.info(
    `documents:purge - processed ${result.processedDocumentIds.length}, failed ${result.failures.length}.`
  );
  if (result.failures.length > 0) {
    console.error(result.failures);
  }
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

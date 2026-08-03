import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl as getS3PresignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageProvider } from '@nera/core';

/**
 * S3StorageProvider (ADR-011, Accepted). One generic adapter against
 * `@aws-sdk/client-s3` for every environment - AWS S3 `il-central-1` in
 * production, SeaweedFS (S3-gateway mode) for local/CI - switching between
 * them is a configuration change, not a second implementation (Decision
 * item 1). `forcePathStyle` exists specifically because path-style vs.
 * virtual-hosted-style addressing was verified as a real difference between
 * SeaweedFS and AWS S3 during the ADR's own compatibility spike.
 */
export type S3StorageProviderConfig = {
  bucket: string;
  region: string;
  /** Set for SeaweedFS/local; omitted for real AWS S3 (uses AWS's default endpoints). */
  endpoint?: string;
  /** true for SeaweedFS; false (virtual-hosted-style) for AWS S3. */
  forcePathStyle: boolean;
  credentials?: { accessKeyId: string; secretAccessKey: string };
};

function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`s3StorageProvider: environment variable "${name}" is required.`);
  }
  return value;
}

/** Reads the S3StorageProvider's configuration from environment variables - see packages/engines/documents/README.md for the full variable list. */
export function loadS3StorageProviderConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): S3StorageProviderConfig {
  const accessKeyId = env.DOCUMENT_STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = env.DOCUMENT_STORAGE_SECRET_ACCESS_KEY;

  return {
    bucket: requireEnv(env, 'DOCUMENT_STORAGE_BUCKET'),
    region: requireEnv(env, 'DOCUMENT_STORAGE_REGION'),
    endpoint: env.DOCUMENT_STORAGE_ENDPOINT || undefined,
    forcePathStyle: env.DOCUMENT_STORAGE_FORCE_PATH_STYLE === 'true',
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  };
}

function createS3Client(config: S3StorageProviderConfig): S3Client {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: config.credentials,
  });
}

/** Required operation subset only (ADR-011 Decision item 13) - no ListObjectsV2, no presigned PUT/POST, no multipart upload. */
export function createS3StorageProvider(config: S3StorageProviderConfig): StorageProvider {
  const client = createS3Client(config);

  return {
    async upload(key, content, options) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: content,
          ContentType: options.contentType,
          ContentDisposition: options.contentDisposition,
        })
      );
      return { key };
    },

    async getSignedUrl(key, expiresInSeconds) {
      return getS3PresignedUrl(client, new GetObjectCommand({ Bucket: config.bucket, Key: key }), {
        expiresIn: expiresInSeconds,
      });
    },

    async delete(key) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
      } catch (error) {
        // An object-not-found result is successful idempotent cleanup (ADR-011 Decision item 5) -
        // some S3-compatible stores (unlike real S3's own DeleteObject) surface this as an error.
        const name = error instanceof Error ? error.name : '';
        if (name === 'NotFound' || name === 'NoSuchKey') {
          return;
        }
        throw error;
      }
    },
  };
}

/**
 * `HeadObject` is internal only, never part of the public `StorageProvider`
 * contract (ADR-011 Decision item 10) - used only by the provider-
 * certification test suite, never by any other engine or module.
 */
export async function headObjectForCertification(
  config: S3StorageProviderConfig,
  key: string
): Promise<{ contentLength?: number; contentType?: string; contentDisposition?: string }> {
  const client = createS3Client(config);
  const result = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
  return {
    contentLength: result.ContentLength,
    contentType: result.ContentType,
    contentDisposition: result.ContentDisposition,
  };
}

/**
 * File type/size/signature validation (ADR-013 Decision item A/B). The
 * allowlist is closed, not open-by-default - a new format requires its own
 * future decision, not an implicit extension. The client-supplied extension
 * and declared Content-Type are never trusted alone; the file signature
 * (magic bytes) is checked wherever the format supports reliable
 * verification. DOCX and XLSX share the same ZIP-based OOXML container
 * signature - ADR-013 explicitly allows extension + declared-type
 * validation to stand in where a more specific sub-check isn't reliably
 * possible, so this module does not attempt to distinguish them by bytes
 * alone.
 */

/** 25 MB, server-enforced (ADR-013 Decision item B). */
export const MAX_DOCUMENT_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ZIP_SIGNATURES = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
  [0x50, 0x4b, 0x07, 0x08],
];

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

function matchesAnySignature(bytes: Uint8Array, signatures: number[][]): boolean {
  return signatures.some(signature => startsWith(bytes, signature));
}

type AllowedFileRule = {
  extension: string;
  contentTypes: string[];
  matchesSignature: (bytes: Uint8Array) => boolean;
};

/** Closed allowlist (ADR-013 Decision item A): PDF, JPG/JPEG, PNG, DOCX, XLSX only. */
const ALLOWED_FILE_RULES: AllowedFileRule[] = [
  {
    extension: 'pdf',
    contentTypes: ['application/pdf'],
    matchesSignature: bytes => startsWith(bytes, PDF_SIGNATURE),
  },
  {
    extension: 'jpg',
    contentTypes: ['image/jpeg'],
    matchesSignature: bytes => startsWith(bytes, JPEG_SIGNATURE),
  },
  {
    extension: 'jpeg',
    contentTypes: ['image/jpeg'],
    matchesSignature: bytes => startsWith(bytes, JPEG_SIGNATURE),
  },
  {
    extension: 'png',
    contentTypes: ['image/png'],
    matchesSignature: bytes => startsWith(bytes, PNG_SIGNATURE),
  },
  {
    extension: 'docx',
    contentTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    matchesSignature: bytes => matchesAnySignature(bytes, ZIP_SIGNATURES),
  },
  {
    extension: 'xlsx',
    contentTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    matchesSignature: bytes => matchesAnySignature(bytes, ZIP_SIGNATURES),
  },
];

export type FileValidationInput = {
  filename: string;
  declaredContentType: string;
  sizeBytes: number;
  bytes: Uint8Array;
};

export type FileValidationFailureReason =
  | 'file-empty'
  | 'file-too-large'
  | 'file-type-not-allowed'
  | 'content-type-mismatch'
  | 'file-signature-mismatch';

export type FileValidationResult =
  { ok: true } | { ok: false; reason: FileValidationFailureReason };

function getExtension(filename: string): string {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

export function validateFileUpload(input: FileValidationInput): FileValidationResult {
  if (input.sizeBytes <= 0) {
    return { ok: false, reason: 'file-empty' };
  }
  if (input.sizeBytes > MAX_DOCUMENT_UPLOAD_SIZE_BYTES) {
    return { ok: false, reason: 'file-too-large' };
  }

  const rule = ALLOWED_FILE_RULES.find(
    candidate => candidate.extension === getExtension(input.filename)
  );
  if (!rule) {
    return { ok: false, reason: 'file-type-not-allowed' };
  }
  if (!rule.contentTypes.includes(input.declaredContentType)) {
    return { ok: false, reason: 'content-type-mismatch' };
  }
  if (!rule.matchesSignature(input.bytes)) {
    return { ok: false, reason: 'file-signature-mismatch' };
  }

  return { ok: true };
}

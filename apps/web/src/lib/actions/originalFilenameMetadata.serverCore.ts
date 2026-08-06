/**
 * Pure server-side decode/resolve logic for the original-filename metadata
 * mechanism (P014). Deliberately has no `import 'server-only'` so it can
 * be imported directly by unit tests under Vitest's plain Node
 * environment without depending on whether `server-only`'s window-check
 * would or wouldn't trip there. Production code must import the guarded
 * wrapper (originalFilenameMetadata.server.ts), never this module
 * directly - see that file's doc comment for why.
 */
import { sanitizeOriginalFilename } from '@nera/document-engine';
import { FORM_FIELD_ORIGINAL_FILENAME_UTF8_BASE64URL } from './originalFilenameMetadata.shared';

/**
 * ASCII transport cap - deliberately generous, not a tight fit. 255
 * Unicode code points, each requiring the worst-case 4-byte UTF-8
 * encoding (astral characters), is 1020 bytes; Base64 expands that by
 * 4/3 to 1360 encoded characters. 2048 is a simple, clearly documented
 * defensive cap above that figure, not a computed exact bound - the
 * decoded filename is separately truncated to 255 Unicode code points by
 * sanitizeOriginalFilename regardless of what arrives here.
 */
export const MAX_ENCODED_ORIGINAL_FILENAME_LENGTH = 2048;

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]*$/;

export type DecodeOriginalFilenameResult =
  | { ok: true; filename: string }
  | { ok: false; reason: 'empty' | 'too-long' | 'invalid-base64url' | 'invalid-utf8' };

export function decodeOriginalFilenameUtf8Base64Url(encoded: string): DecodeOriginalFilenameResult {
  if (!encoded) return { ok: false, reason: 'empty' };
  if (encoded.length > MAX_ENCODED_ORIGINAL_FILENAME_LENGTH)
    return { ok: false, reason: 'too-long' };
  if (!BASE64URL_PATTERN.test(encoded) || encoded.length % 4 === 1) {
    return { ok: false, reason: 'invalid-base64url' };
  }

  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    return { ok: false, reason: 'invalid-base64url' };
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  try {
    const filename = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (!filename) return { ok: false, reason: 'empty' };
    return { ok: true, filename: filename.normalize('NFC') };
  } catch {
    return { ok: false, reason: 'invalid-utf8' };
  }
}

export type ResolveOriginalFilenameResult =
  { ok: true; filename: string } | { ok: false; reason: string };

/**
 * The single point of truth for "which filename does this upload use" -
 * deliberately never reads File.name. Pure function of the FormData
 * alone. Missing or invalid metadata is rejected outright - there is no
 * fallback to File.name.
 */
export function resolveOriginalFilenameFromFormData(
  formData: FormData
): ResolveOriginalFilenameResult {
  const encoded = formData.get(FORM_FIELD_ORIGINAL_FILENAME_UTF8_BASE64URL);
  if (typeof encoded !== 'string') {
    return { ok: false, reason: 'missing-original-filename-metadata' };
  }
  const decoded = decodeOriginalFilenameUtf8Base64Url(encoded);
  if (!decoded.ok) {
    return { ok: false, reason: `invalid-original-filename-metadata:${decoded.reason}` };
  }
  return { ok: true, filename: sanitizeOriginalFilename(decoded.filename) };
}

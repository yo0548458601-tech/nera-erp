/**
 * Client/browser-safe half of the original-filename metadata mechanism
 * (P014 - see originalFilenameMetadata.server.ts's doc comment for why
 * File.name is never trusted as the canonical filename). No import from
 * @nera/document-engine and no Node-only dependency - this module is
 * bundled for the browser (imported by DocumentsVerificationPanel.tsx, a
 * Client Component). Only Web-standard APIs (TextEncoder/btoa) are used.
 */
export const FORM_FIELD_ORIGINAL_FILENAME_UTF8_BASE64URL = 'originalFilenameUtf8Base64Url';

/** Browser-side: encodes a filename for safe, ASCII-only multipart transport. */
export function encodeOriginalFilenameUtf8Base64Url(filename: string): string {
  const bytes = new TextEncoder().encode(filename.normalize('NFC'));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

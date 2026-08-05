/**
 * Filename sanitization and Content-Disposition construction (ADR-011
 * Decision item 15). The Document Engine, not the Server Action layer or
 * the storage provider, owns this. `sanitizeOriginalFilename` is the
 * single authoritative cleaning step - it never transliterates or
 * otherwise damages Hebrew or any other valid Unicode text; it only
 * strips path separators, control characters, and enforces the persisted
 * column's length limit. The original filename is never placed in the
 * object key (Decision item 6); it exists only inside this header value
 * and, separately, as its own metadata field on the Document row.
 */

/** Matches the `documents.original_filename` column's `@db.VarChar(255)` limit exactly. */
export const MAX_ORIGINAL_FILENAME_LENGTH = 255;

// eslint-disable-next-line no-control-regex -- deliberate: stripping C0/C1 control characters is the point of this sanitizer, not an accidental regex mistake.
const CONTROL_CHARACTER_PATTERN = /[\x00-\x1f\x7f-\x9f]/g;

/**
 * NFC-normalizes (so visually/semantically identical text always compares
 * and stores consistently regardless of the input form it arrived in),
 * strips path separators and C0/C1 control characters (U+0000-U+001F,
 * U+007F-U+009F), and enforces the persisted column's length limit (by
 * Unicode code point, not raw UTF-16 code unit, so a surrogate pair is
 * never split).
 */
export function sanitizeOriginalFilename(filename: string): string {
  const normalized = filename.normalize('NFC');
  const withoutPathSeparators = normalized.replace(/[\\/]/g, '_');
  const withoutControlCharacters = withoutPathSeparators.replace(CONTROL_CHARACTER_PATTERN, '');
  const trimmed = withoutControlCharacters.trim();
  const result = trimmed || 'download';
  return Array.from(result).slice(0, MAX_ORIGINAL_FILENAME_LENGTH).join('');
}

/**
 * encodeURIComponent alone is not a complete RFC 5987 attr-char encoder -
 * it leaves apostrophe, parentheses, and asterisk unescaped, all of which
 * RFC 5987 excludes from attr-char. Percent-encodes those explicitly,
 * using uppercase hex to match encodeURIComponent's own convention.
 */
function encodeRfc5987ValueChars(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    char => '%' + char.charCodeAt(0).toString(16).toUpperCase()
  );
}

type DispositionType = 'attachment' | 'inline';

function buildDisposition(type: DispositionType, originalFilename: string): string {
  const sanitized = sanitizeOriginalFilename(originalFilename);
  const asciiFallback = sanitized.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
  const encoded = encodeRfc5987ValueChars(sanitized);
  return `${type}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

export function buildContentDisposition(originalFilename: string): string {
  return buildDisposition('attachment', originalFilename);
}

/**
 * Inline disposition for the "view" action (P014 Owner requirement) -
 * renders inside the application's in-page preview modal instead of
 * downloading. Callers must only use this for content types a browser can
 * safely render inline (see getDocumentUrl.ts's INLINE_VIEWABLE_CONTENT_TYPES)
 * - this function itself has no opinion on content type, matching
 * buildContentDisposition's existing scope (filename safety only).
 */
export function buildInlineContentDisposition(originalFilename: string): string {
  return buildDisposition('inline', originalFilename);
}

/**
 * Content-Disposition sanitization (ADR-011 Decision item 15). The Document
 * Engine, not the storage provider, owns this - the provider receives only
 * the already-sanitized value and performs no sanitization logic itself.
 * The original filename is never placed in the object key (Decision item
 * 6); it exists only inside this header value and, separately, as its own
 * metadata field on the Document row.
 *
 * Always forces `attachment` (Decision item 14) - every allowed V1 type
 * (PDF/JPG/JPEG/PNG/DOCX/XLSX) is treated as potentially renderable, so no
 * distinction is made between "safe to render inline" and "must download";
 * that would be an unrequested feature, not implied by the ADR.
 */
function stripUnsafeCharacters(filename: string): string {
  const withoutPathSeparators = filename.replace(/[\\/]/g, '_');
  // eslint-disable-next-line no-control-regex -- deliberate: stripping control characters is the point of this sanitizer, not an accidental regex mistake.
  const withoutControlCharacters = withoutPathSeparators.replace(/[\x00-\x1f\x7f]/g, '');
  return withoutControlCharacters.trim();
}

export function buildContentDisposition(originalFilename: string): string {
  const sanitized = stripUnsafeCharacters(originalFilename) || 'download';
  const asciiFallback = sanitized.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
  const encoded = encodeURIComponent(sanitized);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

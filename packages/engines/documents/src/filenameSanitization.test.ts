import { describe, expect, it } from 'vitest';
import { buildContentDisposition } from './filenameSanitization';

describe('buildContentDisposition', () => {
  it('always forces attachment (ADR-011 Decision item 14 - no inline distinction for any V1 type)', () => {
    expect(buildContentDisposition('invoice.pdf')).toMatch(/^attachment;/);
  });

  it('strips path separators from the filename (ADR-011 Decision item 15 - not a path-traversal guard: this value is never used as a filesystem path or the storage key, which is separately server-generated per Decision item 6)', () => {
    const result = buildContentDisposition('../../etc/passwd.pdf');
    expect(result).not.toContain('/');
    expect(result).not.toContain('\\');
  });

  it('strips control characters from the filename', () => {
    const withControlChars = `evil${String.fromCharCode(0)}${String.fromCharCode(27)}name.pdf`;
    const result = buildContentDisposition(withControlChars);
    // eslint-disable-next-line no-control-regex -- asserting the sanitizer's output contains no control characters.
    expect(/[\x00-\x1f\x7f]/.test(result)).toBe(false);
  });

  it('falls back to "download" when the filename is empty after stripping', () => {
    const result = buildContentDisposition(String.fromCharCode(0));
    expect(result).toContain('filename="download"');
  });

  it('provides both an ASCII fallback and a UTF-8 extended parameter for non-ASCII filenames', () => {
    const result = buildContentDisposition('חשבונית.pdf');
    expect(result).toContain('filename="');
    expect(result).toContain("filename*=UTF-8''");
    expect(result).toContain(encodeURIComponent('חשבונית.pdf'));
  });

  it('replaces double quotes in the ASCII fallback so the header value stays well-formed', () => {
    const result = buildContentDisposition('quote"name.pdf');
    const asciiFallbackMatch = result.match(/filename="([^]*?)"; filename\*=/);
    expect(asciiFallbackMatch?.[1]).not.toContain('"');
  });
});

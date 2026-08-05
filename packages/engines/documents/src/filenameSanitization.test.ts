import { describe, expect, it } from 'vitest';
import {
  MAX_ORIGINAL_FILENAME_LENGTH,
  buildContentDisposition,
  buildInlineContentDisposition,
  sanitizeOriginalFilename,
} from './filenameSanitization';

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

describe('buildContentDisposition - RFC 5987 strict encoding', () => {
  it('percent-encodes parentheses for the controlled Hebrew test filename, uppercase hex', () => {
    const result = buildContentDisposition('חשבונית ספק אברהם (2).pdf');
    const filenameStar = result.match(/filename\*=UTF-8''(\S+)/)?.[1] ?? '';
    expect(filenameStar).toContain('%28');
    expect(filenameStar).toContain('%29');
    expect(filenameStar).not.toMatch(/[()]/);
  });

  it('percent-encodes an apostrophe in the filename* parameter', () => {
    const result = buildContentDisposition("it's a document.pdf");
    const filenameStar = result.match(/filename\*=UTF-8''(\S+)/)?.[1] ?? '';
    expect(filenameStar).toContain('%27');
    expect(filenameStar).not.toContain("'");
  });

  it('percent-encodes an asterisk in the filename* parameter', () => {
    const result = buildContentDisposition('report*.pdf');
    const filenameStar = result.match(/filename\*=UTF-8''(\S+)/)?.[1] ?? '';
    expect(filenameStar).toContain('%2A');
    expect(filenameStar).not.toContain('*');
  });

  it('produces the expected ASCII fallback for the controlled Hebrew test filename', () => {
    const result = buildContentDisposition('חשבונית ספק אברהם (2).pdf');
    expect(result).toContain('filename="_______ ___ _____ (2).pdf"');
  });

  it('never contains a raw CR or LF, even if one was embedded in the input', () => {
    const result = buildContentDisposition('evil\r\nname.pdf');
    expect(result).not.toMatch(/[\r\n]/);
  });
});

describe('buildInlineContentDisposition', () => {
  it('uses inline, not attachment', () => {
    expect(buildInlineContentDisposition('invoice.pdf')).toMatch(/^inline;/);
  });

  it('applies the same RFC 5987 strict encoding as buildContentDisposition, for the controlled Hebrew test filename', () => {
    const result = buildInlineContentDisposition('חשבונית ספק אברהם (2).pdf');
    const filenameStar = result.match(/filename\*=UTF-8''(\S+)/)?.[1] ?? '';
    expect(filenameStar).toContain('%28');
    expect(filenameStar).toContain('%29');
    expect(result).toContain('filename="_______ ___ _____ (2).pdf"');
  });

  it('still strips control characters and path separators', () => {
    const result = buildInlineContentDisposition(`../../etc/evil${String.fromCharCode(0)}name.pdf`);
    expect(result).not.toMatch(/[\\/]/);
    // eslint-disable-next-line no-control-regex
    expect(/[\x00-\x1f\x7f-\x9f]/.test(result)).toBe(false);
  });
});

describe('sanitizeOriginalFilename', () => {
  it.each([
    'חשבונית ספק אברהם (2).pdf',
    'קובץ עם רווחים ו(סוגריים).pdf',
    'דוח2024-Report_A.pdf',
  ])('preserves Hebrew, spaces, parentheses, digits, and Latin letters unchanged: %s', filename => {
    expect(sanitizeOriginalFilename(filename)).toBe(filename);
  });

  it('normalizes to NFC', () => {
    const nfd = 'א'.normalize('NFD') + '.pdf';
    expect(sanitizeOriginalFilename(nfd)).toBe(nfd.normalize('NFC'));
  });

  it('strips path separators', () => {
    expect(sanitizeOriginalFilename('../../etc/passwd.pdf')).not.toMatch(/[\\/]/);
  });

  it.each([
    ['U+0000 (NUL)', String.fromCharCode(0x00)],
    ['U+001B (ESC)', String.fromCharCode(0x1b)],
    ['U+007F (DEL)', String.fromCharCode(0x7f)],
    ['U+0097 (C1 control - the exact byte value seen in the P014 mojibake defect)', String.fromCharCode(0x97)],
  ])('strips %s', (_label, controlChar) => {
    const result = sanitizeOriginalFilename(`evil${controlChar}name.pdf`);
    // eslint-disable-next-line no-control-regex
    expect(/[\x00-\x1f\x7f-\x9f]/.test(result)).toBe(false);
    expect(result).toBe('evilname.pdf');
  });

  it('does not truncate exactly 255 Unicode code points', () => {
    const exactly255 = '\u{10800}'.repeat(255);
    expect(Array.from(sanitizeOriginalFilename(exactly255)).length).toBe(255);
  });

  it('truncates 256 Unicode code points down to 255 without splitting a surrogate pair', () => {
    const oneOver = '\u{10800}'.repeat(256);
    const result = sanitizeOriginalFilename(oneOver);
    expect(Array.from(result).length).toBe(MAX_ORIGINAL_FILENAME_LENGTH);
    expect(result).not.toMatch(/�/); // no broken surrogate produced a replacement character
  });

  it('falls back to "download" when empty after stripping', () => {
    expect(sanitizeOriginalFilename(String.fromCharCode(0))).toBe('download');
  });
});

import { describe, expect, it } from 'vitest';
import {
  MAX_ENCODED_ORIGINAL_FILENAME_LENGTH,
  decodeOriginalFilenameUtf8Base64Url,
  resolveOriginalFilenameFromFormData,
} from './originalFilenameMetadata.serverCore';
import {
  FORM_FIELD_ORIGINAL_FILENAME_UTF8_BASE64URL,
  encodeOriginalFilenameUtf8Base64Url,
} from './originalFilenameMetadata.shared';

describe('encodeOriginalFilenameUtf8Base64Url / decodeOriginalFilenameUtf8Base64Url', () => {
  it.each([
    'חשבונית ספק אברהם (2).pdf',
    'קובץ עם רווחים ו(סוגריים).pdf',
    'דוח2024-Report_A.pdf',
    'invoice.pdf',
  ])('round-trips exactly: %s', filename => {
    const encoded = encodeOriginalFilenameUtf8Base64Url(filename);
    expect(/^[A-Za-z0-9_-]*$/.test(encoded)).toBe(true);
    const decoded = decodeOriginalFilenameUtf8Base64Url(encoded);
    expect(decoded).toEqual({ ok: true, filename });
  });

  it('normalizes to NFC on decode', () => {
    const nfd = 'א'.normalize('NFD') + '.pdf';
    const encoded = encodeOriginalFilenameUtf8Base64Url(nfd);
    const decoded = decodeOriginalFilenameUtf8Base64Url(encoded);
    expect(decoded.ok && decoded.filename).toBe(nfd.normalize('NFC'));
  });

  it('round-trips 255 four-byte Unicode code points exactly', () => {
    const filename = '\u{10800}'.repeat(255); // U+10800, a 4-byte UTF-8 astral character
    const encoded = encodeOriginalFilenameUtf8Base64Url(filename);
    expect(encoded.length).toBeLessThanOrEqual(MAX_ENCODED_ORIGINAL_FILENAME_LENGTH);
    expect(decodeOriginalFilenameUtf8Base64Url(encoded)).toEqual({ ok: true, filename });
  });

  it('accepts an encoded value at exactly the transport cap', () => {
    // 1536 ASCII bytes -> exactly 2048 unpadded Base64URL characters (1536 is divisible by 3).
    const encoded = encodeOriginalFilenameUtf8Base64Url('A'.repeat(1536));
    expect(encoded.length).toBe(MAX_ENCODED_ORIGINAL_FILENAME_LENGTH);
    expect(decodeOriginalFilenameUtf8Base64Url(encoded).ok).toBe(true);
  });

  it('rejects an encoded value one character beyond the transport cap', () => {
    const oneOver = 'A'.repeat(MAX_ENCODED_ORIGINAL_FILENAME_LENGTH + 1);
    expect(decodeOriginalFilenameUtf8Base64Url(oneOver)).toEqual({ ok: false, reason: 'too-long' });
  });

  it('rejects an empty string', () => {
    expect(decodeOriginalFilenameUtf8Base64Url('')).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects a string with invalid Base64URL characters', () => {
    expect(decodeOriginalFilenameUtf8Base64Url('not!valid@base64url')).toEqual({
      ok: false,
      reason: 'invalid-base64url',
    });
  });

  it('rejects a string with an invalid Base64 length (length % 4 === 1)', () => {
    expect(decodeOriginalFilenameUtf8Base64Url('A')).toEqual({ ok: false, reason: 'invalid-base64url' });
  });

  it('rejects bytes that are not valid UTF-8', () => {
    // 0xFF is never valid as a UTF-8 lead byte.
    const invalidUtf8Base64Url = Buffer.from([0xff, 0xfe]).toString('base64url');
    expect(decodeOriginalFilenameUtf8Base64Url(invalidUtf8Base64Url)).toEqual({
      ok: false,
      reason: 'invalid-utf8',
    });
  });
});

describe('resolveOriginalFilenameFromFormData', () => {
  it('ignores a corrupted/irrelevant File.name and uses the decoded metadata field', () => {
    const formData = new FormData();
    formData.set('file', new File([new Uint8Array([1, 2, 3])], 'mojibake-garbage-name.pdf'));
    formData.set(
      FORM_FIELD_ORIGINAL_FILENAME_UTF8_BASE64URL,
      encodeOriginalFilenameUtf8Base64Url('חשבונית ספק אברהם (2).pdf')
    );

    const result = resolveOriginalFilenameFromFormData(formData);
    expect(result).toEqual({ ok: true, filename: 'חשבונית ספק אברהם (2).pdf' });
  });

  it('rejects when the metadata field is missing', () => {
    const formData = new FormData();
    formData.set('file', new File([new Uint8Array([1])], 'anything.pdf'));
    const result = resolveOriginalFilenameFromFormData(formData);
    expect(result.ok).toBe(false);
  });

  it('rejects when the metadata field is malformed', () => {
    const formData = new FormData();
    formData.set('file', new File([new Uint8Array([1])], 'anything.pdf'));
    formData.set(FORM_FIELD_ORIGINAL_FILENAME_UTF8_BASE64URL, 'not!valid@base64url');
    const result = resolveOriginalFilenameFromFormData(formData);
    expect(result.ok).toBe(false);
  });

  it('strips control characters and path separators from the decoded filename via sanitizeOriginalFilename', () => {
    const formData = new FormData();
    formData.set('file', new File([new Uint8Array([1])], 'irrelevant.pdf'));
    formData.set(
      FORM_FIELD_ORIGINAL_FILENAME_UTF8_BASE64URL,
      encodeOriginalFilenameUtf8Base64Url(`../../etc/evil${String.fromCharCode(0)}.pdf`)
    );
    const result = resolveOriginalFilenameFromFormData(formData);
    expect(result.ok && result.filename).not.toMatch(/[\\/]/);
    // eslint-disable-next-line no-control-regex
    expect(result.ok && /[\x00-\x1f\x7f]/.test(result.filename)).toBe(false);
  });
});

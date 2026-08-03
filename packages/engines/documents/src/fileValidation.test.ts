import { describe, expect, it } from 'vitest';
import { MAX_DOCUMENT_UPLOAD_SIZE_BYTES, validateFileUpload } from './fileValidation';

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x01, 0x02, 0x03]);
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0x01, 0x02]);
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);
const ZIP_OOXML_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x01, 0x02]);
const RANDOM_BYTES = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);

describe('validateFileUpload', () => {
  it.each([
    ['invoice.pdf', 'application/pdf', PDF_BYTES],
    ['photo.jpg', 'image/jpeg', JPEG_BYTES],
    ['photo.jpeg', 'image/jpeg', JPEG_BYTES],
    ['scan.png', 'image/png', PNG_BYTES],
    [
      'contract.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ZIP_OOXML_BYTES,
    ],
    [
      'budget.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ZIP_OOXML_BYTES,
    ],
  ])(
    'accepts an allowed type with matching extension, content-type, and signature: %s',
    (filename, declaredContentType, bytes) => {
      const result = validateFileUpload({
        filename,
        declaredContentType,
        sizeBytes: bytes.length,
        bytes,
      });
      expect(result).toEqual({ ok: true });
    }
  );

  it('rejects an empty file', () => {
    const result = validateFileUpload({
      filename: 'invoice.pdf',
      declaredContentType: 'application/pdf',
      sizeBytes: 0,
      bytes: new Uint8Array(0),
    });
    expect(result).toEqual({ ok: false, reason: 'file-empty' });
  });

  it('rejects a file over the 25 MB limit (ADR-013 Decision item B)', () => {
    const result = validateFileUpload({
      filename: 'invoice.pdf',
      declaredContentType: 'application/pdf',
      sizeBytes: MAX_DOCUMENT_UPLOAD_SIZE_BYTES + 1,
      bytes: PDF_BYTES,
    });
    expect(result).toEqual({ ok: false, reason: 'file-too-large' });
  });

  it.each(['malware.exe', 'script.js', 'page.html', 'vector.svg', 'macro.docm', 'macro.xlsm'])(
    'rejects a disallowed file type: %s (closed allowlist, ADR-013 Decision item A)',
    filename => {
      const result = validateFileUpload({
        filename,
        declaredContentType: 'application/octet-stream',
        sizeBytes: 10,
        bytes: RANDOM_BYTES,
      });
      expect(result).toEqual({ ok: false, reason: 'file-type-not-allowed' });
    }
  );

  it('rejects a mismatched declared content-type for an otherwise-allowed extension', () => {
    const result = validateFileUpload({
      filename: 'invoice.pdf',
      declaredContentType: 'image/png',
      sizeBytes: PDF_BYTES.length,
      bytes: PDF_BYTES,
    });
    expect(result).toEqual({ ok: false, reason: 'content-type-mismatch' });
  });

  it('rejects a file whose signature does not match its extension - e.g. a renamed .exe (magic-byte check, ADR-013 Decision item A)', () => {
    const result = validateFileUpload({
      filename: 'invoice.pdf',
      declaredContentType: 'application/pdf',
      sizeBytes: RANDOM_BYTES.length,
      bytes: RANDOM_BYTES,
    });
    expect(result).toEqual({ ok: false, reason: 'file-signature-mismatch' });
  });

  it('is case-insensitive on the file extension', () => {
    const result = validateFileUpload({
      filename: 'INVOICE.PDF',
      declaredContentType: 'application/pdf',
      sizeBytes: PDF_BYTES.length,
      bytes: PDF_BYTES,
    });
    expect(result).toEqual({ ok: true });
  });

  it('rejects a file with no extension', () => {
    const result = validateFileUpload({
      filename: 'noextension',
      declaredContentType: 'application/pdf',
      sizeBytes: PDF_BYTES.length,
      bytes: PDF_BYTES,
    });
    expect(result).toEqual({ ok: false, reason: 'file-type-not-allowed' });
  });
});

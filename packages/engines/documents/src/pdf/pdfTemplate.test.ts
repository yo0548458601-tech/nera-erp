import React from 'react';
import { Document, Page, Text } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import { generatePdf, type PdfTemplate } from './pdfTemplate';
import { extractPdfPageTexts } from './extractPdfPageTexts';

type GreetingData = { name: string };

const greetingTemplate: PdfTemplate<GreetingData> = data =>
  React.createElement(
    Document,
    null,
    React.createElement(Page, null, React.createElement(Text, null, `Hello, ${data.name}`))
  );

describe('generatePdf', () => {
  it('renders a template + data into real PDF bytes', async () => {
    const bytes = await generatePdf(greetingTemplate, { name: 'Nera' });

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
    // "%PDF-" magic bytes (ADR-013 Decision item A's own signature check reused as a sanity assertion here).
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');

    const [pageText] = await extractPdfPageTexts(bytes);
    expect(pageText).toContain('Hello, Nera');
  });

  it('renders user-originated data strictly as text - never as executable template logic', async () => {
    const maliciousLookingName = '<script>alert(1)</script>';
    const bytes = await generatePdf(greetingTemplate, { name: maliciousLookingName });

    const [pageText] = await extractPdfPageTexts(bytes);
    expect(pageText).toContain(maliciousLookingName);
  });
});

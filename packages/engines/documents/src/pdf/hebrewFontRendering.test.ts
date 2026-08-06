import React from 'react';
import { Document, Page, Text, StyleSheet } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import { generatePdf, type PdfTemplate } from './pdfTemplate';
import { extractPdfPageTexts } from './extractPdfPageTexts';
import { DOCUMENT_ENGINE_FONT_FAMILY } from './fonts';

const styles = StyleSheet.create({
  page: { padding: 30 },
  text: { fontFamily: DOCUMENT_ENGINE_FONT_FAMILY, fontSize: 14 },
});

function textTemplate(lines: string[]): PdfTemplate<Record<string, never>> {
  return () =>
    React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: 'A4', style: styles.page },
        ...lines.map((line, index) =>
          React.createElement(Text, { key: index, style: styles.text }, line)
        )
      )
    );
}

/**
 * Font resolution re-verification (ADR-012 Decision item 8, resolved -
 * see `fonts.ts`'s module doc comment for the full account). Re-run after
 * switching from the Google Fonts mirror's variable font (Thin default) to
 * the authoritative upstream's prebuilt static Regular build.
 */
describe('PDF font resolution (ADR-012 Decision item 8)', () => {
  it('embeds "NotoSansHebrew-Regular" as the PDF font BaseFont - never "Thin"', async () => {
    const bytes = await generatePdf(textTemplate(['שלום עולם']), {});
    // Font subsetting prefixes the PostScript name with a random 6-letter
    // tag (e.g. "ABCDEF+NotoSansHebrew-Regular") per the PDF spec - search
    // for the unprefixed suffix, which is stable.
    const pdfText = Buffer.from(bytes).toString('latin1');
    expect(pdfText).toContain('NotoSansHebrew-Regular');
    expect(pdfText).not.toContain('NotoSansHebrew-Thin');
  });

  it('renders a simple Hebrew phrase and extracts it correctly via PDF.js getTextContent()', async () => {
    const bytes = await generatePdf(textTemplate(['שלום עולם']), {});
    const [pageText] = await extractPdfPageTexts(bytes);
    expect(pageText).toContain('שלום עולם');
  });

  it('extracts an invoice identifier embedded in a Hebrew sentence correctly, in order', async () => {
    const bytes = await generatePdf(textTemplate(['מספר חשבונית: INV-2026-004821']), {});
    const [pageText] = await extractPdfPageTexts(bytes);
    expect(pageText).toContain('INV-2026-004821');
  });

  it(
    'records the current state of the known mixed Hebrew+digit+parenthesis text-extraction ' +
      'limitation (ADR-012 Decision item 5) against the resolved static font - a tracked risk, ' +
      'not a blocker; template authors should still avoid embedding a copy-sensitive identifier ' +
      'inside parentheses mid-sentence (ADR-012 template-authoring guidance)',
    async () => {
      const bytes = await generatePdf(textTemplate(['פריט (מק"ט 1000) במלאי']), {});
      const [pageText] = await extractPdfPageTexts(bytes);
      // Documented behavior, not asserted as "fixed": React PDF's extracted
      // text layer may swap the parenthesis characters themselves for
      // tightly-mixed Hebrew+digit+parenthesis runs (ADR-012 Context). This
      // assertion only proves the surrounding Hebrew text and the digits
      // both extract - it deliberately does not assert byte-exact
      // parenthesis-order correctness, per the ADR's own scope.
      expect(pageText).toContain('1000');
      expect(pageText).toContain('פריט');
      expect(pageText).toContain('במלאי');
    }
  );
});

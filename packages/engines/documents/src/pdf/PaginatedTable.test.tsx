import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { Document, Page, StyleSheet } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import { generatePdf, type PdfTemplate } from './pdfTemplate';
import { PaginatedTable } from './PaginatedTable';
import { extractPdfPageTexts } from './extractPdfPageTexts';

const styles = StyleSheet.create({ page: { padding: 30 } });

type Row = { id: number; name: string };

/**
 * 60 rows reliably forces a two-page break at A4/default row height -
 * matching the row count used to prove this same behavior in ADR-012's own
 * spike.
 */
const rows: Row[] = Array.from({ length: 60 }, (_, index) => ({
  id: index + 1,
  name: `Item ${index + 1}`,
}));

const template: PdfTemplate<{ rows: Row[] }> = data =>
  React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(PaginatedTable<Row>, {
        columns: [
          { key: 'id', header: 'ID', render: (row: Row) => String(row.id), width: 40 },
          { key: 'name', header: 'Item Name', render: (row: Row) => row.name },
        ],
        rows: data.rows,
      })
    )
  );

describe('PaginatedTable', () => {
  it('repeats the header row on every physical page the table body spans (ADR-012 Decision item 4)', async () => {
    const bytes = await generatePdf(template, { rows });

    // Checked-in visual fixture: openable directly in any PDF viewer for
    // human visual inspection (a lighter-weight equivalent of a rasterized
    // PNG fixture, avoiding a new native canvas-rendering dependency this
    // Node-only engine otherwise has no use for). Written from a copy,
    // and before extraction below - pdfjs-dist takes ownership of the
    // `Uint8Array` it's given (transferable-object semantics), which
    // otherwise leaves `bytes` detached/empty by the time this runs.
    const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__');
    if (!existsSync(fixtureDir)) mkdirSync(fixtureDir, { recursive: true });
    writeFileSync(path.join(fixtureDir, 'paginatedTableHeaderRepeat.pdf'), Buffer.from(bytes));

    const pageTexts = await extractPdfPageTexts(bytes);

    expect(pageTexts.length).toBeGreaterThanOrEqual(2);
    for (const pageText of pageTexts) {
      expect(pageText).toContain('ID');
      expect(pageText).toContain('Item Name');
    }

    // Row content itself must not repeat - only the header - proving this
    // isn't merely "everything renders on every page".
    expect(pageTexts[0]).toContain('Item 1');
    expect(pageTexts[0]).not.toContain('Item 60');
    expect(pageTexts[pageTexts.length - 1]).toContain('Item 60');
    expect(pageTexts[pageTexts.length - 1]).not.toContain('Item 1 ');
  });
});

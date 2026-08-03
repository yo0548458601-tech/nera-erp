/**
 * A P014 verification-only sample template - stands in for a future real
 * module's `PdfTemplate` (e.g. `modules/invoices`) until one exists. Uses
 * only the Document Engine's own re-exported primitives
 * (`@nera/document-engine`'s `pdf/primitives.ts`), never
 * `@react-pdf/renderer` directly, per ADR-012 Decision item 7's "no engine
 * bypass" rule - this file is a plain module (not `'use server'`) because
 * `documentActions.ts`'s Server Action exports must themselves be async
 * functions (NERA_ARCHITECTURAL_INVARIANTS.md §8.2).
 */
import {
  PdfDocument,
  PdfPage,
  PdfText,
  PdfStyleSheet,
  PaginatedTable,
  DOCUMENT_ENGINE_FONT_FAMILY,
  type PdfTemplate,
} from '@nera/document-engine';

const styles = PdfStyleSheet.create({
  page: { padding: 30 },
  title: { fontFamily: DOCUMENT_ENGINE_FONT_FAMILY, fontSize: 18, marginBottom: 4 },
  subtitle: {
    fontFamily: DOCUMENT_ENGINE_FONT_FAMILY,
    fontSize: 11,
    marginBottom: 16,
    color: '#555',
  },
});

export type SampleInvoiceRow = { id: number; description: string; amount: string };

export type SampleInvoiceData = {
  invoiceNumber: string;
  rows: SampleInvoiceRow[];
};

/** 60 rows reliably forces a two-page break - real, visible proof of the header-repeat fix (ADR-012 Decision item 4) when opened in a real PDF viewer. */
export function buildSampleInvoiceRows(count = 60): SampleInvoiceRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    description: `שורת חשבונית לדוגמה ${index + 1} (מק"ט ${1000 + index})`,
    amount: `${((index + 1) * 12.5).toFixed(2)} ₪`,
  }));
}

export const sampleInvoiceTemplate: PdfTemplate<SampleInvoiceData> = data => (
  <PdfDocument>
    <PdfPage size="A4" style={styles.page}>
      <PdfText style={styles.title}>חשבונית לדוגמה - P014</PdfText>
      <PdfText style={styles.subtitle}>מספר חשבונית: {data.invoiceNumber}</PdfText>
      <PaginatedTable<SampleInvoiceRow>
        columns={[
          { key: 'id', header: '#', render: row => String(row.id), width: 30 },
          { key: 'description', header: 'תיאור', render: row => row.description },
          { key: 'amount', header: 'סכום', render: row => row.amount, width: 80 },
        ]}
        rows={data.rows}
      />
    </PdfPage>
  </PdfDocument>
);

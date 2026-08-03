/**
 * Re-exports the React PDF layout primitives a template needs to compose
 * "document-specific fields, wording, ordering, layout composition"
 * (ADR-012 Decision item 7) - so that template authors (a future business
 * module, or this sprint's own verification surface) never need
 * `import ... from '@react-pdf/renderer'` directly. The Document Engine
 * remains the one package with a real dependency on `@react-pdf/renderer`
 * (ADR-012's "no engine bypass" rule); this module is the sanctioned door
 * through it, not a loophole around it - `generatePdf`/`PdfTemplate` (see
 * `pdfTemplate.ts`) still remain the only way to actually render a
 * template into bytes.
 */
export {
  Document as PdfDocument,
  Page as PdfPage,
  Text as PdfText,
  View as PdfView,
  StyleSheet as PdfStyleSheet,
  Image as PdfImage,
} from '@react-pdf/renderer';

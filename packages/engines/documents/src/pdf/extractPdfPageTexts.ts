/**
 * Extracts each page's text content from a rendered PDF, using PDF.js's
 * real `getTextContent()` API - the same mechanism that powers copy-paste
 * and Ctrl+F search in a real PDF viewer (ADR-012's own verification
 * method for the header-repeat proof-of-concept). Test-only: not part of
 * the Document Engine's public contract.
 */
export async function extractPdfPageTexts(bytes: Uint8Array): Promise<string[]> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map(item => ('str' in item ? item.str : '')).join(' '));
  }

  return pageTexts;
}

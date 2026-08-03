import type { ReactElement } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { ensureDocumentFontsRegistered } from './fonts.js';

/**
 * A template is a trusted, version-controlled, server-only TypeScript
 * function/React-PDF component, authored inside the owning business
 * module's own source tree and passed by direct code reference - never a
 * string, never JSX/HTML/JavaScript submitted or uploaded by a user, never
 * loaded dynamically from a database or file at runtime (ADR-012 Decision
 * item 7). This type signature makes "a user submits a template"
 * structurally impossible - there is no string/JSON input path here.
 */
export type PdfTemplate<TData> = (data: TData) => ReactElement;

/**
 * `generatePdf` is the one call site that binds `@react-pdf/renderer` -
 * business modules must not bypass the Document Engine and invoke React PDF
 * (or any other PDF library) directly (ADR-012 Decision item 7). `data`,
 * which may contain user-originated business values, is rendered strictly
 * as text content through React PDF's `<Text>` primitive, which has no
 * `dangerouslySetInnerHTML` equivalent and never interprets its children as
 * markup - user-controlled data cannot become executable template logic.
 */
export async function generatePdf<TData>(
  template: PdfTemplate<TData>,
  data: TData
): Promise<Uint8Array> {
  ensureDocumentFontsRegistered();
  const buffer = await renderToBuffer(template(data));
  return new Uint8Array(buffer);
}

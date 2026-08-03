import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Font } from '@react-pdf/renderer';

/**
 * Noto Sans Hebrew font pinning (ADR-012 Decision item 8; P014) - RESOLVED.
 *
 * Source: the **official, authoritative upstream** (`notofonts/hebrew`,
 * not the Google Fonts mirror this ADR's original spike used), an
 * immutable, versioned GitHub Release - never the moving `main` branch:
 * `https://github.com/notofonts/hebrew/releases/download/NotoSansHebrew-v3.001/NotoSansHebrew-v3.001.zip`
 * Release archive SHA-256: `df0a71814b4e63644cf40fcc4529111b61266b7a2dafbe95068b29a7520cc3cb`
 * (independently computed against the downloaded archive).
 *
 * This is a **genuine prebuilt static Regular build shipped by the
 * authoritative upstream itself** (`NotoSansHebrew/full/ttf/NotoSansHebrew-Regular.ttf`
 * inside the release archive) - no build-time instancing step was needed
 * or performed. Verified directly via `fontkit` against the committed
 * file:
 *   - `postscriptName`: `NotoSansHebrew-Regular` (unambiguous)
 *   - `familyName` / `subfamilyName` / `fullName`: `Noto Sans Hebrew` /
 *     `Regular` / `Noto Sans Hebrew Regular`
 *   - `version`: `Version 3.001; ttfautohint (v1.8.4.7-5d5b)`
 *   - **not a variable font** (`variationAxes` is empty) - there is no
 *     default-instance ambiguity to resolve, unlike the earlier Google
 *     Fonts mirror variable-font binary this ADR's original spike used.
 * Committed font file SHA-256:
 * `671951828bd5c95db818e5bb12dcea2d0c0dda00311888522be061ee6835125e`.
 * The applicable SIL Open Font License text is committed alongside it at
 * `./fonts/OFL.txt` (from the same release archive, SHA-256
 * `9b9fe028b5ba74d231659a1bbaf0ed09b11e759d1ca6a070999e16d151616b47`).
 *
 * **History (why this superseded the original approach):** the original
 * P014 implementation embedded the Google Fonts mirror's *variable* font
 * binary, whose default named instance resolves to "Thin", not "Regular" -
 * a real ADR-012 violation. The originally attempted fix (`fontkit`
 * named-instance selection via `postscriptName: 'Regular'` at `Font.register`
 * time) was verified to select the correct Regular-weight glyph outlines
 * for layout, but crashed inside fontkit 2.0.4's own glyph-subsetting code
 * (`TTFSubset`/`TTFGlyphEncoder` -> `new DataView(...)`: "First argument to
 * DataView constructor must be an ArrayBuffer") when `generatePdf()` actually
 * tried to embed those variation-derived glyphs into a real PDF - a real
 * fontkit limitation, not an application-code bug. Rather than retry that
 * already-disproven path, or attempt Python `fonttools` static instancing
 * (unavailable in the implementation environment), the authoritative
 * upstream's own release archive was checked first and found to already
 * ship exactly the required static Regular build - the correct fix per
 * ADR-012 item 8's own listed alternative ("(b) source a pre-built static
 * Regular `.ttf` release directly from the font's authoritative upstream").
 *
 * No runtime download: this file is loaded from the repository-committed
 * path below only.
 */
const FONT_FILE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fonts',
  'NotoSansHebrew-Regular.ttf'
);

export const DOCUMENT_ENGINE_FONT_FAMILY = 'NotoSansHebrew';

let registered = false;

/** Idempotent - safe to call before every `generatePdf()` invocation. */
export function ensureDocumentFontsRegistered(): void {
  if (registered) return;
  Font.register({
    family: DOCUMENT_ENGINE_FONT_FAMILY,
    src: FONT_FILE_PATH,
    fontWeight: 'normal',
  });
  registered = true;
}

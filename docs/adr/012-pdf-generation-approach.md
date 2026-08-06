# ADR-012 — PDF Generation Approach for the Document Engine

**Status:** Accepted
**Date:** 2026-08-02

---

## Context

`ENGINE_MAP.md` §6's Document Engine contract names `generatePdf(template, data)`. `TECH_STACK.md`
Part 2 lists "React PDF" as an aspirational direction; Part 2's own rule requires its own ADR
before real adoption. `ADR-011` governs storage only; this ADR resolves PDF generation.

A real, executed comparison spike (outside the repository) rendered an identical Hebrew/RTL
invoice fixture — RTL header, a long wrapping note, a 70-row mixed Hebrew/digit table forcing a
two-page break — through three candidates: React PDF, headless-browser HTML-to-PDF
(Playwright/Chromium), and pdf-lib. The full artifact manifest, exact tool versions, checksums,
and reproduction commands are recorded in the accompanying Sprint report and are not duplicated
here beyond what the Decision needs to cite.

**Visual/pixel results:** React PDF and the headless-browser approach both produced correct RTL
layout, correct Hebrew glyph shaping, and correct visual bidi ordering, verified by rasterizing
every page and visually inspecting it. `pdf-lib` has no built-in bidi/RTL support; the natural
first-attempt workaround (character reversal) produced actively incorrect, word-mirrored Hebrew —
a decisive, demonstrated failure, not a matter of polish.

**Logical-text extraction results (a distinct, deeper verification than pixels):** using PDF.js's
real `getTextContent()` API — the same mechanism that powers copy-paste and Ctrl+F search in a
real PDF viewer — both viable candidates passed for simple content (a standalone Hebrew word, a
multi-word Hebrew phrase, and the bare invoice identifier `INV-2026-004821` all extract correctly
and in correct order for both). **Both candidates showed a real, reproducible defect specifically
for tightly-mixed Hebrew+digit+parenthesis content** (e.g. a product code written as
`(מק"ט 1000)` embedded inside an RTL sentence):

- **React PDF**: the parenthesis _characters themselves_ are swapped in the extracted text layer
  (`)מק"ט 1000(` instead of `(מק"ט 1000)`) — the page looks visually correct (parenthesis mirroring
  is a normal, correct bidi rendering behavior), but the underlying extractable/copyable text
  contains the wrong literal punctuation characters.
- **Headless-browser (Chromium)**: the parenthesis characters themselves are stored correctly
  (verified directly via individual text items), but the relative order of the two sub-runs inside
  the parenthetical (the Hebrew abbreviation and the digit run) is not always reconstructed in
  perfect logical order by the browser's own text-layer extraction.

Neither defect affects the already-approved visual/pixel selection of React PDF, and neither
affects extraction of Hebrew text, phrases, or identifiers that are not tightly interleaved with
parenthetical mixed-direction content. Both are treated as a known, tracked, narrow risk (see
Decision item 5 and Follow-up Actions), not as grounds to reopen the candidate selection the Owner
already approved.

**Performance evidence**, measured with isolated installs (to correctly include transitive
dependencies) and multiple timed runs: React PDF's full dependency tree is 38 MB, cold-starts in
~740–800ms across 3 runs; `pdf-lib`+fontkit is 29 MB, ~480–730ms; the headless-browser approach's
own npm package is 19 MB but requires a separately-downloaded 428 MB Chromium binary, and
cold-starts in ~1.2–2.4s across 3 runs. A 1000-row stress fixture for React PDF rendered
successfully in ~5.5s, producing a valid, reloadable 24-page PDF with no corruption (peak RSS
~361MB) — full detail in the Sprint report.

`NERA_CONSTITUTION.md` §4.3 requires Hebrew-first, full RTL support from day one. `NERA_CONSTITUTION.md`
§3.1/§12 require Core Engines to stay generic and free of business/industry-specific logic.
`NERA_CONSTITUTION.md` §6 (Security) requires that no user-controlled input be capable of executing
as code — directly relevant to Decision item 4's template-trust boundary.

## Decision

1. **`pdf-lib` is rejected** for any RTL-bearing document. Its lack of bidi support produced
   demonstrably incorrect Hebrew text; adopting it would require building and maintaining a custom
   bidi implementation, not justified when two working alternatives exist.
2. **React PDF (`@react-pdf/renderer`) is selected as the Document Engine's PDF rendering
   library** for V1: correct verified RTL/bidi visual behavior, the lighter dependency footprint
   and faster cold-start of the two viable candidates, and no bundled-browser deployment artifact.
3. **The headless-browser approach is rejected as the default** for the reasons above (428 MB
   deployment footprint, ~3x slower cold-start), despite its real advantage of automatically
   repeating table headers across pages via native CSS.
4. **The table-header-repeat gap is a required P014 implementation item, not an accepted
   limitation.** The spike additionally produced and visually verified a working proof-of-concept
   (React PDF's `fixed`-prop pattern, applied to a header `View` re-declared once and rendered on
   every physical page) that closes this gap completely — confirmed by rasterizing page 2 of the
   proof-of-concept and observing the header present and correctly positioned. **P014 must
   implement this as a generic, reusable paginated-table helper inside the Document Engine — not
   re-solved ad hoc per module — and P014 is not complete if a multi-page table's header is
   missing on any page.** This requires its own automated regression test (asserting the header
   text is present in the extracted text/structure of every page a table spans) and a visual
   fixture, per the existing repository precedent for UI-reachable changes
   (`NERA_ARCHITECTURAL_INVARIANTS.md` §10.6).
5. **The mixed Hebrew+digit+parenthesis text-extraction defect (see Context) is a tracked,
   documented risk, not a blocker to acceptance.** P014's template guidance must note that
   parenthetical product/reference codes embedded directly in Hebrew sentences may extract with
   incorrect punctuation-character order; where a template needs a guaranteed-correct-on-copy
   identifier (e.g. an invoice number a user might copy to search elsewhere), it should be laid
   out as its own distinct text run/field rather than embedded mid-sentence in parentheses — this
   is a template-authoring guideline, not a Document Engine code change, and is captured as a
   Follow-up Action.
6. **Font: Noto Sans Hebrew is the default embedded technical font for V1**, subject to the pinning
   requirements in item 8. This is a V1 technical default, not an irreversible branding decision —
   a future organization-branding capability may introduce a governed font registry with approved
   alternatives; that capability is explicitly out of scope for P014.
7. **Template trust and ownership boundary — `generatePdf(template, data)` is precisely typed and
   bounded:**
   ```ts
   export type PdfTemplate<TData> = (data: TData) => ReactElement;

   export interface DocumentEngine {
     generatePdf<TData>(template: PdfTemplate<TData>, data: TData): Promise<Uint8Array>;
   }
   ```
   - A template is a **trusted, version-controlled, server-only TypeScript function/React-PDF
     component**, authored inside the owning business module's own source tree (e.g.
     `modules/invoices/src/documents/InvoiceTemplate.tsx`) and passed **by direct code reference**
     — never a string, never JSX/HTML/JavaScript submitted or uploaded by a user, never loaded
     dynamically from a database or file at runtime.
   - **Users cannot supply, upload, or submit a template of any kind.** `data`, which may contain
     user-originated business values, is rendered strictly as text content through React PDF's
     `<Text>` primitive — which has no equivalent of `dangerouslySetInnerHTML` and does not
     interpret its children as markup — so user-controlled data cannot become executable template
     logic under any input.
   - **The Document Engine owns:** the `generatePdf` invocation itself; the React PDF binding; the
     font registry (item 6/8); generic, reusable page/table primitives (including the paginated-
     table header helper from item 4); output-byte generation; and common rendering safeguards.
   - **Business modules own:** document-specific fields, wording, ordering, layout composition, and
     whatever branding inputs the platform explicitly permits (e.g. a logo asset reference) — never
     raw executable content.
   - **Business modules must not bypass the Document Engine and invoke React PDF, or any other PDF
     library, directly** — mirroring the same "no engine bypass" discipline already established
     for storage (`ADR-011`) and every other Core Engine boundary
     (`NERA_CONSTITUTION.md` §3.1, §12).
8. **Font pinning and provenance policy — no runtime download, fully deterministic:**
   - The exact font binary used in this ADR's spike is recorded by content, not shipped in this
     document: SHA-256 `7ef36a2c3593758cdb622e1bdef4f84523e92fbc3ccc667438dd80ff54c2de88`,
     downloaded from the Google Fonts mirror
     (`ofl/notosanshebrew/NotoSansHebrew[wdth,wght].ttf`, `main` branch — a **moving reference**,
     not yet re-pinned to an immutable commit SHA due to GitHub API rate-limiting encountered
     during this session; re-pinning to an exact commit is a Follow-up Action). The font's own
     embedded metadata (extracted directly from its binary `name` table, not asserted from memory):
     `Version 3.001`, copyright "2024 The Noto Project Authors
     (https://github.com/notofonts/hebrew)".
   - **This specific binary is a variable font** (width + weight axes; contains `GDEF`/`GPOS`/
     `GSUB` tables) whose default named instance resolves to `NotoSansHebrew-Thin` per its own
     `postscriptName`/`fullName` fields — **not** an unambiguous "Regular" weight. Embedding the
     raw variable font as-is risks an unintended or renderer-dependent default weight in
     production. **P014 must not embed this exact file as-is** — it must either (a) instantiate a
     static Regular-weight `.ttf` from this exact pinned source using a deterministic build step
     (e.g. `fonttools varLib.instancer`), committing the resulting static file's own SHA-256, or
     (b) source a pre-built static Regular `.ttf` release directly from the font's authoritative
     upstream and pin that instead. Either path is a Follow-up Action, not resolved by this ADR.
   - The font asset actually embedded in production must be a **repository-managed or build-
     managed asset**, never downloaded at runtime, never fetched from a CDN at request time.
   - The applicable SIL Open Font License notice must be retained and committed alongside the font
     asset (the exact OFL license text was not independently re-fetched and checksummed during
     this session — doing so, from the same source/commit as the font file, is a Follow-up Action).
   - **No arbitrary user-uploaded font is executed or loaded in P014** — the font registry is
     fixed, platform-controlled, and not user-extensible in this sprint.

## Consequences

- Every future PDF-producing module (Invoices, Payment Approval, MASAV-related documents) renders
  through the same React PDF-backed Document Engine call, through the typed `PdfTemplate` contract,
  never a second PDF library and never a bypass of the engine boundary.
- The header-repeat gap is closed by a proven, working pattern before P014 is considered complete —
  not deferred as an open limitation.
- The parenthetical-content text-extraction defect is a real, narrow, documented constraint on
  template authoring, not a silent gap — template authors have concrete guidance to avoid it where
  copy/search correctness of an identifier matters.
- No headless-browser/Chromium dependency enters the production deployment.
- The variable-font default-instance risk is closed before production embedding, not silently
  inherited from this spike's convenience download.
- The template contract's type-level and runtime boundaries make "a user submits a template" not
  merely discouraged but structurally impossible through this API shape.

## Alternatives Considered

- **Headless-browser HTML-to-PDF** — rejected as the default; correct RTL/bidi and the best native
  pagination behavior of the three, but its 428 MB footprint and ~3x slower cold-start were judged
  not justified once React PDF's header-repeat gap was proven closable.
- **`pdf-lib`** — rejected; demonstrated incorrect RTL/bidi handling with no acceptable low-effort
  fix.
- **Leaving the header-repeat gap as an accepted V1 limitation** — rejected; a proof-of-concept
  showed it is a small, well-understood fix, so there is no justification for shipping a
  known-broken multi-page table.
- **Allowing `template` to be a string, HTML fragment, or dynamically-loaded value** — rejected;
  would reopen exactly the "user-controlled executable content" risk `NERA_CONSTITUTION.md` §6
  forbids. The typed, code-reference-only contract in Decision item 7 closes this by construction.
- **Document Engine owning per-module templates directly** — rejected; violates Platform First and
  risks industry-specific concepts leaking into a Core Engine.
- **Treating the mixed-content text-extraction defect as disqualifying for React PDF** — rejected;
  the defect is narrow (parenthetical mixed-direction sub-runs only), affects a candidate the
  headless-browser alternative also does not cleanly solve, and has a concrete template-authoring
  mitigation.

## Follow-up Actions

- P014 implements the generic paginated-table header helper (Decision item 4), with an automated
  regression test and visual fixture proving the header is present on every page a table spans.
- P014 re-pins the Noto Sans Hebrew source to an exact immutable commit SHA (not the `main`
  branch), instantiates or sources a static Regular-weight build, records its own SHA-256, and
  commits the applicable SIL OFL license notice alongside it (Decision item 8).
- P014 documents the mixed Hebrew+digit+parenthesis text-extraction limitation in template-
  authoring guidance for every future module implementing a `PdfTemplate` (Decision item 5).
- P014 implements the typed `PdfTemplate<TData>` contract and `generatePdf` binding exactly as
  specified in Decision item 7.
- `TECH_STACK.md` Part 2/3 is updated to reflect React PDF's real adoption.
- This ADR's acceptance, together with `ADR-011`'s, still does not by itself authorize a P014
  Implementation Prompt — the five outstanding P014 product decisions (allowed file types, max
  upload size, deletion/retention behavior, document-to-record linking model, default signed-URL
  expiration) remain unresolved.

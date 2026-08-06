# P014 Sprint Closing Report

## Sprint Summary

- **Sprint number:** P014
- **Sprint name:** Document Engine
- **Branch:** `p014-document-engine` (merged into `main`; not deleted, per explicit Owner
  instruction - retained both locally and on `origin`)
- **PR:** #4, `merged: true`, `state: closed`, merged at `2026-08-06T09:42:47Z`
- **Final commit (pre-merge, on the branch / PR head):** `e884262a9c3c489331cf54e5fa1566ce0fb627a7`
- **Merge commit:** `13e3e3a1ce26077c8a94832504acf75ed0200125` - a real, two-parent merge
  commit (not squashed, not rebased); parent 1 `13a83aa2ad115cc9c9afa6e1628315aa776f2f39`
  (`main`'s tip immediately before the merge), parent 2
  `e884262a9c3c489331cf54e5fa1566ce0fb627a7` (the branch tip above). Both parents and the
  merge commit itself were verified directly via `git log`/`git show` and cross-checked
  against the GitHub REST API's `merge_commit_sha`/`head.sha` for PR #4.
- **CI:** workflow `CI`, job `Validate`, run
  [`31089192043`](https://github.com/yo0548458601-tech/nera-erp/actions/runs/31089192043) -
  `status: completed`, `conclusion: success`, run against the exact PR head commit
  (`e884262a9c3c489331cf54e5fa1566ce0fb627a7`) - **CI GREEN** at merge.

# Goal

**Original objective:** Durable file storage and basic PDF generation, needed before
Purchase Orders (P017) and Invoices (P018) can attach files. Governing decisions:
`ADR-011` (storage provider), `ADR-012` (PDF rendering), `ADR-013` (V1 product policy) -
all `Accepted` before implementation began.

**Final scope (as merged):** `documents`/`document_links` schema and migration;
`StorageProvider` contract amendment (`ADR-011` item 17); `@nera/document-engine` package
(upload lifecycle, `getDocumentUrl` with a `view`/`download` mode, link/unlink/query,
soft-delete/restore, admin hard-delete, `generatePdf` + `PdfTemplate<TData>`, paginated-table
header helper); reconciliation and retention/purge services; file validation; six new
`documents.*` permissions; Server Actions; CI SeaweedFS pin; Noto Sans Hebrew font pinning;
**plus a closeout-window addition** (Owner-approved, delivered in the certified pre-merge
commit `4902a14`, "preserve filenames and add inline preview"): a browser-independent
mechanism that preserves the exact original (including Hebrew) filename end to end, and an
in-page preview modal for PDF/JPEG/PNG with a strict view/download separation - see
"Delivered" below for both.

**Scope exclusions (explicit, from the start, unchanged at close):** Production AWS
provisioning (bucket, KMS key, IAM roles, OIDC trust - P025); wiring the
reconciliation/retention services' production schedule (P025); real Identity/Authentication
(actor remains `DEMO_USER_PROFILE_ID`/`DEMO_MEMBERSHIP_ID`); any Milestone 3 business module.

# Owner Decisions

1. Reconciliation/purge grace period for stuck `uploading`/`failed` rows: **1 hour** (a
   definite upload failure still triggers an immediate targeted cleanup attempt, not a wait
   for the full grace period).
2. `DocumentLink` uses soft-delete (`deletedAt`/`deletedByUserId`), not hard-delete as
   originally planned - a partial unique index enforces "one active link per
   document/target"; a restore path (`restoreLink`) exists.
3. Local PostgreSQL architecture: `nera_dev` database, `nera_dev_admin` administrative/
   migration role, `nera_app_role` restricted application role, `postgres` superuser used
   only for one-time bootstrap/narrowly-scoped ownership repair - Nera never runs or
   migrates as `postgres` in normal operation. The `postgres` password was never requested
   from or shared with the assistant at any point in the sprint, including during the CI
   role-architecture fixes described below.
4. Prisma Windows file-lock handling: identify the exact dev-server process holding
   `query_engine-windows.dll.node` (via `Get-CimInstance Win32_Process`) - never a broad
   `taskkill /IM node.exe`; the Owner stops the identified process.
5. Database grant-repair policy: narrowest exact SQL only (no `GRANT ALL`, no `SUPERUSER`/
   `BYPASSRLS`, no `REASSIGN OWNED` after it was shown to fail against system-owned
   objects); the Owner runs any command that requires the `postgres` superuser.
6. Scope decision (mid-sprint): the FORCE-RLS/non-superuser-admin architecture gap found in
   P014's own persistence test also affected six pre-existing P011-P013B live-RLS test
   files and `seed.ts` - Owner approved fixing all of them now as a narrow shared-root-cause
   correction, including one obsolete assertion in `checkPermissionRls.test.ts` that
   asserted the admin client bypasses RLS (true only when `postgres` itself was the admin
   connection).
7. Font: a genuine prebuilt static Regular Noto Sans Hebrew build was required, from an
   authoritative official source with an immutable release reference, independently
   verified SHA-256, and retained OFL license text - explicitly not the already-disproven
   fontkit variable-font subsetting approach, and not the Thin weight merely because it was
   technically readable.
8. Linux/CI SeaweedFS artifact pinned separately from the Windows one, by independently
   computed SHA-256, verified by CI before execution, failing loudly on mismatch.
9. Do not commit, push, open a PR, merge, or begin P015 until all mandatory evidence passes
   (migration + live RLS + live SeaweedFS + font + full validate/build + functional
   verification + internal review). **Do not merge** even after all of that - stop for
   Owner review. (Resolved: the Owner reviewed and gave explicit merge approval; PR #4 was
   merged via a normal, non-squash, non-rebase merge commit - see Sprint Summary.)
10. In-page preview (P014 Owner requirement, decided during the closeout window, before
    merge): documents supersede an earlier new-tab-based approach with an in-page modal for
    PDF/JPEG/PNG only; every other allowed type (DOCX/XLSX) remains download-only, never
    attempted inline. `getDocumentUrl`'s `mode` parameter (`'view' | 'download'`) controls
    only the response `Content-Disposition` of the same short-lived signed URL - neither
    mode changes the object's persisted metadata or makes it public.
11. Original filenames (including Hebrew) must round-trip byte-for-byte through upload and
    every subsequent download/view - `File.name` is not trusted as the transport-safe source
    (see Bugs Found During Sprint, item 4, for the root cause this decision responds to).
12. Do not delete either the local or remote `p014-document-engine` branch after merge -
    unlike the prior two sprints' branch-cleanup convention, this branch is explicitly
    retained.
13. After the post-merge closeout, prepare a documentation-only closeout/handoff update on a
    new `p014-closeout-docs` branch (this document, plus any canonical status file the
    established sprint-closeout methodology requires) - explicitly no application code,
    tests, migrations, or workflow-logic changes, and explicitly not the start of P015.

# Delivered

**Database**

- New tables: `documents`, `document_links` (migration
  `20260803080447_add_document_persistence`), applied against the real local database.
- Both tables: `ENABLE` + `FORCE ROW LEVEL SECURITY` + an `*_organization_isolation` policy,
  cross-organization isolation proven directly against real Postgres (`documentPersistenceRls.test.ts`),
  not merely asserted.
- `document_links_document_target_active_unique` - a hand-added partial unique index
  (`WHERE deleted_at IS NULL`) enforcing one active link per document/target-record pair;
  not expressible in the Prisma schema DSL, added directly to the migration SQL with the
  same precedent P013B established for this class of manual migration edit.
- Local Postgres role architecture repaired: `nera_dev_admin` now genuinely owns every
  table/type/schema it needs to migrate (24 tables, 22 types, the `public` schema, via
  targeted `ALTER ... OWNER TO`, after a broad `REASSIGN OWNED BY postgres` was correctly
  refused by Postgres itself as touching system-required objects); `nera_app_role`
  correctly bootstrapped under PG16+'s `CREATEROLE`/`ADMIN OPTION` semantics.
- `seed.ts` rewritten to wrap every insert in a transaction that sets
  `app.current_organization_id` first - required once `nera_dev_admin` became a genuine
  (non-superuser, non-`BYPASSRLS`) table owner subject to `FORCE RLS` like any other role.

**Document security (storage + tenant isolation)**

- A document uploaded under one tenant is never retrievable by a request from another
  tenant: `organization_id NOT NULL` + `FORCE ROW LEVEL SECURITY` at the database layer, a
  server-generated, `organization_id`-namespaced object key (never containing the original
  filename) at the storage layer, and an explicit organization-ownership + `available`-status
  check before every signed URL is minted (`getDocumentUrl.ts`) - all three layers verified
  live, not only asserted.
- Every signed URL is short-lived (15-minute default, `ADR-013` item E) and is minted fresh
  per request; no object URL is ever persisted.
- Permission verification (`checkPermission`) happens at the Server Action layer, inside
  `getOrganizationContext`'s RLS-scoped transaction, before any engine call - matching the
  established `requirePermission` precedent, not embedded in the Core Engine function.

**Original Hebrew filename preservation**

- Root cause (found and verified via a six-boundary trace during the closeout window,
  before merge): Next.js's Server Action `FormData` transport decodes a non-ASCII multipart
  filename parameter (e.g. a Hebrew original filename) as Latin-1 before the Server Action
  ever receives it - the browser's `File.name` value cannot be trusted as the canonical
  filename by the time server code sees it.
- Fix: a browser-side sidecar form field
  (`FORM_FIELD_ORIGINAL_FILENAME_UTF8_BASE64URL`,
  `apps/web/src/lib/actions/originalFilenameMetadata.shared.ts`) carries the real filename
  as a UTF-8-safe, Base64URL-encoded string, generated client-side with only Web-standard
  APIs (`TextEncoder`/`btoa`). Server-side, `originalFilenameMetadata.serverCore.ts` decodes
  and validates it (empty/too-long/invalid-Base64URL/invalid-UTF-8 all explicitly rejected,
  with no fallback to `File.name`), then passes it through the existing
  `sanitizeOriginalFilename` (unchanged NFC-normalize / strip path separators & control
  characters / 255-code-point cap). A `server-only`-guarded wrapper
  (`originalFilenameMetadata.server.ts`) is what production code (`documentActions.ts`)
  actually imports, so an accidental browser bundle of the decode logic fails the build
  loudly; unit tests import the unguarded core module directly.
- Regression coverage: `documentActions.filenameMetadata.test.ts`,
  `originalFilenameMetadata.serverCore.test.ts`.

**View/download separation and inline preview (PDF/JPEG/PNG)**

- `getDocumentUrl(documentId, organizationId, storageProvider, mode, expiresInSeconds?)` -
  `mode: 'view' | 'download'` (default `'download'`, preserving prior behavior). `'view'` is
  only permitted for `INLINE_VIEWABLE_CONTENT_TYPES` (`application/pdf`, `image/jpeg`,
  `image/png` - a closed allowlist, matching `ADR-013` item A's closed-allowlist precedent
  for uploads); requesting `'view'` for any other content type (including the download-only
  DOCX/XLSX formats) throws `DocumentViewModeNotAllowedError`. Both modes mint the same kind
  of short-lived signed `GetObject` URL, differing only in the requested
  `Content-Disposition` (`inline` vs. `attachment`) - implemented in
  `filenameSanitization.ts`'s `buildInlineContentDisposition`/`buildContentDisposition`
  (both RFC 5987-correct: an ASCII `filename=` fallback plus a UTF-8 `filename*=` for exact
  Hebrew rendering).
- `DocumentPreviewModal.tsx` (new): an in-page modal, superseding an earlier new-tab
  implementation (no `window.open` anywhere in the final component) - fetches its own
  `mode: 'view'` signed URL on open and on every document switch, never persisting or
  reusing a stale URL. Renders a PDF via an `<iframe>` (with a 15-second best-effort load
  timeout, since a cross-origin iframe has no reliable failure signal) or a JPEG/PNG via a
  plain `<img>`; any other content type (DOCX/XLSX) shows an explicit
  "no preview available for this file type" message and offers only the Download action -
  download-only formats are never routed through `mode: 'view'` at all. Full keyboard
  accessibility: an initial-focus target, a two-layer focus trap (Tab/Shift+Tab cycling
  plus a `focusin` listener catching any focus that escapes by other means), Escape-to-close,
  and unconditional focus restoration to the triggering element on unmount.
- Regression coverage: `DocumentPreviewModal.test.tsx` (20 tests),
  `DocumentsVerificationPanel.test.tsx` (6 tests),
  `apps/web/src/lib/actions/documentActions.urlMode.test.ts`,
  `packages/engines/documents/src/getDocumentUrl.test.ts`.

**Engines**

- `@nera/document-engine` (`packages/engines/documents`), following the established
  typed-mapper repository / `getOrganizationContext` conventions:
  - `s3StorageProvider.ts` - real `@aws-sdk/client-s3` implementation, **live-verified**
    against a real, pinned (version 4.40, commit `875cd1f67ea25e8965a4f5ba1e6aaf501ba6b6fa`)
    local SeaweedFS instance: upload -> signed-URL GET -> delete -> 404-after-delete,
    `Content-Disposition` fidelity (both `inline` and `attachment`), idempotent
    delete-of-absent-key, signed-URL expiration.
  - `fileValidation.ts` - extension + declared content-type + magic-byte signature checks,
    25MB limit (`ADR-013` A/B). Allowed types: PDF, JPG/JPEG, PNG, DOCX, XLSX; DOCX/XLSX are
    accepted for upload/download but are never eligible for `mode: 'view'` (see above).
  - `uploadDocument.ts` - `uploading -> available/failed` lifecycle with inline
    compensating delete on failure.
  - `getDocumentUrl.ts` - permission-gated (at the Server Action layer),
    organization-ownership-checked, `available`-status-checked, `view`/`download`
    mode-checked, 15-minute default signed-URL expiration.
  - `hardDeleteDocument.ts` - separate, explicitly-audited administrator purge path.
  - `persistence/documentRepository.ts`, `persistence/documentLinkRepository.ts` -
    typed-mapper repositories; `documentLinkRepository`'s duplicate-active-link check is
    scoped to `deletedAt: null`; `restoreLink` added.
  - `services/reconciliationService.ts` (1-hour grace period) and
    `services/retentionPurgeService.ts` (30-day window) - tested, invocable as maintenance
    commands, no production schedule wired (P025 scope).
  - `pdf/pdfTemplate.ts`, `pdf/PaginatedTable.tsx`, `pdf/primitives.ts` - typed
    `PdfTemplate<TData>` contract (template is always a direct code reference, never a
    string/`eval`), generic paginated-table header-repeat helper, re-exported React PDF
    primitives so templates never import `@react-pdf/renderer` directly.
  - `pdf/fonts.ts` + `pdf/fonts/NotoSansHebrew-Regular.ttf` + `OFL.txt` - genuine prebuilt
    static Regular build from the authoritative upstream's own immutable GitHub Release
    (`notofonts/hebrew`, tag `NotoSansHebrew-v3.001`), replacing an earlier
    variable-font mistake that defaulted to Thin and whose fontkit-based instance-selection
    fix had previously crashed. SHA-256 of the committed font:
    `671951828bd5c95db818e5bb12dcea2d0c0dda00311888522be061ee6835125e`; `OFL.txt`:
    `9b9fe028b5ba74d231659a1bbaf0ed09b11e759d1ca6a070999e16d151616b47`. Verified via
    `fontkit`: `postscriptName: NotoSansHebrew-Regular`, `subfamilyName: Regular`, not a
    variable font (no `variationAxes`).
- `packages/core/src/provider.ts` - `StorageProvider.upload()` amended per `ADR-011` item
  17: takes a `{ contentType, contentDisposition? }` options object, resolves only
  `{ key }` - a usable URL is only ever produced by a separate `getSignedUrl()` call.
- `packages/core/src/engine.ts` - `document` registry entry updated: `packageName:
'@nera/document-engine'`, `status: 'partial'`.
- `packages/engines/authorization/src/permissions.ts` - six new permissions:
  `documents.upload`, `documents.download`, `documents.delete`, `documents.restore`,
  `documents.hard_delete`, `documents.manage_links`, mirrored by hand into `seed.ts`'s
  `CANONICAL_PERMISSION_IDS` (established P011/P013B convention, never imported).

**Server Actions** (`apps/web/src/lib/actions/documentActions.ts`)

- `uploadDocumentAction`, `getDocumentUrlAction` (takes the `view`/`download` `mode`),
  `deleteDocumentAction`, `restoreDocumentAction`, `hardDeleteDocumentAction`,
  `linkDocumentAction`, `unlinkDocumentAction`, `restoreLinkAction`,
  `listDocumentLinksForTargetRecordAction`, `listDocumentsAction`,
  `generateSampleHebrewPdfAction` (verification-only, generates a real 2-page Hebrew invoice
  PDF through the exact same upload path a browser-submitted file goes through).
- Same established sequence as `customFieldActions.ts`: `requirePermission` ->
  `getOrganizationContext`/engine call -> `recordAudit` -> publish the approved event after
  commit. `uploadDocumentAction`/`hardDeleteDocumentAction` compose their own multi-phase
  transactions inside the engine (crossing an external storage-provider I/O boundary, which
  `ADR-011` forbids holding a single DB transaction across).
- `uploadDocumentAction` resolves the original filename exclusively via
  `resolveOriginalFilenameFromFormData` (never `File.name`) - see "Original Hebrew filename
  preservation" above.

**UI**

- A minimal verification UI ships at `/operations/documents`
  (`DocumentsVerificationPanel`) - a deviation from the original implementation plan
  (which, following the P010-P012 precedent of zero real UI callers, did not plan a UI
  page). It was added specifically so every mandatory flow could be exercised end-to-end and
  the generated-PDF/font work visually confirmed, not merely asserted by automated text
  extraction. It is explicitly a verification surface, not a real business feature - no
  real business-record type exists yet to attach a document to. Now includes the in-page
  `DocumentPreviewModal` wiring (a "View" action alongside "Download" for PDF/JPEG/PNG
  documents).
- Navigation: `operations-documents` nav item, `FolderOpen` icon, gated on
  `documents.upload`.

**Audit**

- Every mutation calls `recordAudit()`: `document.uploaded`, `document.deleted`,
  `document.restored`, `document.hard_deleted`, `document_link.created`,
  `document_link.removed`, `document_link.restored`.

**Events**

- `DocumentUploaded`, `DocumentDeleted` - published by `documentActions.ts` after the
  relevant transaction commits (the two event names already reserved in `ENGINE_MAP.md`).

**SeaweedFS - local runtime and CI integration**

- **Local:** a real, pinned (version 4.40, commit `875cd1f67ea25e8965a4f5ba1e6aaf501ba6b6fa`)
  SeaweedFS binary, SHA-256-verified before every execution (including restarts of an
  already-verified process, as standing practice), always bound to
  `-ip=127.0.0.1 -ip.bind=127.0.0.1 -s3.ip.bind=127.0.0.1` (never the machine's real LAN IP,
  which drifts across reboots/DHCP renewals and previously caused a
  "no online volume server" failure after a reboot). A durable Windows Scheduled Task
  auto-start solution was designed this closeout window (`C:\ProgramData\Nera\SeaweedFS`,
  deterministic SID-based ACLs, a strict single-listener/single-process healthy-instance
  test, bounded restart count, blocking-rollback semantics) and was executed by the Owner
  (elevated privileges required, outside the assistant's session) - the Owner confirmed the
  service auto-starts correctly and passes its own acceptance test across a real reboot.
- **CI:** `.github/workflows/ci.yml` downloads the pinned Linux SeaweedFS binary
  (`linux_amd64.tar.gz`, release tag `4.40`, same version/commit as the Windows binary),
  independently verifies its SHA-256
  (`0c63aec15429d17e216fdb878a92532188d3e147d7f072645bfec9eb6f992a02`) against a committed
  expected value before ever executing it, fails loudly on mismatch - no Docker image, no
  `latest` tag, no reused Windows digest. Fixed, non-secret `DOCUMENT_STORAGE_*` CI-local
  identity env vars added. See "Material closeout/CI defects and resolutions" below for the
  concrete CI-runner-specific fixes this integration required before it ran green.

**Documentation**

- `packages/database/README.md` - "Local PostgreSQL role architecture (Owner-approved)"
  section (role responsibilities, `postgres` bootstrap-only, how to verify the active role,
  exact repair SQL, explicit warning never to run as `postgres`); "Troubleshooting: `EPERM`
  on `query_engine-windows.dll.node` (Windows only)" section (identify the exact process,
  never broadly terminate).
- `packages/engines/documents/README.md` - environment variables, running SeaweedFS
  locally (pinned version/hash), maintenance commands, font pinning rationale.
- `docs/ENGINE_MAP.md` §6, `docs/ROADMAP.md`, `docs/TECH_STACK.md` - Document Engine status
  updated across the sprint (planned -> partial/not-yet-merged -> **merged**, this closeout).

**Testing**

- Full repository suite, verified locally at closeout time against the real dev Postgres
  database (`npx vitest run`, `git` state: `main` at the merge commit): **482 tests across
  51 test files; 480 passing.** Two failures are present, both in a single pre-existing,
  non-P014 file - see "Final known limitations" below; they are a local-database-state
  artifact, not a code regression, and are not present in CI's fresh-per-run Postgres
  service container (CI run `31089192043`, `Validate` job, `conclusion: success`, verified
  directly against the exact merged PR head commit).
- P014-specific suites included in that total: `documentPersistenceRls.test.ts` (live
  Postgres RLS + cross-org isolation), `s3StorageProvider.test.ts` (live SeaweedFS, 4
  tests, full round trip), `hebrewFontRendering.test.ts` (4 tests: embedded `BaseFont` is
  `NotoSansHebrew-Regular` never `-Thin`, Hebrew text extraction, invoice-identifier
  extraction, documented mixed-direction limitation), `PaginatedTable.test.tsx`
  (header-repeat proof against a real 60-row/2-page PDF via `pdf.js`'s `getTextContent()`),
  `DocumentPreviewModal.test.tsx` (20 tests), `DocumentsVerificationPanel.test.tsx` (6
  tests), `documentActions.filenameMetadata.test.ts`, `documentActions.urlMode.test.ts`,
  `originalFilenameMetadata.serverCore.test.ts`, plus the six pre-existing P011-P013B
  live-RLS test files corrected for the FORCE-RLS/non-superuser-admin architecture change
  (see Bugs Found During Sprint).
- `npm run lint` / `npm run typecheck` / `npm run build`: all green at the merge commit (CI
  `Validate` job covers all three; verified independently during the pre-PR closeout phase
  of this sprint).
- End-to-end functional verification (performed during the pre-PR closeout phase): called
  the exact Server Action functions the verification UI invokes, against the real database
  and real SeaweedFS instance - upload of every allowed type (PDF/JPG/PNG/DOCX/XLSX)
  accepted; `.exe`, `.svg`, a magic-byte-mismatched renamed file, and a declared-content-type
  mismatch all rejected; persistence confirmed via a fresh `listDocumentsAction` call; a
  real signed URL fetched via real HTTP and its bytes verified byte-for-byte against the
  upload; a real generated Hebrew invoice PDF downloaded and read directly (visually
  confirmed: correct Hebrew glyphs and RTL layout, correct invoice number, and the table
  header repeating on page 2 of a 60-row/2-page fixture); soft-delete/restore round trip;
  administrator hard-delete confirmed to deny a subsequent signed-URL request;
  cross-organization denial for both a document list and a signed-URL request. 27/27 checks
  passed. **Caveat, stated plainly:** no browser-automation tool is available in this
  environment (no Playwright/computer-use tool registered), so this was not literal
  point-and-click browser interaction - it exercised the identical production code path
  (same exported Server Action functions, same database, same storage backend) a browser
  session would, but did not render or interact with the React UI itself.

# Bugs Found During Sprint

1. **FORCE-RLS/non-superuser-admin architecture gap** (found via P014's own persistence
   test, then confirmed to affect six pre-existing P011-P013B live-RLS test files and
   `seed.ts`): once the local Postgres role repair made `nera_dev_admin` a genuine,
   non-superuser table owner subject to `FORCE ROW LEVEL SECURITY`, every unscoped write via
   the admin `prisma` client against a FORCE-RLS table began failing/behaving differently
   than when `postgres` (a real superuser) was the effective admin connection. Fixed by
   wrapping all such writes in a transaction that sets `app.current_organization_id` first
   (`seed.ts`) or a local `withOrgWriteContext` test helper (the six test files). One
   assertion in `checkPermissionRls.test.ts` and one in `institutionOwnership.test.ts` were
   genuinely obsolete under the new (correct) architecture and were corrected, not merely
   patched around.
2. **Root `.env` DB credential mismatch**: the repo-root `.env` (which
   `apps/web/next.config.js` explicitly loads via `loadEnvConfig` for the Next.js dev
   server) contained a raw `postgres` superuser `DATABASE_URL` and a `nera_app_role`
   `APP_DATABASE_URL` with a different password than the one actually configured in
   `packages/database/.env`. Left uncorrected, starting the dev server would have silently
   connected the "admin" Prisma client as the real `postgres` superuser, bypassing every
   RLS guarantee this sprint verified. Fixed by overwriting the two lines in the root
   `.env` to match `packages/database/.env` exactly. `.env`/`.env.local` were confirmed
   gitignored and never committed to git history (`git log --all -- .env` is empty) - no
   version-control exposure occurred. The `postgres` password itself was never requested
   from or shared with the assistant.
3. **Local SeaweedFS instance exhausted its own volume-space accounting** mid-session
   ("No more free space left", while the real host disk had ~93GB free) after accumulating
   test data across a long-running local process - not a code defect. Fixed by stopping the
   stuck process, re-verifying the already-downloaded archive's SHA-256 and the extracted
   binary's size against the values verified earlier in the session, and restarting with a
   fresh data directory.
4. **Server Action `FormData` mangles non-ASCII original filenames** (found during the
   closeout window, before merge, while implementing the filename-preservation requirement):
   Next.js decodes a non-ASCII multipart filename parameter (e.g. Hebrew) as Latin-1 before
   the Server Action receives it, corrupting `File.name` irrecoverably by the time server
   code runs - confirmed via a six-boundary trace (browser encode -> multipart wire format
   -> Next.js's internal decode -> the Server Action's own `File` object -> what
   `uploadDocumentAction` read -> what was persisted). Fixed by never trusting `File.name`:
   a UTF-8-safe Base64URL sidecar form field carries the real filename instead (see
   "Original Hebrew filename preservation" above).
5. **`DocumentPreviewModal` infinite focus-stealing recursion** (found while adding UI test
   coverage for the new preview modal, not from a real user report): stacking two modal
   instances within the same test file without React Testing Library's `cleanup()` left the
   first instance's `focusin` listener registered; the second instance's own initial-focus
   effect then triggered the first instance's still-live listener, which redirected focus
   back into the (unmounted, but not yet cleaned-up) first panel, recursing. Root cause was
   missing `cleanup()` in the test files' `afterEach` (React Testing Library's auto-cleanup
   only self-registers when `test.globals: true` is set, which this repository's Vitest
   config does not set) - not a defect in the component's own effect logic once cleanup was
   added. A second, real component bug was found in the same pass: the trigger-capture
   effect ran _after_ the initial-focus-on-open effect, so it captured the modal's own close
   button as "the element to restore focus to" instead of whatever was actually focused
   before the modal opened; fixed by reordering the two effects.
6. **Vitest `oxc.jsx`/`setupFiles` regression** (found while adding the first `.tsx` test
   file to the repository, `PaginatedTable.test.tsx`, and later the `DocumentPreviewModal`/
   `DocumentsVerificationPanel` UI suites): oxc's `jsx` transform option cannot be scoped
   per file extension in this Vite version - setting it globally broke every plain `.ts`
   file, and scoping it via `oxc.include` instead disabled oxc's TypeScript-stripping
   entirely for every excluded `.ts` file. Fixed with a custom `enforce: 'pre'` Vite plugin
   that strips JSX from `.tsx` files via `esbuild.transform()` before oxc ever sees them
   (`sourcemap: 'external'`, not `true`, to avoid a separate esbuild-inlined-sourcemap bug
   that triggered a real V8 regex stack overflow in Vite's own stack-trace formatting).

# Architectural Changes

- `DocumentLink` uses soft-delete (`deletedAt`/`deletedByUserId` + a partial unique index),
  not the hard-delete originally planned - an Owner-approved, transparently-documented
  implementation decision (recovery semantics for a link, matching every other soft-deleted
  entity in the schema), not an unapproved scope change.
- The verification UI at `/operations/documents` is a deviation from the original "zero UI
  callers, P010-P012 precedent" plan, but was explicitly required later in the sprint for
  genuine end-to-end verification - documented transparently here and in `ENGINE_MAP.md`,
  not silently added.
- The in-page preview modal and the browser-independent original-filename-preservation
  mechanism (both delivered in the closeout window, before merge) are Owner-approved
  additions to the verification UI's scope, not changes to the Core Engine's approved
  contract shape beyond `getDocumentUrl`'s already-planned `mode` parameter.

# Documentation Updated

- **`packages/database/README.md`** - local Postgres role architecture, Prisma Windows
  file-lock troubleshooting.
- **`packages/engines/documents/README.md`** (new) - environment variables, local SeaweedFS
  setup with pinned/verified hashes, maintenance commands, font pinning.
- **`docs/ENGINE_MAP.md`** §6 - Document Engine section updated across the sprint and
  finalized at this closeout to state the real, merged, CI-green final state (view/download
  mode, inline preview, filename-preservation mechanism included).
- **`docs/ROADMAP.md`** - P014 row updated across the sprint and finalized at this closeout
  to state PR #4's merge, the merge commit, and CI-green status, matching the P013A/P013B
  rows' own "merged to `main`" convention.
- **`docs/TECH_STACK.md`** - Part 1/2 updated: React PDF, `@aws-sdk/client-s3` +
  `@aws-sdk/s3-request-presigner`, `pdfjs-dist` (test-only) recorded as installed and in
  use; CI SeaweedFS wiring recorded.
- **This report** - finalized at closeout (this commit) to replace its pre-merge draft
  content with the final, merged, CI-verified state, per the sprint-closeout methodology
  established by `P013A_SPRINT_CLOSING_REPORT.md`/`P013B_SPRINT_CLOSING_REPORT.md`.

# Repository State (at this closeout)

- **`main`:** at commit `13e3e3a1ce26077c8a94832504acf75ed0200125` (the PR #4 merge commit),
  working tree clean at that commit. Local `main` verified identical to `origin/main` via
  `git ls-remote origin refs/heads/main` (not merely the local tracking ref).
- **`p014-document-engine`:** tip `e884262a9c3c489331cf54e5fa1566ce0fb627a7`, present both
  locally and on `origin` (verified via `git ls-remote`), confirmed a merged ancestor of
  `main` (`git merge-base --is-ancestor`) - **retained, not deleted**, per explicit Owner
  instruction (a deviation from the P013A/P013B branch-cleanup convention).
- **CI:** `Validate` job green (`conclusion: success`) on the exact PR #4 head commit, run
  `31089192043`.
- **Migrations:** 5 total, all applied - the four pre-existing plus
  `20260803080447_add_document_persistence`. None pending.
- **This closeout branch (`p014-closeout-docs`):** created from `main` at the exact merge
  commit above; documentation-only changes (this report, plus any canonical status file the
  established methodology required - see Documentation Updated).
- **Known pre-existing, unrelated environment issue:** `npm run check-format` (Prettier)
  historically reported pre-existing formatting warnings unrelated to P014 (same class of
  issue P013B's closing report documented); the P014-specific formatting defect found
  during the CI closeout (10 files) was fixed and merged (commit `2debb3c`, see "Material
  closeout/CI defects and resolutions" below) - it is not part of this baseline.

# Material Closeout/CI Defects and Resolutions

Six real defects were found and fixed, one narrowly-scoped commit at a time, between
opening PR #4 and CI turning green - each is a genuine CI-environment or process gap, not a
P014 application-logic defect:

1. **SeaweedFS data directory did not exist in the CI runner** - `weed server -dir=...`
   failed immediately since nothing had created the directory first (a pre-existing local
   Windows setup had it created out-of-band; the Linux CI runner did not). Fixed: `mkdir -p`
   inserted before the `weed server` invocation. (Commit `7095ef56f1f997186173c345d6a0443baf4b0141`,
   `ci: create SeaweedFS data directory before startup`.)
2. **SeaweedFS readiness probe failed on a real HTTP 403** - the probe used `curl -sf`,
   which treats any non-2xx response (including SeaweedFS's own expected 403 for an
   unauthenticated root request while the service is otherwise healthy) as a hard failure.
   Fixed: `curl -sS` (still fails on a genuine connection error, but no longer treats a
   reachable-but-403 response as "not ready"). (Commit `76489e69066913b3fbfbd44f0ddef0bd5b492dcc`,
   `ci: fix SeaweedFS readiness probe for HTTP 403`.)
3. **P014 files failed CI's Prettier check-format gate** - 10 files (identified via a real,
   CI-faithful isolated-checkout comparison, after an earlier `git archive`-based comparison
   was found to give self-contradictory counts due to a Windows-only `core.autocrlf`
   archive-export quirk) needed formatting. Fixed: `prettier --write` on exactly those 10
   files. (Commit `2debb3c`, `style(documents): format P014 files for CI`.)
4. **CI's `postgres` role is a real superuser, bypassing `FORCE ROW LEVEL SECURITY`
   entirely** - the live-RLS suites (both P014's own and the six corrected pre-existing
   ones) require the admin connection to be a genuine non-superuser, non-`BYPASSRLS` table
   owner (matching the local `nera_dev_admin` architecture) to actually exercise FORCE RLS;
   running as CI's default superuser `postgres` made every such test pass vacuously. Fixed:
   a new CI step creates `nera_dev_admin` (`NOSUPERUSER NOCREATEDB NOCREATEROLE
NOBYPASSRLS`), makes it the database owner, and points the seed/test `DATABASE_URL` at
   it. (Commit `5e16bb5e9bc5a05cef8c20280c09f6faf2b2754b`, `ci: run RLS tests as non-superuser owner`.)
5. **A blanket `REASSIGN OWNED BY postgres TO nera_dev_admin` failed (`psql` exit code 3)**
   - CI's `postgres` role also owns PostgreSQL's own system-required objects; reassigning
     everything it owns is unsafe and was correctly refused by Postgres. Fixed: a targeted
     `DO $$ ... $$` block that transfers ownership only of `public`-schema tables/partitioned
     tables/sequences, using `format('%I.%I', ...)` for injection-safe identifier quoting.
     (Commit `629452e0b07c0410948fba1c7962b5f2fc493060`, `ci: transfer only application object ownership`.)
6. **`nera_dev_admin` could not `SET LOCAL ROLE "nera_rls_test_role"`** (Postgres error 42501) - CI created both roles but never granted membership between them, unlike the
   already-correct local setup. Fixed: an explicit `GRANT nera_rls_test_role TO
nera_dev_admin;` step, run as `postgres`, immediately after the existing
   "Bootstrap RLS test role" step. (Commit `e884262a9c3c489331cf54e5fa1566ce0fb627a7`, `ci:
allow admin owner to assume RLS test role` - this was also the final PR head commit; CI
   turned fully green on this commit, run `31089192043`.)

Each fix was diagnosed from concrete evidence only (the real GitHub Actions job/step/log
data via the REST API - no `gh` CLI or token was available in this environment, so raw log
downloads were not accessible; structured job/step/annotation data was) and applied as its
own narrowly-scoped commit, per the Owner-Controlled Sprint Workflow.

# Open Items

**P025 scope (explicitly deferred, not silently dropped)**

- Production AWS provisioning: S3 bucket, KMS key, IAM roles, OIDC trust for `il-central-1`.
- Wiring the reconciliation/retention services' production recurring schedule.
- The OIDC AWS provider-certification workflow was not attempted (no AWS account access in
  this environment) - explicitly flagged, not silently skipped.

**Carried forward, pre-existing**

- Real Identity/Authentication - still unscheduled.
- Institution application CRUD/management (`ROADMAP.md` §9.5.1).
- The workspace barrel/client-bundle packaging defect (`ROADMAP.md` §9.4).

**New to this sprint**

- No real `apps/web` business-module caller exists yet for the Document Engine (Invoices/
  Purchase Orders/Payments are unbuilt) - the verification UI is not a substitute for real
  integration once those modules exist.
- The durable SeaweedFS Windows Scheduled Task solution runs on the Owner's development
  machine only, outside the git repository - it is not part of any deployable artifact and
  has no bearing on production infrastructure (P025 scope, unaffected).

# Final Known Limitations (separated from completed work)

- **Local test-suite state artifact, not a P014 defect:** a fresh `npx vitest run` against
  the real local dev database at this closeout (`main` at the merge commit) shows **2
  failing tests**, both in the single, pre-existing (P011-era), non-P014 file
  `packages/engines/entities/src/persistence/listViewPreferenceInstitutionSwitch.test.ts`.
  Both failures are deterministic on re-run and are explained by real accumulated local
  database state (a `system`-scope `list_view_column_preferences` row already present for
  the demo organization/`contacts` screen) that the test's "no rows present" precondition
  assumes does not exist - a known class of live-Postgres test fragility already noted in
  `P013A_SPRINT_CLOSING_REPORT.md`'s Lessons Learned ("Live-Postgres test files sharing a
  hardcoded organization/entity id can race each other..."). This is a local-environment
  observation only: it is not present in CI, which runs every job against a freshly created,
  empty Postgres service container (CI run `31089192043` is green). No code, test, or
  migration was changed to investigate or "fix" this, per this task's explicit
  documentation-only boundary - it is recorded here as a known, narrowly-scoped local-state
  fragility for whichever future sprint next touches `listViewPreferenceInstitutionSwitch.test.ts`
  or the local dev database's seeded/accumulated state.
- **No dedicated browser/UI verification** for the closeout-window preview/filename
  additions beyond automated tests and direct Server Action calls, for the same
  no-browser-automation-tool reason stated in the original Testing section above.
- All other limitations already carried as Open Items above (P025 production provisioning,
  no real business-module caller, real Identity/Authentication unscheduled) remain
  unchanged and are not re-listed here.

# Lessons Learned

- A local role-architecture change that makes the administrative database connection a
  genuine (non-superuser) table owner under `FORCE ROW LEVEL SECURITY` has blast radius
  beyond the sprint that makes the change - it silently changes the behavior of every
  existing live-RLS test and seed script that assumed the admin connection bypasses RLS,
  **and this includes CI's own default `postgres` superuser role**, which is a completely
  separate instance of the same class of gap from the local one and required its own
  independent fix chain (see Material Closeout/CI Defects, items 4-6).
- A monorepo's Next.js app loading a repo-root `.env` (via `next.config.js`'s own explicit
  `loadEnvConfig` call) can silently diverge from a sibling package's own `.env` convention
  if nothing keeps them in sync - worth a direct comparison whenever both exist.
- `vitest run`, unlike Next.js, does not auto-load `.env` files - env vars needed only for a
  live-service test (SeaweedFS's `DOCUMENT_STORAGE_*`) must be exported in the shell or
  documented as such; this is by design, stated explicitly in
  `packages/engines/documents/README.md`.
- Re-verifying a binary's hash before every execution - even a restart of an
  already-verified process - is exactly the discipline that would catch a swapped binary if
  one ever occurred; it should remain standing practice.
- A browser `File.name` value cannot be trusted to survive a Server Action `FormData`
  round trip unmodified for non-ASCII text - any future upload path handling non-English
  filenames must carry the original name through an explicit, encoded sidecar field, not
  rely on the browser-supplied file metadata.
- React Testing Library's automatic `cleanup()` only self-registers when `test.globals:
true` is configured; a repository that does not set this (as this one deliberately does
  not, to keep the default test environment `node` rather than implicitly `jsdom`
  everywhere) must call `cleanup()` explicitly in every UI test file's own `afterEach`, or
  mounted component instances - and their effects/listeners - accumulate across tests within
  the same file.
- `git archive` on Windows Git-for-Windows can silently apply the local `core.autocrlf`
  setting to exported content (LF -> CRLF), even when the real git blob and working tree are
  pure LF - a Windows-only tooling quirk that can produce wildly wrong formatting-violation
  counts; a real isolated `git clone --no-checkout` + explicit `core.autocrlf=false` +
  `checkout --detach` is the CI-faithful alternative.
- GitHub Actions workflow-run `name` reflects the workflow file's own `name:` key (here,
  `CI`), not an individual job's `name:` (here, `Validate`) - filtering runs by the job name
  finds nothing; filter runs by workflow name, then fetch jobs separately for the job-level
  name/conclusion.
- Without a `gh` CLI or token, unauthenticated `curl` against the public GitHub REST API is
  sufficient for structured job/step/annotation data on a public repository, but raw
  Actions log downloads (`/actions/jobs/{id}/logs`) require write-level authorization and
  are not accessible this way - diagnosis must rely on the structured API surface, not raw
  log text.
- Without a browser-automation tool available, "real browser verification" was satisfied by
  calling the exact production Server Action functions directly (same code path, same live
  database, same live storage backend) rather than by claiming a browser interaction that
  did not happen - stating this limitation plainly is preferable to either fabricating
  browser evidence or silently skipping the verification requirement.

# Recommended Opening Context For Next Sprint

- Read `docs/NERA_ARCHITECTURAL_INVARIANTS.md` in full before doing anything else.
- P014 is **merged** to `main` via PR #4 (merge commit
  `13e3e3a1ce26077c8a94832504acf75ed0200125`, two real parents, CI green). `main` at that
  commit is the starting point.
- `p014-document-engine` still exists, both locally and on `origin` - it is fully merged
  (a confirmed ancestor of `main`) and safe to ignore; it was deliberately not deleted this
  time, unlike the P013A/P013B convention, per explicit Owner instruction.
- The local Postgres role architecture (`nera_dev_admin`/`nera_app_role`/`postgres`
  bootstrap-only) is now real and documented in `packages/database/README.md` - any future
  sprint's live-RLS tests or seed/maintenance scripts touching a FORCE-RLS table via the
  admin client must set `app.current_organization_id` first, exactly like `appPrisma`
  already requires. **The same applies to CI** - `.github/workflows/ci.yml` now bootstraps
  and uses a non-superuser `nera_dev_admin` for exactly this reason; do not revert it to
  running RLS tests as CI's default `postgres` superuser.
- `@nera/document-engine` is real, tested, merged, and CI-verified, with zero real
  business-module callers yet - Invoices (P018) and Purchase Orders (P017) are its intended
  real consumers. It now supports both `download` and in-page `view` (PDF/JPEG/PNG only)
  signed-URL modes, and preserves original (including Hebrew) filenames end to end via the
  `originalFilenameMetadata` mechanism - reuse both, do not reintroduce a `File.name`-trusting
  upload path or a new-tab-based preview.
- Follow the Owner-Controlled Sprint Workflow (`NERA_ARCHITECTURAL_INVARIANTS.md` §14):
  Planning -> Sprint Boundary Check -> Owner Questions -> Owner Decisions -> Implementation
  Prompt -> Implementation -> Claude Internal Review -> Owner Review -> Git Review -> CI ->
  Explicit Owner Merge Approval -> Merge -> Branch Cleanup (this time: explicitly skipped
  by Owner instruction) -> Sprint Closing Report -> New Chat.
- This report is itself the required "previous Sprint Closing Report" input for that
  workflow - carry it forward into the next chat, alongside `P013A_SPRINT_CLOSING_REPORT.md`
  and `P013B_SPRINT_CLOSING_REPORT.md`.
- Per `docs/ROADMAP.md`'s sequencing diagram, the next roadmap milestone after P014 is
  **P015** - not started, not analyzed, and explicitly out of scope for this closeout. Do
  not begin any P015 work until the Owner opens a new sprint for it.

# Fresh Session Handoff

For a new chat picking up the project cold, in order:

1. **Read first:** `docs/GPT_BOOTSTRAP.md` (onboarding process), then
   `docs/NERA_ARCHITECTURAL_INVARIANTS.md` (binding governance), then this report (the most
   recent Sprint Closing Report), then `docs/ROADMAP.md` for the current milestone sequence.
2. **Current canonical branch/state:** `main`, at commit
   `13e3e3a1ce26077c8a94832504acf75ed0200125` (verified identical to `origin/main`). A
   separate, still-open documentation-only branch `p014-closeout-docs` (this commit) carries
   this finalized report and any accompanying canonical-status update - it has not been
   merged; treat `main` at the hash above as the source of truth for application state, and
   this branch as the source of truth for the finalized closeout narrative until it is
   merged.
3. **What's complete:** P014 (Document Engine) is fully implemented, tested, merged via a
   real two-parent merge commit, and CI-green on its exact PR head commit - see Repository
   State above for every verified hash. The engine has zero real business-module callers;
   its own verification UI at `/operations/documents` is not a substitute for real
   integration.
4. **What must not be assumed:**
   - Do not assume `p014-document-engine` has been deleted - it has not, by explicit Owner
     instruction, and should not be deleted without a new explicit instruction to do so.
   - Do not assume the 2 local test failures noted in "Final Known Limitations" indicate a
     P014 regression - they are local-database-state-only and do not reproduce in CI; do
     not "fix" them as part of an unrelated sprint without first confirming with the Owner
     whether investigating local test-data hygiene is in scope for that sprint.
   - Do not assume `GPT_BOOTSTRAP.md` needs updating for ordinary sprint progress - it says
     so explicitly ("Update this document only when the onboarding methodology changes. Do
     not update it for ordinary sprint progress.") and was correctly left unmodified by this
     closeout.
5. **P015 has not started.** No P015 analysis, planning, or implementation exists anywhere
   in this repository as of this closeout. The next sprint requires the Owner to open it
   explicitly, per the Owner-Controlled Sprint Workflow.

P014 is fully closed: merged (PR #4, two-parent merge commit
`13e3e3a1ce26077c8a94832504acf75ed0200125`), CI-verified green, and documented. Its feature
branch is intentionally retained, not deleted. Not starting P015. Waiting for Owner.

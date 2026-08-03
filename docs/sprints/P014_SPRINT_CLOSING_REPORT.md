# P014 Sprint Closing Report

## Sprint Summary

- **Sprint number:** P014
- **Sprint name:** Document Engine
- **Branch:** p014-document-engine (not yet merged, pending Owner review)
- **PR:** not yet opened at report-writing time (opened immediately after this report)
- **Final commit (pre-PR, on the branch):** ef09e5ddef4636a2016e6820998c467fa8cdeec3
- **Merge commit:** none - **not merged**

# Goal

**Original objective:** Durable file storage and basic PDF generation, needed before
Purchase Orders (P017) and Invoices (P018) can attach files. Governing decisions:
`ADR-011` (storage provider), `ADR-012` (PDF rendering), `ADR-013` (V1 product policy) -
all `Accepted` before implementation began.

**Scope:** `documents`/`document_links` schema and migration; `StorageProvider` contract
amendment (`ADR-011` item 17); `@nera/document-engine` package (upload lifecycle,
`getDocumentUrl`, link/unlink/query, soft-delete/restore, admin hard-delete, `generatePdf` +
`PdfTemplate<TData>`, paginated-table header helper); reconciliation and retention/purge
services; file validation; six new `documents.*` permissions; Server Actions; CI SeaweedFS
pin; Noto Sans Hebrew font pinning.

**Scope exclusions (explicit, from the start):** Production AWS provisioning (bucket, KMS
key, IAM roles, OIDC trust - P025); wiring the reconciliation/retention services' production
schedule (P025); real Identity/Authentication (actor remains
`DEMO_USER_PROFILE_ID`/`DEMO_MEMBERSHIP_ID`); any Milestone 3 business module.

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
   from or shared with the assistant at any point in the sprint.
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
   Owner review.

# Delivered

**Database**

- New tables: `documents`, `document_links` (migration
  `20260803080447_add_document_persistence`), applied against the real local database.
- Both tables: `ENABLE` + `FORCE ROW LEVEL SECURITY` + an `*_organization_isolation` policy.
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

**Engines**

- `@nera/document-engine` (`packages/engines/documents`), following the established
  typed-mapper repository / `getOrganizationContext` conventions:
  - `s3StorageProvider.ts` - real `@aws-sdk/client-s3` implementation, **live-verified**
    against a real, pinned (version 4.40, commit `875cd1f67ea25e8965a4f5ba1e6aaf501ba6b6fa`)
    local SeaweedFS instance: upload -> signed-URL GET -> delete -> 404-after-delete,
    `Content-Disposition` fidelity, idempotent delete-of-absent-key, signed-URL expiration.
  - `fileValidation.ts` - extension + declared content-type + magic-byte signature checks,
    25MB limit (`ADR-013` A/B).
  - `uploadDocument.ts` - `uploading -> available/failed` lifecycle with inline
    compensating delete on failure.
  - `getDocumentUrl.ts` - permission-gated (at the Server Action layer),
    organization-ownership-checked, `available`-status-checked, 15-minute default
    signed-URL expiration.
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

- `uploadDocumentAction`, `getDocumentUrlAction`, `deleteDocumentAction`,
  `restoreDocumentAction`, `hardDeleteDocumentAction`, `linkDocumentAction`,
  `unlinkDocumentAction`, `restoreLinkAction`, `listDocumentLinksForTargetRecordAction`,
  `listDocumentsAction`, `generateSampleHebrewPdfAction` (verification-only, generates a
  real 2-page Hebrew invoice PDF through the exact same upload path a browser-submitted
  file goes through).
- Same established sequence as `customFieldActions.ts`: `requirePermission` ->
  `getOrganizationContext`/engine call -> `recordAudit` -> publish the approved event after
  commit. `uploadDocumentAction`/`hardDeleteDocumentAction` compose their own multi-phase
  transactions inside the engine (crossing an external storage-provider I/O boundary, which
  `ADR-011` forbids holding a single DB transaction across).

**UI**

- A minimal verification UI ships at `/operations/documents`
  (`DocumentsVerificationPanel`) - **a deviation from the original implementation plan**,
  which (following the P010-P012 precedent of zero real UI callers) did not plan a UI page.
  It was added specifically so every mandatory flow could be exercised end-to-end and the
  generated-PDF/font work visually confirmed, not merely asserted by automated text
  extraction. It is explicitly a verification surface, not a real business feature - no
  real business-record type exists yet to attach a document to.
- Navigation: `operations-documents` nav item, `FolderOpen` icon, gated on
  `documents.upload`.

**Audit**

- Every mutation calls `recordAudit()`: `document.uploaded`, `document.deleted`,
  `document.restored`, `document.hard_deleted`, `document_link.created`,
  `document_link.removed`, `document_link.restored`.

**Events**

- `DocumentUploaded`, `DocumentDeleted` - published by `documentActions.ts` after the
  relevant transaction commits (the two event names already reserved in `ENGINE_MAP.md`).

**CI**

- `.github/workflows/ci.yml` - downloads the pinned Linux SeaweedFS binary
  (`linux_amd64.tar.gz`, release tag `4.40`, same version/commit as the Windows binary),
  independently verifies its SHA-256
  (`0c63aec15429d17e216fdb878a92532188d3e147d7f072645bfec9eb6f992a02`) against a committed
  expected value before ever executing it, fails loudly on mismatch - no Docker image, no
  `latest` tag, no reused Windows digest. Fixed, non-secret `DOCUMENT_STORAGE_*` CI-local
  identity env vars added.

**Documentation**

- `packages/database/README.md` - "Local PostgreSQL role architecture (Owner-approved)"
  section (role responsibilities, `postgres` bootstrap-only, how to verify the active role,
  exact repair SQL, explicit warning never to run as `postgres`); "Troubleshooting: `EPERM`
  on `query_engine-windows.dll.node` (Windows only)" section (identify the exact process,
  never broadly terminate).
- `packages/engines/documents/README.md` - environment variables, running SeaweedFS
  locally (pinned version/hash), maintenance commands, font pinning rationale.
- `docs/ENGINE_MAP.md` §6, `docs/ROADMAP.md`, `docs/TECH_STACK.md` - Document Engine status
  flipped from **planned** to **partial** (real, tested, not yet merged), corrected to
  remove stale statements from earlier in the sprint (migration "blocked", RLS suite "not
  run", "no UI page this sprint" - all since resolved/superseded).

**Testing**

- 396 tests passing, 46 test files, zero failures - full repository suite, including:
  - `documentPersistenceRls.test.ts` (live Postgres: RLS introspection + cross-organization
    isolation for `documents`/`document_links`).
  - `s3StorageProvider.test.ts` (live SeaweedFS: 4 tests, full round trip).
  - `hebrewFontRendering.test.ts` (4 tests: embedded `BaseFont` is
    `NotoSansHebrew-Regular` never `-Thin`, Hebrew text extraction, invoice-identifier
    extraction, documented mixed-direction limitation).
  - `PaginatedTable.test.tsx` (header-repeat proof against a real 60-row/2-page PDF via
    `pdf.js`'s `getTextContent()`, the first `.tsx` test file in the repository -
    `vitest.config.ts`'s test glob extended accordingly).
  - Six pre-existing P011-P013B live-RLS test files, corrected for the same underlying
    FORCE-RLS/non-superuser-admin architecture this sprint's role repair introduced (see
    Bugs Found During Sprint).
- `npm run lint` / `npm run typecheck` / `npm run build`: 14/14 tasks green each.
  `npm run check-format`: 93 pre-existing, unrelated formatting warnings (verified none are
  P014 files - the established baseline, not a regression); `npm run validate`'s chained
  script stops at `check-format` for this reason, so each step was run individually instead.
- End-to-end functional verification: called the exact Server Action functions the
  verification UI invokes, against the real database and real SeaweedFS instance -
  upload of every allowed type (PDF/JPG/PNG/DOCX/XLSX) accepted; `.exe`, `.svg`, a
  magic-byte-mismatched renamed file, and a declared-content-type mismatch all rejected;
  persistence confirmed via a fresh `listDocumentsAction` call; a real signed URL fetched
  via real HTTP and its bytes verified byte-for-byte against the upload; a real generated
  Hebrew invoice PDF downloaded and read directly (visually confirmed: correct Hebrew glyphs
  and RTL layout, correct invoice number, and the table header repeating on page 2 of a
  60-row/2-page fixture); soft-delete/restore round trip; administrator hard-delete
  confirmed to deny a subsequent signed-URL request; cross-organization denial for both a
  document list and a signed-URL request. 27/27 checks passed.
  **Caveat, stated plainly:** no browser-automation tool is available in this environment
  (no Playwright/computer-use tool registered), so this was not literal point-and-click
  browser interaction - it exercised the identical production code path (same exported
  Server Action functions, same database, same storage backend) a browser session would,
  but did not render or interact with the React UI itself. The Owner can independently
  confirm the UI at `http://localhost:3000/operations/documents` (dev server left running).

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
   patched around - see the Owner Decisions and Delivered sections above for exact detail.
2. **Root `.env` DB credential mismatch** (found this session, not part of the original
   plan): the repo-root `.env` (which `apps/web/next.config.js` explicitly loads via
   `loadEnvConfig` for the Next.js dev server) contained a raw `postgres` superuser
   `DATABASE_URL` and a `nera_app_role` `APP_DATABASE_URL` with a different password than
   the one actually configured in `packages/database/.env`. Left uncorrected, starting the
   dev server would have silently connected the "admin" Prisma client as the real `postgres`
   superuser, bypassing every RLS guarantee this sprint verified. Fixed by overwriting the
   two lines in the root `.env` to match `packages/database/.env` exactly (`nera_dev_admin`/
   `nera_app_role`) - confirmed via a temporary throwaway test that `current_user` under
   `vitest run` resolves to `nera_dev_admin` post-fix. `.env`/`.env.local` were confirmed
   gitignored and never committed to git history at any point (`git log --all -- .env` is
   empty) - no version-control exposure occurred. The `postgres` password itself was never
   requested from or shared with the assistant.
3. **Local SeaweedFS instance exhausted its own volume-space accounting** mid-session
   ("No more free space left", while the real host disk had ~93GB free) after accumulating
   test data across a long-running local process - not a code defect. Fixed by stopping the
   stuck process, re-verifying the already-downloaded archive's SHA-256 and the extracted
   binary's size against the values verified earlier in the session (per the standing
   binary-execution-safety rule), and restarting with a fresh data directory.

# Architectural Changes

- `DocumentLink` uses soft-delete (`deletedAt`/`deletedByUserId` + a partial unique index),
  not the hard-delete originally planned - an Owner-approved, transparently-documented
  implementation decision (recovery semantics for a link, matching every other soft-deleted
  entity in the schema), not an unapproved scope change.
- No other architectural changes beyond the approved plan. The verification UI at
  `/operations/documents` is a deviation from the original "zero UI callers, P010-P012
  precedent" plan, but was explicitly required later in the sprint for genuine end-to-end
  verification - documented transparently here and in `ENGINE_MAP.md`, not silently added.

# Documentation Updated

- **`packages/database/README.md`** - local Postgres role architecture, Prisma Windows
  file-lock troubleshooting.
- **`packages/engines/documents/README.md`** (new) - environment variables, local SeaweedFS
  setup with pinned/verified hashes, maintenance commands, font pinning.
- **`docs/ENGINE_MAP.md`** §6 - Document Engine flipped from planned to real/partial,
  corrected to state the migration is applied and the live-RLS suite is green (both were
  mid-sprint blockers at the time this section was first drafted).
- **`docs/ROADMAP.md`** - P014 row rewritten to reflect actual delivered state (migration
  applied, RLS live-verified, full suite green, verification UI shipped) rather than the
  mid-sprint "blocked"/"no UI page" state it originally described.
- **`docs/TECH_STACK.md`** - Part 1/2 updated: React PDF, `@aws-sdk/client-s3` +
  `@aws-sdk/s3-request-presigner`, `pdfjs-dist` (test-only) now recorded as installed and
  in use; CI SeaweedFS wiring recorded.

# Repository State

- **Branch:** `p014-document-engine`, 7 commits ahead of `main` (`a18438b`), working tree
  clean.
- **Migrations:** 5 total, all applied locally - the four pre-existing plus
  `20260803080447_add_document_persistence`. None pending.
- **CI:** not yet exercised by a real GitHub Actions run - a PR opens immediately after
  this report so CI can run.
- **Local temporary artifacts still running** (not part of the committed repository): the
  `apps/web` dev server (`http://localhost:3000`, left running for independent Owner
  inspection of `/operations/documents`) and a local SeaweedFS instance (pinned/verified
  binary, `C:/tmp/seaweedfs2`). Both are outside the git repository and can be stopped at
  any time; neither affects `git status`.
- **Known pre-existing, unrelated environment issue:** `npm run check-format` reports 93
  pre-existing formatting warnings unrelated to P014 (verified: none are P014 files) -
  same class of issue P013B's closing report documented, still present, not introduced or
  worsened by this sprint.

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
- CI has not yet run against this branch's actual GitHub Actions environment - the PR
  opened immediately after this report is required to confirm the pinned Linux SeaweedFS
  step behaves as expected in a real runner, not just locally on Windows.

# Lessons Learned

- A local role-architecture change that makes the administrative database connection a
  genuine (non-superuser) table owner under `FORCE ROW LEVEL SECURITY` has blast radius
  beyond the sprint that makes the change - it silently changes the behavior of every
  existing live-RLS test and seed script that assumed the admin connection bypasses RLS.
  Grep for every unscoped admin-client write against a FORCE-RLS table before assuming a
  role-architecture repair is "just infrastructure."
- A monorepo's Next.js app loading a repo-root `.env` (via `next.config.js`'s own explicit
  `loadEnvConfig` call) can silently diverge from a sibling package's own `.env` convention
  (`packages/database/.env`) if nothing keeps them in sync - worth a direct comparison
  whenever both exist, not an assumption that "the database package's own README documents
  its own env convention" means the app consuming it agrees.
- `vitest run`, unlike Next.js, does not auto-load `.env` files - env vars needed only for a
  live-service test (SeaweedFS's `DOCUMENT_STORAGE_*`) must be exported in the shell or
  documented as such; this is by design, not a gap, and is stated explicitly in
  `packages/engines/documents/README.md`.
- A long-running local SeaweedFS instance can exhaust its own internal volume-space
  accounting well before the real host disk is full - if a live-storage test times out
  after previously passing, check the service's own log before assuming a code regression.
- Re-verifying a binary's hash before every execution - even a binary already verified once
  earlier in the same session, even just a restart of the identical process - caught
  nothing wrong this time, but is exactly the discipline that would catch a swapped binary
  if one ever occurred; it should remain standing practice, not a one-time reaction to being
  corrected on it once.
- Without a browser-automation tool available, "real browser verification" was satisfied by
  calling the exact production Server Action functions directly (same code path, same live
  database, same live storage backend) rather than by claiming a browser interaction that
  did not happen - stating this limitation plainly is preferable to either fabricating
  browser evidence or silently skipping the verification requirement.

# Recommended Opening Context For Next Sprint

- Read `docs/NERA_ARCHITECTURAL_INVARIANTS.md` in full before doing anything else.
- P014 is **not yet merged** - `main` is still at `a18438b`. Do not assume any P014 work is
  on `main` until the Owner confirms the merge.
- The local Postgres role architecture (`nera_dev_admin`/`nera_app_role`/`postgres`
  bootstrap-only) is now real and documented in `packages/database/README.md` - any future
  sprint's live-RLS tests or seed/maintenance scripts touching a FORCE-RLS table via the
  admin client must set `app.current_organization_id` first, exactly like `appPrisma`
  already requires.
- `@nera/document-engine` is real, tested, and has zero real business-module callers -
  Invoices (P018) and Purchase Orders (P017) are its intended real consumers.
- Follow the Owner-Controlled Sprint Workflow (`NERA_ARCHITECTURAL_INVARIANTS.md` §14):
  Planning -> Sprint Boundary Check -> Owner Questions -> Owner Decisions -> Implementation
  Prompt -> Implementation -> Claude Internal Review -> Owner Review -> Git Review -> CI ->
  Explicit Owner Merge Approval -> Merge -> Branch Cleanup -> Sprint Closing Report -> New
  Chat.
- This report is itself the required "previous Sprint Closing Report" input for that
  workflow - carry it forward into the next chat, alongside `P013A_SPRINT_CLOSING_REPORT.md`
  and `P013B_SPRINT_CLOSING_REPORT.md`.

P014 is implemented, tested, and internally reviewed on `p014-document-engine` - **not
merged**. A PR opens immediately after this report so CI can run. Not starting P015.
Waiting for Owner review and explicit merge approval.

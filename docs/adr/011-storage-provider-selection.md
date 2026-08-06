# ADR-011 — Storage Provider Selection for the Document Engine

**Status:** Accepted
**Date:** 2026-08-02

---

## Context

`ADR-009` defined the `StorageProvider` contract (`packages/core/src/provider.ts`) but deferred
vendor selection to a future sprint with a real need. P014 (Document Engine) is that sprint
(`ENGINE_MAP.md` §6).

MinIO is not viable: its open-source Community edition was archived April 25, 2026 (source-only,
no new binaries or patches); its AIStor Free successor is single-node-only, replication-
prohibited, and redistribution-prohibited under a proprietary license.

A real compatibility spike was run against SeaweedFS 4.40 using the real AWS SDK v3 client,
entirely outside the repository. 14 of 15 required behaviors matched AWS S3 semantics exactly; the
one deviation (SeaweedFS's `HeadObject` does not return an uploaded `ChecksumSHA256`) is accounted
for in Decision item 9.

A comparison of AWS S3 (`il-central-1`, Tel Aviv) against Cloudflare R2 found R2's location hints
do not guarantee Israeli data placement, while `il-central-1` is a real, operational AWS region
physically in Tel Aviv — decisive given Nera's first customers/data are expected to be in Israel,
holding sensitive financial/organizational records.

Three further gaps were found and resolved before this ADR could be accepted:

1. Decision item 14's `Content-Disposition` requirement cannot be satisfied through the originally
   implemented `StorageProvider.upload()` signature (bare `contentType` string only). Resolved by
   the contract amendment in Decision item 15.
2. A failed or errored `upload()` call against a remote object store does not prove nothing was
   written — a transport failure can occur after the object is durably persisted but before Nera
   observes success. The lifecycle in Decision item 5 treats every failed or indeterminate upload
   outcome as potentially-written, never as a proven no-op.
3. The originally implemented `upload()` return type, `Promise<{ key: string; url: string }>`,
   returns a `url` whose meaning is unsafe or undefined under the accepted access model: the
   bucket is private, no object is publicly readable, and a usable download URL is only ever
   produced by `getSignedUrl()` after Document Engine's authorization gate. Resolved by removing
   `url` from the return type in Decision item 16.

`NERA_CONSTITUTION.md` §6.3 requires two independent tenant-isolation layers for tenant-scoped
data; object storage has no native RLS equivalent, addressed in Decision item 7. This ADR governs
the `StorageProvider` contract and implementation and the exact AWS resource requirements it
depends on; it does not provision production infrastructure (Decision item 12).

## Decision

1. **One generic adapter, not per-vendor implementations.** P014 implements a single
   `S3StorageProvider` against `@aws-sdk/client-s3`, configured entirely by environment: endpoint,
   region, bucket, credentials, and path-style behavior (verified as a real difference between
   SeaweedFS and AWS S3 during the spike).
2. **SaaS production provider: AWS S3, region `il-central-1` (Tel Aviv).** Chosen over Cloudflare
   R2 for guaranteed Israeli data residency — see Alternatives Considered.
3. **Local development and CI provider: SeaweedFS**, S3-gateway mode, pinned per Decision item 11.
4. **P014 V1 upload flow is server-proxied, row-first, not direct browser-to-storage.** The
   sequence is:
   - The server receives the file and validates size, allowed type, and file-signature/magic
     bytes.
   - The server computes the authoritative SHA-256 checksum.
   - The server generates the object key (never client-supplied, never containing the original
     filename — see Decision item 15).
   - A PostgreSQL document metadata row is created **first**, with status `uploading`, holding the
     server-generated key and the validated (not yet confirmed-stored) metadata.
   - The server uploads the validated bytes through `StorageProvider.upload()`.
   - See Decision item 5 for what happens next, in every outcome.
     No user-visible pending-upload state is introduced — this is an internal row status only.
5. **Every failed or indeterminate `upload()` outcome is treated as potentially-written; the
   internal lifecycle never assumes a failure proves nothing was persisted:**
   - Status begins as `uploading` (item 4). While in this status, the row is never visible as an
     available document and can never authorize a signed URL — the check in item 7 requires
     status `available`, not merely row existence.
   - **If `upload()` succeeds**, the row is atomically updated to status `available`, storing the
     final verified metadata (confirmed size, content type, checksum). If this status update
     itself fails, the row remains `uploading` — one of the two cases reconciliation exists for.
   - **If `upload()` throws or returns an unsuccessful result** — including a transport/timeout
     error where the remote write outcome is genuinely unknown — the row is marked `failed`, and
     the server **immediately attempts a targeted compensating `delete(key)`** against the exact
     key the row already names.
     - An object-not-found result from this delete is treated as successful idempotent cleanup.
     - If the compensating delete itself fails, the `failed` row is retained, unresolved,
       specifically so reconciliation can retry the exact same targeted deletion later.
   - **A reconciliation service is the single backstop** for both unresolved cases: for each such
     row, it performs a **targeted `delete(key)`** — idempotent, tolerating not-found — against
     exactly the key the row names, then marks the row fully resolved. It **never lists or
     enumerates the bucket**; `ListObjectsV2` is not in the approved operation subset (item 13).
   - This lifecycle is implemented and tested as part of P014; see Decision item 12 for what P014
     does _not_ do with it.
6. **Object keys are server-generated only**, namespaced by `organization_id` at minimum, and
   **never derived from or containing the original filename** — the original filename is
   preserved only as sanitized metadata (item 15), never as part of the key itself.
7. **Tenant isolation is defense-in-depth**, because object storage has no RLS-equivalent:
   - Buckets are private; no object is ever publicly readable by default (verified in the spike).
   - The application credential is least-privilege, scoped to the one required bucket only.
   - Object keys are server-generated and namespaced by `organization_id`.
   - Document metadata lives in PostgreSQL with `organization_id NOT NULL`, `ENABLE` + `FORCE ROW
LEVEL SECURITY`, and an `*_organization_isolation` policy, identical to every other
     tenant-scoped table (`NERA_ARCHITECTURAL_INVARIANTS.md` §3.5).
   - `checkPermission()`, a metadata-ownership check, and a status = `available` check all run
     before every signed URL is issued.
   - Signed URLs are always short-lived (verified: a 3-second-expiry presigned URL returned 403
     once expired).
   - The metadata record and the physical object key are validated to correspond.
   - An additional provider-level policy/credential restriction (an AWS IAM bucket policy in
     production) is applied on top of, never instead of, the application-layer checks above.
8. **Encryption at rest and access-control baseline for the production bucket — a final, selected
   decision:**
   - **SSE-KMS with a Nera-controlled customer-managed KMS key**, in `il-central-1`, is selected.
     **S3 Bucket Key is enabled** to reduce KMS request volume and cost.
   - Accurate rationale: independent customer control of the encryption key; the ability to
     disable or revoke the key separately from S3 IAM permissions; an explicit key administration
     and rotation policy; a separate authorization boundary (KMS key policy) in addition to
     S3/IAM; an additional security-control layer appropriate for sensitive document storage.
     **This does not claim a per-object CloudTrail record of which key decrypted which specific
     object** — with S3 Bucket Key enabled, the KMS encryption context is the bucket ARN rather
     than the individual object ARN, and repeated requests may reuse the bucket-level key grant
     without a new per-object KMS API call or CloudTrail event. **Nera's own Audit Engine remains
     the sole authoritative record of who accessed which document, when** — KMS/S3 infrastructure
     logs are supplementary, never a substitute for the application audit trail
     (`NERA_CONSTITUTION.md` §7.6).
   - All four S3 Block Public Access settings enabled; **Bucket owner enforced** (ACLs disabled);
     no public bucket or object policy; access controlled only through IAM and bucket policies; a
     bucket policy `aws:SecureTransport` condition denies any non-HTTPS request; the application
     role and the certification-workflow role are each scoped to only the resources and
     operations they require.
9. **Checksums: PostgreSQL stores Nera's portable, provider-independent authoritative SHA-256
   checksum. Production AWS S3 may additionally expose a provider-side checksum, but application
   correctness and integrity verification must not depend on an optional provider capability.**
   The application-computed checksum remains mandatory regardless of what any given provider
   exposes.
10. **`HeadObject` is internal only, not part of the public `StorageProvider` contract.** Used by
    the `S3StorageProvider` implementation itself and by the provider-certification test suite —
    never added to the public interface, never depended on by any other engine or module.
11. **SeaweedFS artifact pinning:** exact version, release tag/commit, and expected SHA-256 digest
    are committed and checked before use. Verified during this ADR's own spike (Windows binary,
    local development environment): version `4.40`, commit
    `875cd1f67ea25e8965a4f5ba1e6aaf501ba6b6fa`, `windows_amd64.zip`, SHA-256
    `6713c300fe8bcc807bbdd73fe9e6753e96cb08905568102e0b842c686cfa8f3e`. The Linux/CI artifact
    requires its own independently verified digest — a mandatory pre-implementation step, not an
    architectural blocker to this ADR.
12. **P014's boundary excludes production infrastructure provisioning — this ADR introduces no
    Infrastructure as Code framework and does not provision the production bucket, KMS key, IAM
    roles, OIDC trust relationship, or a production reconciliation schedule.**
    - **P014 includes:** the generic `S3StorageProvider`; local/CI SeaweedFS support; provider
      contract tests; the database-driven lifecycle and compensation/reconciliation service from
      item 5, implemented and tested as an idempotent service/maintenance command; a protected AWS
      provider-certification GitHub Actions workflow authenticating via **OIDC** (a narrowly-scoped
      IAM role, short-lived temporary credentials, no long-lived AWS access key in GitHub
      Secrets), restricted to a **dedicated, non-production certification bucket or prefix**,
      exactly the operations in item 13, with automatic cleanup of every object it creates, and no
      access to real production document data; and exact, documented AWS requirements precise
      enough for P025 (or an earlier Owner-approved infrastructure decision) to provision from
      directly.
    - **P014 does not include:** selecting or introducing Terraform, AWS CDK, CloudFormation,
      Pulumi, or any other IaC framework; creating the final production deployment environment;
      deploying the final production bucket or KMS key; selecting or wiring the final production
      scheduling platform for reconciliation. **GitHub Actions is not used as an operational
      scheduler against real production document data.** The reconciliation service's recurring
      **production** schedule is wired during P025, unless the Owner separately approves an
      earlier infrastructure/IaC decision.
13. **Required operation subset (server-proxied flow only):** `PutObject`, `HeadObject` (internal
    use only, item 10), `GetObject` (server-side, internal verification/testing only), presigned
    `GetObject` (the only user-facing download path), and `DeleteObject`. **`ListObjectsV2` is
    explicitly not in this subset.** No presigned `PUT`, no presigned `POST`, no multipart upload,
    no pending-upload finalization operation beyond the internal status update in item 5.
14. **`Content-Disposition` is set once, at `PutObject` time, from a server-sanitized filename —
    never relied upon as a presigned-GET response-header override**, since header-override
    behavior was not part of the verified compatibility subset. Any potentially active/renderable
    content type is stored with an `attachment` disposition.
15. **The `StorageProvider.upload()` signature is amended to carry per-object upload metadata,
    because item 14 cannot be implemented through the signature as originally defined in
    `ADR-009`/`ADR-010`. This is an intentional, source-breaking contract amendment, not an
    additive or backward-compatible change** — the third parameter changes shape from a bare
    string to a required options object:
    - `contentType` remains mandatory. `contentDisposition` is optional at the generic provider
      level but is always supplied by the Document Engine for P014 uploads.
    - **The Document Engine, not the provider, sanitizes the original filename and constructs the
      safe `Content-Disposition` value** (stripping path separators and control characters, safely
      encoding non-ASCII text, forcing `attachment` for renderable content types per item 14). The
      provider receives only the already-sanitized value and performs no sanitization logic
      itself.
    - The original filename is never placed in the object key (item 6) — it exists only inside
      this sanitized `Content-Disposition` value and, separately, as its own metadata field in the
      PostgreSQL document row.
16. **The `upload()` return type is amended to remove `url`. This is also an intentional,
    source-breaking amendment, not an additive one.** Under the accepted access model — a private
    bucket, no public object readability, a usable download URL produced only by `getSignedUrl()`
    after Document Engine's permission/organization-ownership/`available`-status authorization
    gate, and always short-lived — the meaning of a `url` returned directly by `upload()` is
    unsafe or undefined: it must not be a permanent public URL, must not be a signed URL minted
    without an explicit expiration and the authorization gate, and a raw private object URL is not
    user-accessible and must never be stored or exposed. `upload()` therefore returns only the
    provider-owned key; the Document Engine's own create-document operation returns a
    `documentId`, never a URL. A usable URL is obtained later, per request, only through
    `getDocumentUrl()` → `StorageProvider.getSignedUrl()`. **No object URL is ever persisted in
    document metadata.**
17. **Final public `StorageProvider` contract, as accepted:**
    ```ts
    export interface StorageProvider {
      upload(
        key: string,
        content: Uint8Array,
        options: {
          contentType: string;
          contentDisposition?: string;
        }
      ): Promise<{ key: string }>;

      getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;

      delete(key: string): Promise<void>;
    }
    ```
    `getSignedUrl()` remains the sole provider method that produces a usable download URL.
    Document Engine must perform all authorization, organization-ownership, and `available`-status
    checks before calling it.

## Consequences

- One `S3StorageProvider` adapter serves every environment; switching between SeaweedFS and AWS S3
  is a configuration change, not a second implementation to maintain.
- The internal lifecycle has one uniform resolution path for every failure mode: a stale
  `uploading` row and a `failed` row both converge on reconciliation performing the same
  idempotent, targeted `delete(key)` — no code path assumes an object's absence without attempting
  to confirm it.
- **The `StorageProvider.upload()` signature change (third parameter, and the return type) is a
  real, intentional, source-breaking amendment to the contract `ADR-009`/`ADR-010` originally
  defined.** It is deliberately low-blast-radius: repository inspection found no real provider
  implementation anywhere and exactly one existing caller — the core package's own fake/test
  provider and its test file (`packages/core/src/provider.test.ts`) — so this amendment breaks no
  production code path, only test fixtures that are updated in the same change that applies it.
- No user-facing or persisted document URL can ever be stale, mis-scoped, or bypass authorization —
  every usable URL is minted fresh, per request, after the full authorization gate, by design.
- SSE-KMS with a customer-managed key adds real operational cost beyond SSE-S3's default — accepted
  given the sensitivity of the stored data.
- **Data residency scope is narrow and explicit**: document objects stored in the production S3
  bucket remain in `il-central-1`, provided no cross-region replication, transfer, backup export,
  or other explicit copying mechanism is configured. This ADR makes no claim about database data,
  logs, telemetry, backups, temporary processing files, or any other platform data.
- **Portability across the S3 API reduces the cost and blast radius of a future provider change,
  but does not itself authorize one.** Switching the bound SaaS provider away from AWS S3
  `il-central-1` remains a provider/stack change requiring its own future ADR at `Accepted`.
- No engine or module outside `S3StorageProvider`'s own implementation and its certification tests
  may depend on `HeadObject` or any list operation.
- P014 ships a tested, working reconciliation mechanism with no real production schedule attached
  to it yet — that wiring is P025's (or a future infra ADR's) responsibility.

## Alternatives Considered

- **MinIO (any tier)** — rejected; unmaintained/archived Community edition, single-node-only and
  redistribution-prohibited AIStor Free.
- **Cloudflare R2 as the SaaS production provider** — rejected for V1; no guaranteed Israeli data
  placement, and no usage model exists to show its egress-cost advantage is material.
- **SSE-S3 as the production encryption** — rejected as the selected decision; retained only as a
  documented, simpler fallback the Owner could choose in a future amendment.
- **Assuming a failed `upload()` proves nothing was written** — rejected; every failure/
  indeterminate outcome is treated as potentially-written (item 5).
- **Having the Document Engine bypass the provider boundary to set `Content-Disposition`
  directly, or leaving it unimplementable** — both rejected; the correct fix is the contract
  amendment in item 15, keeping all vendor-facing calls inside `S3StorageProvider`.
- **Having the provider itself sanitize the filename** — rejected; sanitization is business/
  security logic, not a storage-vendor concern.
- **Keeping `url` on `upload()`'s return type** — rejected; its meaning is unsafe or undefined
  under a private-bucket, signed-URL-only access model, and storing or exposing it would risk a
  stale, unauthorized, or unscoped document link.
- **Describing the `upload()` signature changes as additive/backward-compatible** — rejected;
  both changes are source-breaking by definition (a positional string parameter becomes a required
  object; a return-type field is removed) and are recorded accurately as such.
- **Storage-list-based reconciliation (`ListObjectsV2`)** — rejected; not in the approved operation
  subset, not exposed by the public contract.
- **Exposing `HeadObject` or a list operation on the public `StorageProvider` contract** —
  rejected; no demonstrated need exists for either.
- **P014 provisioning real production infrastructure directly** — rejected; no IaC tool is
  selected, and `ROADMAP.md` assigns production deployment to P025.
- **Long-lived AWS access keys in GitHub Secrets for certification** — rejected; OIDC is used.
- **Relying on a moving `latest` SeaweedFS download URL** — rejected; pinned version + commit +
  SHA-256 digest is required.
- **Direct presigned browser upload for P014 V1** — rejected; requires a materially larger contract
  expansion than the one in items 15–17, not justified by V1's expected file sizes/traffic.
- **Separate per-vendor `StorageProvider` implementations** — rejected.
- **Local filesystem storage, PostgreSQL `bytea`** — rejected, unchanged from prior rounds.

## Follow-up Actions

_(Mandatory pre-implementation/implementation work — performed when P014's Implementation Prompt
is authorized, not by this ADR itself.)_

- **Amend `packages/core/src/provider.ts`'s `StorageProvider` interface** to the exact shape in
  Decision item 17 (third `upload()` parameter becomes `options: { contentType: string;
contentDisposition?: string }`; return type becomes `Promise<{ key: string }>`, dropping `url`).
- **Update `packages/core/src/provider.test.ts`** — the only existing caller in the repository:
  - `createFakeStorageProvider()`'s `upload(key, content)` fake must accept the new `options`
    parameter and return only `{ key }`.
  - The existing test call `.upload('a.txt', new Uint8Array([1, 2, 3]), 'text/plain')` must become
    `.upload('a.txt', new Uint8Array([1, 2, 3]), { contentType: 'text/plain' })`, and its assertion
    must no longer reference a `url` field.
  - **Add a regression assertion proving the amended contract's shape**: that a real `upload()`
    call's resolved value contains only `key` (no `url`/no other field), and that obtaining a
    usable download URL is only possible through a separate `getSignedUrl(key, expiresInSeconds)`
    call — i.e., the test suite itself demonstrates that upload and download-URL issuance are two
    distinct, separately-authorized operations, not implicitly proving anything about
    authorization itself (that belongs to Document Engine-level tests once it exists).
- P014 implements `S3StorageProvider` against the operation subset in item 13, environment-
  configured for SeaweedFS (local/CI) and AWS S3 `il-central-1` (production configuration, not
  production deployment).
- **P014 pins the Linux/CI SeaweedFS artifact's exact version, commit, and SHA-256 digest**
  independently before SeaweedFS is introduced into CI (the digest in item 11 covers only the
  Windows binary used in this ADR's local spike).
- P014 implements and tests the database-driven lifecycle and reconciliation service from item 5
  as an idempotent service/maintenance command, without wiring its production recurring schedule.
- **The reconciliation grace-period value is selected and documented in the complete P014
  Implementation Prompt.**
- P014 documents the exact AWS bucket/KMS/IAM/OIDC/encryption/public-access requirements precisely
  enough for P025 to provision from directly, without P014 itself provisioning them.
- P014 implements the OIDC-based certification workflow against dedicated non-production AWS
  resources only.
- P014 implements the full defense-in-depth tenant-isolation list in item 7.
- `ROADMAP.md` §9.3 and `TECH_STACK.md` Part 3 are updated to reflect this ADR's resolution.
- `ADR-009` and `ADR-010` remain unchanged as historical Accepted records — this ADR records and
  supersedes the relevant `StorageProvider` signature details; their own text is not edited.
- **This ADR's acceptance does not by itself authorize a P014 Implementation Prompt.** PDF
  generation remains part of P014's scope by Owner decision, so a complete Implementation Prompt
  additionally requires ADR-012 to reach `Accepted`, including its Hebrew/RTL rendering spike, and
  all remaining Owner product decisions to be resolved.
- Any future change to the bound SaaS provider, encryption approach, or introduction of direct
  presigned upload requires its own new ADR at `Accepted`.
- Selecting an Infrastructure as Code framework and provisioning real production infrastructure is
  P025's job (or an earlier, separately Owner-approved infrastructure ADR).

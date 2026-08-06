# @nera/document-engine

Document Engine (P014 - see `docs/ROADMAP.md`, `docs/ENGINE_MAP.md` §6, ADR-011/012/013).

## Responsibilities

- Durable file storage via a single generic `S3StorageProvider` (AWS S3 `il-central-1`
  production / SeaweedFS local-CI, ADR-011).
- The upload lifecycle (`uploading` -> `available`/`failed`) with a reconciliation service
  backstop, and the three-tier deletion lifecycle (soft-delete -> 30-day recovery -> purge, plus
  a separate administrator hard-delete) with a retention/purge service (ADR-011/ADR-013).
- PDF generation via React PDF, behind a typed `PdfTemplate<TData>` contract, including a
  generic paginated-table header-repeat helper (ADR-012).
- A generic, module-agnostic many-to-many document-to-record link model (ADR-013).

## Environment (storage provider)

Set these before running anything that touches `S3StorageProvider` (the live test suite, the
maintenance commands, or a real `apps/web` upload):

- `DOCUMENT_STORAGE_BUCKET`
- `DOCUMENT_STORAGE_REGION`
- `DOCUMENT_STORAGE_ENDPOINT` - set for SeaweedFS/local; omit for real AWS S3.
- `DOCUMENT_STORAGE_FORCE_PATH_STYLE` - `'true'` for SeaweedFS; omit/`'false'` for AWS S3.
- `DOCUMENT_STORAGE_ACCESS_KEY_ID` / `DOCUMENT_STORAGE_SECRET_ACCESS_KEY`

Follows the same "own `.env`, not the repo root" convention as `packages/database` - see that
package's README for why. Loaded via `dotenv/config` in the maintenance-command scripts
(`services/runReconciliation.ts`, `services/runRetentionPurge.ts`); `s3StorageProvider.test.ts`
reads `process.env` directly (Vitest does not auto-load `.env` - export the variables in your
shell, or add them to the repo-root `.env` your shell already sources).

## Running SeaweedFS locally (S3-compatible storage for local dev/tests)

Pinned version, matching ADR-011 Decision item 11: **version 4.40, release tag `4.40`, commit
`875cd1f67ea25e8965a4f5ba1e6aaf501ba6b6fa`** - verified directly both by the Windows binary's own
startup log ("Start Seaweed S3 API Server ... 4.40 875cd1f...") and by CI's Linux binary the same
way.

1. Download the pinned binary for your platform and verify its SHA-256 digest before running it
   - never run an unverified binary:
   ```
   Windows: https://github.com/seaweedfs/seaweedfs/releases/download/4.40/windows_amd64.zip
            SHA-256: 6713c300fe8bcc807bbdd73fe9e6753e96cb08905568102e0b842c686cfa8f3e

   Linux:   https://github.com/seaweedfs/seaweedfs/releases/download/4.40/linux_amd64.tar.gz
            SHA-256: 0c63aec15429d17e216fdb878a92532188d3e147d7f072645bfec9eb6f992a02
   ```
   Both digests were computed independently against the downloaded artifact, not copied from the
   release page. `.github/workflows/ci.yml`'s "Start SeaweedFS" step downloads and verifies the
   Linux binary the same way, failing the build loudly on any mismatch, before ever executing it
   - no Docker image, no `latest` tag, no unverified download.
2. Extract the binary (`weed.exe` / `weed`), and write an S3 identity config (`s3.config.json`)
   next to it:
   ```json
   {
     "identities": [
       {
         "name": "local",
         "credentials": [{ "accessKey": "local", "secretKey": "localsecret" }],
         "actions": ["Admin", "Read", "Write", "List", "Tagging"]
       }
     ]
   }
   ```
   Without an `-s3.config`, every S3 request is rejected with `AccessDenied` - verified directly.
3. Run: `weed.exe server -dir=./data -s3 -s3.port=8333 -s3.config=./s3.config.json -master.port=9333 -volume.port=8080 -filer.port=8888 -metricsPort=0`
   The S3 gateway auto-creates a bucket on first `PutObject` if it doesn't already exist -
   verified directly (no separate `CreateBucket` call needed locally); real AWS S3 does not do
   this, so `s3StorageProvider.test.ts` and any real usage should not depend on that behavior.
4. Set the environment variables above to match (`DOCUMENT_STORAGE_ENDPOINT=http://127.0.0.1:8333`,
   `DOCUMENT_STORAGE_FORCE_PATH_STYLE=true`, credentials matching your `s3.config.json`).
5. `npx vitest run packages/engines/documents/src/s3StorageProvider.test.ts` - verified green
   against exactly this local setup (full upload -> signed-URL GET -> delete -> 404-after-delete
   round trip, `Content-Disposition` fidelity, idempotent delete of a non-existent key, and
   signed-URL expiration).

## Maintenance commands (no production schedule wired by P014 - ADR-011 Decision item 12)

- `npm run documents:reconcile --workspace=@nera/document-engine` - the reconciliation service
  (1-hour grace period).
- `npm run documents:purge --workspace=@nera/document-engine` - the retention/purge service
  (30-day window).

## Font pinning (ADR-012 Decision item 8) - resolved

`src/pdf/fonts.ts` embeds a **genuine prebuilt static Regular** Noto Sans Hebrew build, sourced
from the authoritative upstream's own immutable GitHub Release
(`https://github.com/notofonts/hebrew/releases/download/NotoSansHebrew-v3.001/NotoSansHebrew-v3.001.zip`,
not the Google Fonts mirror's moving variable-font binary the original spike used) - no build-time
instancing step needed. Verified directly via `fontkit`: `postscriptName`
`NotoSansHebrew-Regular`, not a variable font (no default-instance ambiguity), and via
`hebrewFontRendering.test.ts`: the resulting PDF's embedded `BaseFont` is
`NotoSansHebrew-Regular`, never `...-Thin`. See `src/pdf/fonts.ts`'s module doc comment for the
full account, including why the originally-attempted `fontkit` named-instance-selection fix was
abandoned (a real fontkit 2.0.4 glyph-subsetting crash, not an application bug).

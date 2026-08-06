# TECH_STACK.md

# Nera Technology Stack

Version: 1.1

Status: Approved (Philosophy, Part 2, Part 3); Part 1 is a factual record of the repository's
current implementation, verified directly during P013A, not a decision of its own.

> **Restructured during P013A's documentation closeout.** The previous version of this
> document described a single, undifferentiated "stack" that mixed already-implemented
> technology with aspirational/target technology and genuinely undecided provider choices —
> verified, direct repository inspection found the document's claims (Next.js 16, React 19,
> pnpm, CASL, Better Auth, MinIO, Redis, BullMQ, Socket.IO, Pino, OpenTelemetry/Grafana, a
> committed Playwright E2E suite) did not match the actual repository on any of those points.
> This version separates **Part 1 (current, implemented, verified)** from **Part 2 (approved
> future target, not yet built)** from **Part 3 (genuinely open, undecided)** so the document
> can be trusted for what it now claims. See `docs/NERA_ARCHITECTURAL_INVARIANTS.md` and
> `docs/ROADMAP.md` §9.3 for the governance context behind this split.

---

# Philosophy

Every technology must satisfy:

- Long-term maintainability
- High performance
- Strong community support
- Excellent developer experience
- Cloud readiness
- AI compatibility
- Enterprise readiness

Technology is selected for long-term stability rather than short-term popularity.

---

# Part 1 — Current Implemented Repository Stack

Verified directly against `package.json` files, the committed lockfile, and
`.github/workflows/ci.yml` during P013A. This section describes what the repository actually
runs today, not what it is intended to run eventually — see Part 2 for that.

## Frontend

Framework:
Next.js 14.2.15 (App Router) — `apps/web/package.json`

Language:
TypeScript 5.6.x

UI Library:
React 18.3.1 / react-dom 18.3.1

Styling:
Tailwind CSS 3.4.x (`apps/web`'s devDependencies)

Icons:
lucide-react

Data export:
exceljs (XLSX export from list views — not previously recorded in this document)

Document rendering:
React PDF (`@react-pdf/renderer`) — `packages/engines/documents` (`@nera/document-engine`) only, behind the typed `PdfTemplate<TData>` contract (`ADR-012`, Accepted). Implemented on feature branch `p014-document-engine`, not yet merged to `main` (P014 — see `docs/ROADMAP.md`).

**Not installed:** shadcn/ui (no `components.json`, no Radix Themes/primitives dependency anywhere in the repository), React Hook Form, Zod, Apache ECharts, FullCalendar.

## Backend

Framework:
Next.js Server Actions and plain async server functions. **No Route Handlers have been introduced** — an explicit P013A architectural choice; see `docs/NERA_ARCHITECTURAL_INVARIANTS.md` §8.1. Reads are plain server functions called from Server Components; writes are `'use server'` Server Actions.

Language:
TypeScript

ORM:
Prisma (`packages/database`)

Database:
PostgreSQL, reached via `DATABASE_URL` (administrative client) and `APP_DATABASE_URL` (least-privilege `nera_app_role` application client) — see `packages/database/README.md`.

Authentication:
**None implemented.** `apps/web/src/lib/auth/demoAuth.ts` is an explicit, documented demo stub — no real session verification, no real provider. See `docs/ENGINE_MAP.md` §1 (Identity/Authentication: **planned**).

Authorization:
A hand-built Nera Authorization Engine (`packages/engines/authorization`, `checkPermission()` — Prisma-backed, server-enforced, `MembershipRole → RolePermission → allow/deny`). **No CASL dependency exists anywhere in the repository.**

Storage:
`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, behind one generic `S3StorageProvider` adapter (`packages/engines/documents`) — AWS S3 (`il-central-1`) for production (configuration only, not provisioned), SeaweedFS for local/CI (`ADR-011`, Accepted). Implemented and **verified live** against a real, pinned SeaweedFS 4.40 instance on feature branch `p014-document-engine`, not yet merged to `main` (P014 — see `docs/ROADMAP.md`).

**Not installed:** Better Auth, MinIO, Redis, BullMQ, Socket.IO.

## Testing

Unit / Integration Testing:
Vitest — including tests that run against a real local PostgreSQL connection (not only fakes/mocks) for RLS, UUID-validation, and persistence-critical paths; see `docs/NERA_ARCHITECTURAL_INVARIANTS.md` §10.3–10.4. As of P014, also against a real local SeaweedFS instance for storage-provider tests, and `pdfjs-dist` (`packages/engines/documents` devDependency) for PDF-output text-extraction assertions (the same `getTextContent()` verification method `ADR-012`'s own spike used).

Browser / manual verification:
**Playwright is not a committed project dependency.** It has been installed temporarily (`npm install --no-save playwright`) for manual, real-browser verification during P013A review rounds, and fully uninstalled afterward every time (verified via `npm ls playwright` and `git status` before each commit). No Playwright test suite is committed to the repository, and no `apps/web` script references it.

## Infrastructure

Package Manager:
npm 10.8.2 — root `package.json`'s `"packageManager": "npm@10.8.2"` field, `package-lock.json` committed. CI installs via `npm ci` only, never `npm install`.

Monorepo:
Turborepo (`turbo.json`; `turbo run build`/`lint`/`typecheck`).

CI/CD:
GitHub Actions (`.github/workflows/ci.yml`) — a PostgreSQL 16 service container, a SeaweedFS instance started via a plain step (P014 — GitHub Actions' `services:` block has no way to pass the `-s3` gateway flag SeaweedFS needs): the exact Linux x64 binary (`linux_amd64.tar.gz`, release tag `4.40`, same version/commit as the pinned Windows binary) is downloaded, its SHA-256 is independently verified against a committed expected digest (`0c63aec15429d17e216fdb878a92532188d3e147d7f072645bfec9eb6f992a02`) before it is ever executed, and CI fails loudly on any mismatch — not yet exercised by a real CI run. Then migrations, RLS/application-role bootstrap, seed, then format/lint/typecheck/test/build, matching `npm run validate` exactly.

Secrets (development):
Plain `.env` files, loaded inconsistently by two different mechanisms — see `packages/database/README.md`'s Environment section for the exact, verified behavior.

**Not installed:** Docker (no `Dockerfile`/`docker-compose.yml` in the repository; CI's SeaweedFS step runs a pinned, verified binary directly, not a container), HashiCorp Vault, Pino, OpenTelemetry, Grafana integration.

## AI Layer

**Nothing implemented.** No AI provider SDK, no AI Engine code, exists in the repository today. See `docs/ENGINE_MAP.md` §13 (AI Assistance: **planned, implementation explicitly deferred**).

---

# Part 2 — Approved Target / Aspirational Stack

Not yet implemented anywhere in the repository. Listed here as an approved future direction,
not as current fact — do not cite this section as evidence of what the repository does today.
Adopting any of these for real, in place of or alongside Part 1, is a stack/provider change
requiring its own ADR once a real, justified need exists (`NERA_CONSTITUTION.md` §12; ADR-009).

Frontend:
Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, React Hook Form, Zod, Apache ECharts, FullCalendar.

Backend:
Realtime — Socket.IO. Background Jobs / Scheduler — BullMQ. Cache — Redis. (MinIO was an earlier directional mention for storage, since rejected — its open-source edition is unmaintained/archived; storage is resolved and now real, see Part 1.)

AI Layer:
A unified AI Engine (per `NERA_CONSTITUTION.md` §5 and ADR-004) fronting OpenAI, Anthropic Claude, Google Gemini, Ollama, and future providers — business modules never call a provider SDK directly. Nera never depends on a single AI provider; changing providers must require configuration only.

Infrastructure:
Docker (containers). HashiCorp Vault (future secret management, beyond dev-only `.env`).

Logging:
Pino.

Monitoring:
OpenTelemetry, Grafana.

Search:
PostgreSQL full-text search is the real, current V1 plan (`docs/ENGINE_MAP.md` §8) — not aspirational. Elasticsearch remains a documented future upgrade only if PostgreSQL full-text search proves insufficient at real data volume (`docs/ROADMAP.md` §7).

---

# Part 3 — Open Provider or Technology Decisions

Genuinely undecided: not adopted, not rejected, not scheduled. Each requires its own future
ADR before any migration or provider binding — see `docs/ROADMAP.md` §9.3 and ADR-009.

- **Database / ORM vendor.** Prisma is the actual, implemented, confirmed choice today (Part 1). Whether it remains the long-term choice is not decided by this document.
- **Authentication provider.** No vendor is selected. Better Auth was an early directional mention only; `demoAuth.ts` remains a stub with no real provider behind it.
- **Package manager.** This document previously listed pnpm as the intended package manager. The repository has always actually used npm (`packageManager: "npm@10.8.2"`, committed `package-lock.json`, every CI step invoked via `npm`). Whether to continue with npm or migrate to pnpm is not decided here — this document now only accurately records what the repository does today (Part 1).

**Resolved, no longer open (moved here from this section once accepted):**

- **Storage provider** — resolved by `ADR-011` (Accepted): AWS S3 (`il-central-1`) production, SeaweedFS local/CI, behind one generic `S3StorageProvider` adapter. Implemented and verified live (P014, feature branch `p014-document-engine`, not yet merged) — see Part 1.
- **PDF rendering library** — resolved by `ADR-012` (Accepted): React PDF. Implemented (P014, same branch). The font artifact requirement is also resolved: Noto Sans Hebrew is pinned to an immutable static-instance build sourced directly from the authoritative upstream's own GitHub Release (`notofonts/hebrew`, tag `NotoSansHebrew-v3.001`), with its own independently-computed SHA-256 and the release's own SIL OFL license text committed alongside it — see `packages/engines/documents/src/pdf/fonts.ts`.

---

# Repository Structure

apps/

packages/

modules/

docs/

scripts/

tools/

---

# Package Responsibilities

apps/
Application entry points.

packages/
Reusable platform capabilities.

modules/
Business functionality.

docs/
Architecture and documentation.

scripts/
Automation scripts.

tools/
Development tools.

---

# Shared Platform Packages

The platform is expected to contain reusable packages such as:

ui

database
auth

permissions

automation

notifications

ai

shared

These packages may evolve over time.

**Current state (verified, Part 1 fact, not part of the aspirational list above):** the
packages that actually exist today are `packages/ui`, `packages/database`, `packages/types`,
`packages/core`, and `packages/engines/{entities,authorization,audit,event-bus,organization,
customization,settings,calendar}`. There is no standalone `auth`, `permissions`,
`automation`, `notifications`, `ai`, or `shared` package yet — those responsibilities are
either not yet built (auth, automation, notifications, ai) or currently live inside an
existing engine package (permissions logic inside `packages/engines/authorization`).

---

# Business Modules

Business functionality belongs only inside modules.

Examples:

CRM

Finance

Inventory

Projects

HR

Documents

Sales

Customers

Purchasing

Analytics

Future modules must follow the same architecture.

**Current state:** no module exists under `modules/` yet — the directory is empty. See
`docs/MODULE_MAP.md` for the actual, committed V1 module list (Suppliers, Purchasing/Purchase
Orders, Invoices, Payment Approval, Payments, MASAV, Finance Core), which differs from the
generic example list above; `MODULE_MAP.md` is the authoritative one.

---

# Multi-Tenant

Every technology choice must support:

Tenant isolation

Organization configuration

Scalability

Future horizontal scaling

---

# AI Principles

AI is part of the platform.

It is not an external add-on.

Every module may use AI only through the platform AI Engine.

Changing AI providers must require configuration only.

No business code should depend on provider-specific SDKs.

---

# Future Technologies

New technologies may be added only after architecture approval.

Replacing existing core technologies requires an Architecture Decision Record (ADR).

---

# Final Rule

Long-term stability always wins over trends.

# P013B Sprint Closing Report

## Sprint Summary

- **Sprint number:** P013B
- **Sprint name:** Configuration Persistence
- **Branch:** p013b-configuration-persistence (deleted, local and remote, post-merge)
- **PR:** #3
- **Merge commit:** 5720167ab1e9fb22fb865d8bce557df339b78d41
- **Final commit (pre-merge, on the branch):** e04feca0beb45895445d9d14c3e7031398c781b6

# Goal

**Original objective:** Connect Custom Field Definitions, Custom Field Values, Field
Requirement Rules, and Role Definitions to real, tenant-isolated, audited, event-emitting
PostgreSQL persistence — the two capabilities (`RoleDefinitionsPanel`, `FieldRequirementsPanel`)
and the Custom Fields platform that P013A explicitly deferred.

**Scope:** `custom_field_definitions`, `custom_field_values`, `field_requirement_rules`,
`role_definitions` persistence; repositories in `@nera/customization-engine` (Custom
Fields/Field Requirements) and `@nera/entity-engine` (Role Definitions); Server Actions for
create/update/status-change on all four; repointing `RoleDefinitionsPanel`,
`CustomFieldsPanel`, `FieldRequirementsPanel`, and `PersonCustomFieldsCard` from in-memory
contexts to real persistence; two new approved events (`RoleDefinitionChanged`,
`FieldRequirementRuleChanged`); real browser-verified persistence across reload.

**Scope exclusions (explicit, from the start):** Settings/`SettingScope` persistence;
Billing Profile persistence; real Identity/Authentication; any Milestone 3 business module;
any institution-scoped custom field, field-requirement rule, or role definition (no
`institution_id` column, no institution-scope UI).

# Owner Decisions

1. Proceed with P013B now rather than inserting an unscheduled Identity/Authentication
   sprint first.
2. P013B scope includes Custom Field Definitions, Custom Field Values, Field Requirement
   Rules, and Role Definitions; excludes Settings persistence, Billing Profile persistence,
   real auth, and Milestone 3 work.
3. Organization-scoped only — no `institution_id` column on any of the four new tables;
   every institution-scope UI element is hidden/removed, never merely disabled, so nothing
   ever appears functional with no real target.
4. Role Definition persistence stays inside the Entity Engine's own persistence structure
   (`packages/engines/entities/src/persistence/roleDefinitionRepository.ts`), not moved into
   `@nera/customization-engine`, even though its settings surface sits alongside Custom
   Fields/Field Requirements.
5. `custom_field_values.value` is one `jsonb` column holding the existing typed
   `CustomFieldValueData` discriminated union; validated at the application boundary
   (`validateCustomFieldValue`, reused unchanged) — no separate table or nullable column per
   field type.
6. Two new domain events are added — `FieldRequirementRuleChanged`, `RoleDefinitionChanged`
   — documented in `ENGINE_MAP.md` before being published; `CustomFieldDefinitionChanged`
   continues to be used, now actually published. Every mutation is still audited in the same
   transaction; events publish only after commit.
7. Settings/`SettingScope` is explicitly out of scope — not to be modified unless a direct
   compile/test dependency required a minimal, non-functional change, and any such
   dependency had to be reported before modification. None was found.
8. PR #3 merges into `main` via a real merge commit — no squash, no rebase.
9. Both the local and remote feature branches are deleted only after the merge is confirmed
   and the branch is verified fully merged.

# Delivered

**Database**
- New tables: `custom_field_definitions`, `custom_field_values`, `field_requirement_rules`,
  `role_definitions` (migration `20260728204824_add_configuration_persistence`).
- Every new table: `ENABLE` + `FORCE ROW LEVEL SECURITY` + an `*_organization_isolation`
  policy, applied in its own creation migration.
- No `institution_id` column on any of the four tables — verified directly via
  `information_schema.columns` in the live-Postgres regression suite.
- `role_definitions.organization_id` is `NOT NULL` (every organization gets its own copy of
  the 12 built-in roles) rather than a nullable "global" row like `Permission` — an
  implementation-level decision to keep this table's RLS policy uniform with every other
  organization-scoped table, not an Owner escalation.
- The 12 built-in role definitions seeded per organization (`packages/database/src/seed.ts`),
  hand-transcribed from `entityRoleRegistry` for the same layer-order reason
  `CANONICAL_PERMISSION_IDS` is transcribed rather than imported.

**Engines**
- `packages/engines/entities/src/persistence/roleDefinitionRepository.ts` — typed-mapper
  repository for Role Definitions; `institutionId` is accepted on input shapes for
  compatibility with the pure engine type but never persisted.
- `packages/engines/customization/src/persistence/` — `customFieldDefinitionRepository.ts`,
  `customFieldValueRepository.ts`, `fieldRequirementRuleRepository.ts`, following the same
  typed-mapper convention.
- `NewCustomFieldInput`, `NewRoleDefinitionInput`, `RoleDefinitionPatch` moved from their
  previous app-layer-only definitions into the engines themselves (`customFields.ts`,
  `roles.ts`), since a Core Engine repository cannot import types from the App layer.

**Server Actions** (`apps/web/src/lib/actions/`)
- `roleDefinitionActions.ts` — list/create/update/status-change for Role Definitions.
- `customFieldActions.ts` — list/create/status-change for Custom Field Definitions, list/set
  for Custom Field Values (bulk organization-wide read, mirroring `listEntitiesAction`'s
  convention).
- `fieldRequirementActions.ts` — list/set for Field Requirement Rules.
- All three follow `entityActions.ts`'s established sequence: `requirePermission` →
  `getOrganizationContext` → repository call → `recordAudit` (same transaction) → publish
  the approved event after commit → `revalidatePath`.

**UI**
- `RoleDefinitionContext`, `CustomFieldContext`, `FieldRequirementContext` repointed from
  in-memory state to the new Server Actions, following `EntityContext`/
  `ListViewPreferenceContext`'s client-side cache-over-Server-Action pattern.
- `RoleDefinitionsPanel`, `CustomFieldsPanel`, `FieldRequirementsPanel` un-disabled now that
  saves are real; the institution-scope selector removed from all three.
- `PersonCustomFieldsCard` updated for the bulk-loaded, organization-wide value set.

**Authorization**
- `roles.manage_definitions`, `custom_fields.manage`, `custom_fields.view_sensitive`,
  `field_requirements.manage_defaults` (all already defined in the permission catalog since
  P011) are now enforced server-side via real `checkPermission()` calls on every mutation.

**Audit**
- Every mutation calls `recordAudit()` in the same transaction as its repository write:
  `role_definition.created`/`.updated`/`.status_changed`,
  `custom_field_definition.created`/`.status_changed`, `custom_field_value.set`,
  `field_requirement_rule.set`.

**Events**
- `RoleDefinitionChanged`, `FieldRequirementRuleChanged` — new, documented in `ENGINE_MAP.md`
  §4/§15 before being published.
- `CustomFieldDefinitionChanged` — previously documented as aspirational, now actually
  published by `customFieldActions.ts`.

**Persistence**
- All four data types verified to survive a full page reload via real-browser testing
  (Playwright, installed only temporarily and fully removed after verification): a custom
  role, a custom field definition, a custom field value on a person record, and a field
  requirement rule were each created and confirmed still present after reload. Zero
  institution-scope UI elements rendered (`option[value="institution"]` count: 0) across all
  three settings panels.

**Documentation**
- `docs/ENGINE_MAP.md` §4 (Entity) — `role_definitions` documented as real and persisted;
  new `RoleDefinitionChanged` event.
- `docs/ENGINE_MAP.md` §15 (Configuration/Metadata) — `custom_field_definitions`,
  `custom_field_values`, `field_requirement_rules` documented as real and persisted; new
  `FieldRequirementRuleChanged` event; `CustomFieldDefinitionChanged` now marked as actually
  published.
- `docs/ROADMAP.md` — new P013B sprint row added; sequencing diagram and P013A's own row
  corrected (P013A marked merged to `main`; the P013B cross-reference no longer says "not yet
  scheduled").

**Testing**
- 317 tests passing at final P013B state (32 test files), up from 283 at P013A's close.
- New tests: 4 mocked repository suites (`roleDefinitionRepository.test.ts`,
  `customFieldDefinitionRepository.test.ts`, `customFieldValueRepository.test.ts`,
  `fieldRequirementRuleRepository.test.ts` — 17 tests) plus a new live-Postgres RLS suite
  (`configurationPersistenceRls.test.ts` — 17 tests: introspection for RLS
  enabled/forced/policy/no-institution-column on all four tables, plus cross-organization
  isolation for each).
- Real browser verification performed for all four data types, not just build/typecheck
  success.

# Bugs Found During Sprint

None. No defects were discovered during implementation or review this sprint.

# Architectural Changes

- None beyond the approved scope. `NewCustomFieldInput`/`NewRoleDefinitionInput`/
  `RoleDefinitionPatch` moving from the app layer into their respective engines is a
  layering correction required by the typed-mapper pattern, not a new architectural
  decision.
- One implementation-level decision, transparently documented rather than escalated:
  `RoleDefinition.organizationId` is `NOT NULL`, matching every other organization-scoped
  table's RLS-uniformity requirement, rather than a nullable "global" row pattern like
  `Permission`.

# Documentation Updated

- **`docs/ENGINE_MAP.md`** — Sections 4 and 15 corrected to state real P013B persistence,
  the two new events, and current status accurately.
- **`docs/ROADMAP.md`** — P013B row added with full delivered-scope detail; the sequencing
  diagram and P013A's row corrected to reflect that P013A is merged and P013B is no longer
  "not yet scheduled."

# Repository State

- **main:** at commit `5720167ab1e9fb22fb865d8bce557df339b78d41`, working tree clean
  (aside from the pre-existing, unrelated `docs/sprints/` tracking cleanup handled
  separately), local `main` verified identical to `origin/main`.
- **CI:** `Validate` check green on the PR #3 head commit (`e04feca`) — one benign GitHub
  platform annotation (Node.js 20 runner deprecation notice on `actions/checkout@v4`/
  `actions/setup-node@v4`), unrelated to this sprint's code and not a failure.
- **Migrations:** 4 total, all applied — `20260713120000_initial_platform_foundation`,
  `20260720120000_add_institutions_and_force_rls`, `20260721090000_add_entity_persistence`,
  `20260728204824_add_configuration_persistence`. None pending.
- **Branch cleanup:** `p013b-configuration-persistence` deleted, both local and remote,
  after confirming its tip commit was a merged ancestor of `main`.
- **Known pre-existing, unrelated environment issue:** `npm run check-format` (Prettier)
  fails identically on a clean checkout of `main` itself (verified via a temporary git
  worktree) — a local Prettier-version/environment drift issue, not something introduced by
  or specific to P013B.

# Open Items

**Future Roadmap (scoped sprint, no ADR strictly required)**
- Settings/`SettingScope` persistence — remains in-memory, explicitly deferred.
- Billing Profile persistence — remains in-memory, explicitly deferred.
- Institution-scoped custom fields, field-requirement rules, and role definitions — no UI
  path exists to create one; requires a future Owner decision once a real institution-scoped
  target exists.
- `ENGINE_MAP.md` §15's documentation/ownership split (list-view preferences implemented
  under `packages/engines/entities` but conceptually documented under Configuration/
  Metadata) — unchanged from P013A, still a documentation-organization cleanup, not a
  functional gap.

**Future ADR required (pre-existing, not new to this sprint)**
- Entity-to-Institution ownership/assignment decision (`ROADMAP.md` §9.5.2).
- Branch/Department/Institution/`PermissionScope` naming reconciliation (`ROADMAP.md` §9.5.3).
- Database/ORM/authentication/storage provider vendor selection (`ROADMAP.md` §9.3).

**Carried forward from P013A, still open**
- Institution application CRUD/management (`ROADMAP.md` §9.5.1).
- The workspace barrel/client-bundle packaging defect (`ROADMAP.md` §9.4).
- Real Identity/Authentication — still unscheduled.

# Lessons Learned

- A Core Engine repository cannot import types defined only in the App layer — input/patch
  types for a new persisted entity (`NewCustomFieldInput`, `NewRoleDefinitionInput`,
  `RoleDefinitionPatch`) must live in the engine itself from the start, not be discovered
  mid-implementation as an app-layer-only convenience type.
- `prisma migrate dev`'s shadow-database autogeneration does not know about a partial index
  added by hand in an earlier migration (`person_profiles_organization_id_id_number_idx`,
  `WHERE id_number IS NOT NULL`) — it will propose a duplicate, non-partial `CREATE INDEX`
  with the same name on every future migration touching this schema, and separately proposes
  renaming two constraints that already carry their schema-specified explicit names. Both
  must be hand-removed from the generated migration file (with an explanatory comment) until
  the partial index is retired or Prisma's diff engine improves; verified directly against
  the real dev database (not assumed) before removing either.
- A settings UI's "hide the unsupported option" requirement is only actually verified by
  counting the rendered DOM elements in a real browser (`option[value="institution"]` = 0),
  not by reading the component source and trusting it — the same "real browser verification,
  not code review" discipline P013A's bug-hunting established applies just as much to a
  sprint that introduces zero bugs.
- A CI workflow scoped to `pull_request` and `push: [main]` will not run on a plain feature
  branch push — "push, then verify CI green" implicitly requires a PR to exist first; this
  is worth stating explicitly in any future implementation prompt rather than rediscovering
  it mid-sprint.

# Recommended Opening Context For Next Sprint

- Read `docs/NERA_ARCHITECTURAL_INVARIANTS.md` in full before doing anything else, per
  `NERA_ARCHITECTURAL_INVARIANTS.md` §14 and this sprint's own precedent.
- P013B is merged to `main`; its branch is deleted. `main` at
  `5720167ab1e9fb22fb865d8bce557df339b78d41` is the starting point — do not assume any
  further un-merged P013B work exists.
- Custom Field Definitions/Values, Field Requirement Rules, and Role Definitions are now
  real, persisted, `FORCE`-RLS, authorized, audited, event-emitting data — not in-memory
  demo state. Any future work touching these must go through their existing repositories/
  Server Actions, never reintroduce an in-memory context.
- Settings/`SettingScope` and Billing Profile persistence remain the next candidates for a
  "Configuration Persistence, part 2"-style sprint, should the Owner choose to schedule one —
  neither was touched in P013B.
- Reuse the established typed-mapper pattern
  (`packages/engines/entities/src/persistence/roleDefinitionRepository.ts` or
  `packages/engines/customization/src/persistence/*`) for any future Draft/Input → Prisma
  translation.
- Every real mutation must follow: validate → `checkPermission` (inside
  `getOrganizationContext`) → repository call → `recordAudit` (same transaction) → publish
  the approved event (after commit) → `revalidatePath`.
- Follow the Owner-Controlled Sprint Workflow (`NERA_ARCHITECTURAL_INVARIANTS.md` §14):
  Planning → Sprint Boundary Check → Owner Questions → Owner Decisions → Implementation
  Prompt → Implementation → Claude Internal Review → Owner Review → Git Review → CI →
  Explicit Owner Merge Approval → Merge → Branch Cleanup → Sprint Closing Report → New Chat.
- This report is itself the required "previous Sprint Closing Report" input for that
  workflow — carry it forward into the next chat, alongside `P013A_SPRINT_CLOSING_REPORT.md`.

P013B is fully closed: merged, branch-cleaned, and documented. Not starting the next sprint.
Waiting for Owner.

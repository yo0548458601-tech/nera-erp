/**
 * The Engine Registry: a typed, testable catalog of every Core Engine
 * approved in `docs/ENGINE_MAP.md`. This module is the code-side mirror of
 * that document - the data below is transcribed from it, not re-derived, so
 * there is one source of truth for "what engines exist and what do they
 * depend on," not two independently maintained ones. See ADR-010.
 *
 * None of the 5 already-implemented engines (`@nera/entity-engine`,
 * `@nera/authorization-engine`, `@nera/customization-engine`,
 * `@nera/settings-engine`, `@nera/calendar-engine`) has a class, factory or
 * instance - every one is a stateless library of types and pure functions.
 * An `EngineDescriptor` therefore describes metadata and public API shape,
 * not a runtime object to instantiate.
 */

/** Every Core Engine named in `docs/ENGINE_MAP.md`, plus the Calendar Engine appendix. */
export type EngineId =
  | 'identity-authentication'
  | 'authorization'
  | 'organization-institution'
  | 'entity'
  | 'audit'
  | 'document'
  | 'workflow'
  | 'search'
  | 'reporting'
  | 'forms'
  | 'notification'
  | 'integration'
  | 'ai-assistance'
  | 'plugin-extension-runtime'
  | 'configuration-metadata'
  | 'business-event-bus'
  | 'calendar';

/**
 * Matches `ENGINE_MAP.md`'s own vocabulary exactly:
 * - existing - implemented and in real use.
 * - partial - real code exists but a required piece is missing.
 * - planned - approved and placed on the roadmap, no implementation yet.
 */
export type EngineStatus = 'existing' | 'partial' | 'planned';

/**
 * `ENGINE_MAP.md` itself draws this line, not just this registry: its
 * "required list" is the 16 Core Engines enumerated in numbered sections
 * 1-16, approved by `ARCHITECTURE.md` Section 5 / ADR-005. Calendar is
 * recorded separately, under a heading that literally says "not in the
 * required list" - it exists, is tested, and is genuinely useful, but no
 * ADR elevates it to the same mandatory standing as the 16. This field
 * preserves that distinction structurally, so a consumer of the registry
 * (or a future dependency-boundary rule) can tell "must exist for the
 * platform to function" apart from "documented, optional, currently the
 * only one of its kind."
 *
 * - required - one of the 16 engines in `ENGINE_MAP.md`'s required list.
 * - optional - documented, approved for use, but not mandatory platform
 *   infrastructure (today: only Calendar).
 */
export type EngineClassification = 'required' | 'optional';

export type EngineDescriptor = {
  id: EngineId;
  name: string;
  classification: EngineClassification;
  /** The workspace package that implements this engine, where one exists yet. */
  packageName?: string;
  responsibility: string;
  boundaries: string;
  ownedData: string;
  /** Other engines this one depends on. Never a business module - see dependencyRules.ts. */
  dependencies: EngineId[];
  consumers: string[];
  eventsEmitted: string[];
  eventsConsumed: string[];
  securityRequirements: string;
  auditRequirements: string;
  extensionPoints: string;
  status: EngineStatus;
};

/**
 * One entry per engine documented in `ENGINE_MAP.md` (as of P008). Keep this
 * in sync with that document by hand - see ADR-010's Consequences for why
 * this isn't generated/generating automatically yet (zero real consumers,
 * not a justified need for that machinery today).
 */
export const engineRegistry: EngineDescriptor[] = [
  {
    id: 'identity-authentication',
    classification: 'required',
    name: 'Identity / Authentication',
    responsibility:
      'Establish who is making a request. Owns login, session issuance/verification, and the mapping from a raw provider identity to a Nera user_profile.',
    boundaries:
      'Does not decide what an authenticated user may do (that is Authorization). Does not know about organizations/institutions beyond carrying the identity other engines scope by.',
    ownedData:
      'Session records; the authentication_user_id link on UserProfile (exists from P004).',
    dependencies: [],
    consumers: [
      'authorization',
      'audit',
      'every other engine and module needing the current actor',
    ],
    eventsEmitted: ['UserSignedIn', 'UserSignedOut', 'UserSessionExpired'],
    eventsConsumed: [],
    securityRequirements:
      'Server-verified session on every protected request; session tokens never logged or exposed to client-side storage beyond the SSR cookie pattern.',
    auditRequirements: 'Sign-in and sign-out are audited events.',
    extensionPoints:
      'None planned for V1; a future SSO/identity-provider point is a natural extension.',
    status: 'planned',
  },
  {
    id: 'authorization',
    classification: 'required',
    name: 'Authorization',
    packageName: '@nera/authorization-engine',
    responsibility:
      'Decide whether an authenticated actor may perform a given action, using the hierarchical resolution model from ADR-008.',
    boundaries: 'Never makes an identity decision. Never trusts a client-supplied decision.',
    ownedData:
      'roles, permissions, role_permissions, membership_roles (exist from P004); the PermissionId registry.',
    dependencies: ['identity-authentication', 'organization-institution'],
    consumers: [
      "every business module and every other engine's write/sensitive-read path",
      'the UI (non-authoritative hint only)',
    ],
    eventsEmitted: ['PermissionRuleChanged'],
    eventsConsumed: [],
    securityRequirements:
      'Default deny. Enforced exclusively server-side. RLS as the second, independent enforcement layer.',
    auditRequirements: 'Every permission rule change is audited.',
    extensionPoints: 'Modules register new PermissionIds into the shared catalog.',
    status: 'existing',
  },
  {
    id: 'organization-institution',
    classification: 'required',
    name: 'Organization / Institution (Tenant Engine)',
    packageName: '@nera/organization-engine',
    responsibility:
      'Define the tenant boundary (Organization) every engine/module scopes data by, and the optional Institution business hierarchy beneath it. Guarantee the boundary is enforced at the database level.',
    boundaries:
      'Owns what the tenant boundary is and that it is enforced; does not own business data itself.',
    ownedData:
      'Organization, OrganizationUnit, OrganizationMembership (exist from P004); institutions (P012).',
    dependencies: ['identity-authentication'],
    consumers: ['every engine and module owning tenant-scoped data'],
    eventsEmitted: ['OrganizationCreated', 'OrganizationUpdated', 'OrganizationMembershipChanged'],
    eventsConsumed: [],
    securityRequirements:
      'Every tenant-scoped table has an application-level filter and a database-level RLS policy keyed on organization_id, both FORCE-d (P012) so the table owner is bound too; institution_id is additive only, never trusted alone (ADR-002).',
    auditRequirements:
      'Organization creation, membership changes, and cross-organization administrative actions.',
    extensionPoints: 'None for V1.',
    status: 'existing',
  },
  {
    id: 'entity',
    classification: 'required',
    name: 'Entity',
    packageName: '@nera/entity-engine',
    responsibility:
      'The shared identity record for a person or organization, reused by every business module instead of each module inventing its own person/org table.',
    boundaries:
      'Owns identity, profile and contact data; does not own module-specific business data.',
    ownedData:
      'entities, person_profiles, phones, emails, addresses, notes, role_assignments, duplicate_override_records, list_view_column_preferences - real, RLS-enforced tables since P013A. organization_profiles and module_profiles remain modeled as TypeScript types only, no database table yet.',
    dependencies: ['authorization', 'audit', 'business-event-bus', 'organization-institution'],
    consumers: ['Suppliers and every future Entity-based module', 'Contacts UI', 'Search'],
    eventsEmitted: [
      'EntityCreated',
      'EntityUpdated',
      'EntityArchived',
      'EntityRoleAssigned',
      'EntitiesMerged',
    ],
    eventsConsumed: [],
    securityRequirements:
      'entities.view_sensitive, entities.edit, entities.merge and related permissions enforced server-side.',
    auditRequirements: 'Every create/update/merge/archive is audited.',
    extensionPoints: 'module_profiles and entity_roles are themselves the extension point.',
    status: 'partial',
  },
  {
    id: 'audit',
    classification: 'required',
    name: 'Audit',
    packageName: '@nera/audit-engine',
    responsibility:
      'Record every meaningful business action in an append-only, tamper-resistant trail, and expose it for review.',
    boundaries:
      'A single shared writer for the entire platform - no engine or module maintains its own parallel audit mechanism.',
    ownedData: 'audit_logs (exists from P004).',
    dependencies: ['identity-authentication', 'organization-institution'],
    consumers: ['every engine and module performing a mutation', 'the future AI Assistance Engine'],
    eventsEmitted: ['AuditRecorded'],
    eventsConsumed: ['domain events from every other engine'],
    securityRequirements:
      'Audit records are never editable or deletable through normal application behavior.',
    auditRequirements: 'N/A - this engine is the audit requirement for every other engine.',
    extensionPoints: 'None - audit is deliberately not extensible or bypassable by design.',
    status: 'existing',
  },
  {
    id: 'document',
    classification: 'required',
    name: 'Document',
    responsibility:
      'Durable file storage and basic document generation, used by any module that needs to attach or produce a file.',
    boundaries: 'Stores and serves files; does not interpret their content.',
    ownedData:
      'File metadata; the files themselves live in the underlying storage provider, accessed only through this engine.',
    dependencies: ['authorization', 'audit', 'organization-institution'],
    consumers: ['Invoices', 'Purchase Orders', 'Payments', 'Forms', 'future Integration Engine'],
    eventsEmitted: ['DocumentUploaded', 'DocumentDeleted'],
    eventsConsumed: [],
    securityRequirements:
      'A document uploaded under one tenant is never retrievable by another tenant; access URLs are short-lived/signed.',
    auditRequirements: 'Upload, view (where sensitive), and delete are audited.',
    extensionPoints: 'Document handlers - not implemented in V1, only reserved.',
    status: 'planned',
  },
  {
    id: 'workflow',
    classification: 'required',
    name: 'Workflow',
    responsibility:
      'Generic, reusable approval/step logic. Business modules expose workflow-capable actions; they never implement their own approval logic.',
    boundaries:
      'Owns steps, approvals, rejections, status transitions and history of a workflow instance; does not own the business record.',
    ownedData: 'workflow_definitions, workflow_instances, workflow_steps.',
    dependencies: ['authorization', 'audit', 'business-event-bus'],
    consumers: [
      'Purchase Orders',
      'Payment Approval',
      'any future module needing an approval step',
    ],
    eventsEmitted: [
      'WorkflowStarted',
      'WorkflowStepApproved',
      'WorkflowStepRejected',
      'WorkflowCompleted',
    ],
    eventsConsumed: ['business events that should trigger a workflow'],
    securityRequirements:
      'Only an actor with the specific approval permission for that step can approve or reject.',
    auditRequirements: 'Every state transition audited with actor, timestamp, and reason.',
    extensionPoints:
      'Workflows - a module defines a workflow definition; it does not reimplement the engine.',
    status: 'planned',
  },
  {
    id: 'search',
    classification: 'required',
    name: 'Search',
    responsibility:
      'Cross-entity, cross-module search that always respects the same authorization the underlying data would require if read directly.',
    boundaries: 'Indexes and queries; does not own the source-of-truth data.',
    ownedData: 'A search index (PostgreSQL full-text search for V1).',
    dependencies: ['entity', 'authorization'],
    consumers: ['Global Search UI'],
    eventsEmitted: [],
    eventsConsumed: ['EntityCreated/Updated and equivalent module events'],
    securityRequirements: 'A search result the user is not authorized to view must never appear.',
    auditRequirements: 'Not required for read-only search itself.',
    extensionPoints: 'Search - a module registers what it wants indexed.',
    status: 'planned',
  },
  {
    id: 'reporting',
    classification: 'required',
    name: 'Reporting',
    responsibility:
      'Produce correct, tenant-scoped, permission-filtered reports over real business data.',
    boundaries: 'V1 is a small set of concrete reports, not a generic report-builder engine.',
    ownedData: 'Report definitions/configuration (V1: code-defined).',
    dependencies: ['authorization', 'organization-institution'],
    consumers: ['Dashboard', '/reports nav surface'],
    eventsEmitted: [],
    eventsConsumed: [],
    securityRequirements: 'Same permission model as any other read path.',
    auditRequirements: 'Export of a report is audited.',
    extensionPoints: 'Reports - a module contributes report definitions.',
    status: 'planned',
  },
  {
    id: 'forms',
    classification: 'required',
    name: 'Forms',
    responsibility:
      "Structured data collection beyond a module's built-in record types, built on the existing Customization capability.",
    boundaries:
      'Reuses custom_field_definitions/custom_field_values rather than inventing a parallel field model.',
    ownedData: 'Form definitions (a named, ordered set of custom fields) and submissions.',
    dependencies: ['configuration-metadata', 'document', 'workflow', 'authorization', 'audit'],
    consumers: ['/operations/forms nav surface'],
    eventsEmitted: ['FormSubmitted'],
    eventsConsumed: [],
    securityRequirements: 'Same permission model as any module.',
    auditRequirements: 'Submission and any subsequent edit are audited.',
    extensionPoints: 'Forms - explicit extension point.',
    status: 'planned',
  },
  {
    id: 'notification',
    classification: 'required',
    name: 'Notification',
    responsibility:
      'Deliver a message to the right recipient, through the right channel, at the right time, based on a business event or request.',
    boundaries:
      'Modules never send notifications directly; they publish an event or a notification request.',
    ownedData: 'Notification templates, delivery preferences, delivery status.',
    dependencies: ['business-event-bus', 'organization-institution', 'configuration-metadata'],
    consumers: ['Workflow (post-V1)', 'Automation (post-V1)'],
    eventsEmitted: ['NotificationSent', 'NotificationFailed'],
    eventsConsumed: ['any event a tenant has configured a notification rule for'],
    securityRequirements:
      'A notification never includes data the recipient is not authorized to see.',
    auditRequirements: 'Delivery attempts and outcomes are recorded.',
    extensionPoints: 'Channel providers (email/SMS/push) are pluggable.',
    status: 'planned',
  },
  {
    id: 'integration',
    classification: 'required',
    name: 'Integration',
    responsibility:
      'Connect Nera to external systems and data sources, inbound and outbound. Owns provider adapters and external-system communication generally.',
    boundaries:
      'Owns the connection and raw data exchange; does not own business interpretation of that data.',
    ownedData: 'Connection configuration, credentials (vendor-abstracted), sync/exchange logs.',
    dependencies: ['document', 'audit', 'business-event-bus', 'authorization'],
    consumers: ['MASAV (V1, outbound file exchange)', 'the future AI Assistance invoice flow'],
    eventsEmitted: ['IntegrationSyncCompleted', 'IntegrationSyncFailed'],
    eventsConsumed: ['varies per integration'],
    securityRequirements:
      'Credentials for any external system are never accessible to business-module code directly.',
    auditRequirements: 'Every inbound/outbound exchange with an external system is audited.',
    extensionPoints: 'Integrations - explicit extension point.',
    status: 'planned',
  },
  {
    id: 'ai-assistance',
    classification: 'required',
    name: 'AI Assistance',
    responsibility:
      'Provide suggestions, explanations, confidence and evidence to the user, across any module, without ever acting autonomously on sensitive/irreversible actions.',
    boundaries: 'Never a business module; acts as the requesting user, never as itself.',
    ownedData:
      'A generic suggestion record: target, type, payload, confidence, evidence, status, feedback.',
    dependencies: ['authorization', 'audit', 'document', 'integration'],
    consumers: ['Invoices (future)', 'Entity (future)'],
    eventsEmitted: ['AiSuggestionProposed', 'AiSuggestionResolved'],
    eventsConsumed: ['domain events it may want to react to once implemented'],
    securityRequirements:
      'No irreversible or business-sensitive action without explicit user approval.',
    auditRequirements: 'Every AI-originated action or suggestion outcome is audited.',
    extensionPoints: 'Suggestion types are the extension point.',
    status: 'planned',
  },
  {
    id: 'plugin-extension-runtime',
    classification: 'required',
    name: 'Plugin / Extension Runtime',
    packageName: '@nera/core',
    responsibility: 'Own the mechanism by which extension points are registered and executed.',
    boundaries:
      'Defines how an extension attaches; never grants an extension a capability the security principles forbid.',
    ownedData: 'A registry of registered extensions and what they are authorized to extend.',
    dependencies: ['authorization'],
    consumers: ['every other engine, as the shared front door for registering an extension'],
    eventsEmitted: ['ExtensionRegistered', 'ExtensionDisabled'],
    eventsConsumed: [],
    securityRequirements:
      'Registering or enabling an extension is itself an authorized, audited action.',
    auditRequirements: 'Extension install/enable/disable is audited.',
    extensionPoints: 'This engine is the extension-point mechanism itself.',
    status: 'partial',
  },
  {
    id: 'configuration-metadata',
    classification: 'required',
    name: 'Configuration / Metadata',
    packageName: '@nera/customization-engine + @nera/settings-engine',
    responsibility:
      'Let tenants adapt fields, forms, lists, statuses and other configurable surfaces without code changes.',
    boundaries: 'Owns configuration/metadata; never owns business data itself.',
    ownedData:
      'custom_field_definitions, custom_field_values, list-view column configuration, field requirement rules; tenant/organization/user-scoped settings.',
    dependencies: ['organization-institution', 'authorization'],
    consumers: ['Entity', 'Forms', 'every module needing tenant-specific settings'],
    eventsEmitted: ['CustomFieldDefinitionChanged', 'SettingChanged'],
    eventsConsumed: [],
    securityRequirements:
      'Sensitive custom fields are gated by custom_fields.view_sensitive, enforced server-side.',
    auditRequirements: 'Definition changes are audited.',
    extensionPoints: 'A module registers its own custom-field-eligible entity/record types.',
    status: 'partial',
  },
  {
    id: 'business-event-bus',
    classification: 'required',
    name: 'Business Event Bus',
    packageName: '@nera/event-bus-engine',
    responsibility:
      'Let engines and modules communicate by publishing and subscribing to events instead of calling each other directly.',
    boundaries: 'In-process for V1, not a distributed queue.',
    ownedData: 'An event log (if persisted); the event type registry.',
    dependencies: ['organization-institution', 'audit'],
    consumers: ['Audit', 'Notification (post-V1)', 'Automation (post-V1)', 'Search'],
    eventsEmitted: [],
    eventsConsumed: ['all business events published by every engine/module'],
    securityRequirements:
      'An event payload never carries more data than its least-trusted possible subscriber should see.',
    auditRequirements:
      'Not itself an audit mechanism; its own operational failures must be observable.',
    extensionPoints:
      'Business events - a plugin may subscribe to (never intercept/block) a business event.',
    status: 'partial',
  },
  {
    id: 'calendar',
    classification: 'optional',
    name: 'Calendar',
    packageName: '@nera/calendar-engine',
    responsibility:
      'Gregorian/Hebrew calendar conversion, formatting, and comparison, entirely through Intl.',
    boundaries: 'Pure functions; owns no data.',
    ownedData: 'none.',
    dependencies: [],
    consumers: ['any UI or module displaying or filtering by date'],
    eventsEmitted: [],
    eventsConsumed: [],
    securityRequirements: 'None - pure computation, no access-control surface.',
    auditRequirements: 'None.',
    extensionPoints: 'None.',
    status: 'existing',
  },
];

export function getEngine(
  id: EngineId,
  registry: EngineDescriptor[] = engineRegistry
): EngineDescriptor | undefined {
  return registry.find(entry => entry.id === id);
}

export function listEngines(registry: EngineDescriptor[] = engineRegistry): EngineDescriptor[] {
  return registry;
}

export function getEnginesByStatus(
  status: EngineStatus,
  registry: EngineDescriptor[] = engineRegistry
): EngineDescriptor[] {
  return registry.filter(entry => entry.status === status);
}

/** The 16 engines `ENGINE_MAP.md` lists as required platform infrastructure. */
export function getRequiredEngines(
  registry: EngineDescriptor[] = engineRegistry
): EngineDescriptor[] {
  return registry.filter(entry => entry.classification === 'required');
}

/** Documented, approved engines that are not mandatory platform infrastructure - today, only Calendar. */
export function getOptionalEngines(
  registry: EngineDescriptor[] = engineRegistry
): EngineDescriptor[] {
  return registry.filter(entry => entry.classification === 'optional');
}

/**
 * Registry-integrity issues: a duplicate id, a dependency pointing at an id
 * that isn't in the registry, or a dependency cycle. An empty array means
 * the registry is valid.
 */
export function findEngineRegistryIssues(registry: EngineDescriptor[] = engineRegistry): string[] {
  const issues: string[] = [];
  const seenIds = new Set<EngineId>();

  for (const entry of registry) {
    if (seenIds.has(entry.id)) {
      issues.push(`Duplicate engine id: "${entry.id}"`);
    }
    seenIds.add(entry.id);
  }

  for (const entry of registry) {
    for (const dependencyId of entry.dependencies) {
      if (!seenIds.has(dependencyId)) {
        issues.push(
          `Engine "${entry.id}" declares a dependency on unknown engine "${dependencyId}"`
        );
      }
    }
  }

  const cycle = findDependencyCycle(registry);
  if (cycle) {
    issues.push(`Dependency cycle detected: ${cycle.join(' -> ')}`);
  }

  return issues;
}

/** Throws with every issue found if the registry is not valid. Call this from a test, not from a public API - see engine.test.ts. */
export function assertValidEngineRegistry(registry: EngineDescriptor[] = engineRegistry): void {
  const issues = findEngineRegistryIssues(registry);
  if (issues.length > 0) {
    throw new Error(`Invalid engine registry:\n${issues.map(issue => `  - ${issue}`).join('\n')}`);
  }
}

/**
 * Depth-first cycle search over the declared `dependencies` graph. Returns
 * the cycle path (for a useful error message) or undefined if the graph is
 * acyclic. Unknown-dependency edges are skipped here (already reported
 * separately by findEngineRegistryIssues) so one bad reference doesn't also
 * produce a spurious cycle report.
 */
function findDependencyCycle(registry: EngineDescriptor[]): EngineId[] | undefined {
  const byId = new Map(registry.map(entry => [entry.id, entry]));
  const visiting = new Set<EngineId>();
  const visited = new Set<EngineId>();

  function visit(id: EngineId, path: EngineId[]): EngineId[] | undefined {
    if (visiting.has(id)) {
      return [...path, id];
    }
    if (visited.has(id)) {
      return undefined;
    }

    visiting.add(id);
    const entry = byId.get(id);
    if (entry) {
      for (const dependencyId of entry.dependencies) {
        if (!byId.has(dependencyId)) {
          continue;
        }
        const found = visit(dependencyId, [...path, id]);
        if (found) {
          return found;
        }
      }
    }
    visiting.delete(id);
    visited.add(id);
    return undefined;
  }

  for (const entry of registry) {
    const found = visit(entry.id, []);
    if (found) {
      return found;
    }
  }

  return undefined;
}

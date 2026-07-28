import { type EntityType } from './entity';

/**
 * The role catalog an entity can be assigned to. This is the extension
 * point for future business modules (Suppliers, Avreichim, Students, ...):
 * a module adds its own role id here and stores its module-specific data
 * keyed by the role assignment id, instead of duplicating identity/contact
 * information onto the entity itself.
 *
 * Kept as a plain string (not a fixed union) because role DEFINITIONS are
 * now administrator-configurable at runtime (see RoleDefinition below) -
 * the set of valid role keys is data, not a compile-time constant.
 * BuiltInRoleKey below still gives autocomplete/typo-safety for the
 * built-in seed roles this engine ships with.
 */
export type EntityRoleId = string;

export type BuiltInRoleKey =
  | 'contact'
  | 'employee'
  | 'avreich'
  | 'student'
  | 'parent'
  | 'donor'
  | 'administrator'
  | 'individual_supplier'
  | 'supplier'
  | 'customer'
  | 'partner'
  | 'service_provider';

export type RoleDefinitionStatus = 'active' | 'inactive';

/**
 * The permission id required for each role-related action. Kept as a plain
 * string to avoid a compile-time dependency from this engine onto
 * @nera/authorization-engine's PermissionId union - the app layer, which
 * depends on both, is responsible for keeping these in sync with real
 * permission ids.
 */
export type RoleRequiredPermissions = {
  view?: string;
  create?: string;
  edit?: string;
  assign?: string;
  remove?: string;
};

/**
 * A configurable role definition. Built-in roles (isSystem: true) ship
 * with the engine and can never be deleted, only hidden/disabled
 * (status: 'inactive') - see entityRoleRegistry. Administrators can define
 * additional roles at runtime through the app's role-definition context;
 * those are ordinary RoleDefinition records with isSystem: false.
 *
 * `key` is the stable, English, immutable-after-creation identifier that
 * RoleAssignment.role actually stores and matches against - `id` is a
 * separate, opaque record identifier (a future database primary key).
 */
export type RoleDefinition = {
  id: string;
  key: string;
  /** Hebrew label shown in the UI. */
  label: string;
  /** Short Hebrew description of what this role represents. */
  description: string;
  /** Which entity kinds this role may be assigned to - not every role is valid for every entity type. */
  applicableEntityTypes: EntityType[];
  /** undefined = applies across every institution (a global/system role). */
  institutionId?: string;
  status: RoleDefinitionStatus;
  /** Display ordering, ascending. */
  order: number;
  /** Icon identifier (matches the app's icon-name convention); optional. */
  icon?: string;
  /** Whether this role appears as a shortcut in the global "הוספה חדשה" menu. */
  showInGlobalAddNew: boolean;
  /** Whether the same entity may hold this role via more than one simultaneous active assignment. */
  allowMultipleAssignments: boolean;
  /** Whether assignments of this role are expected to carry a start/end date (UI hint only - RoleAssignment always supports both). */
  supportsDateRange: boolean;
  /** Whether role assignments of this type may carry a billing/invoice display name (see billingProfile.ts) - shown in the UI only for roles where this is true (suppliers, donors, customers, individual suppliers by default). */
  supportsBillingProfile: boolean;
  requiredPermissions: RoleRequiredPermissions;
  /** Custom-field definitions (see @nera/customization-engine) specifically linked to this role, if any. */
  linkedCustomFieldDefinitionIds: string[];
  /** Built-in roles ship with the engine and can be hidden but never deleted; custom roles are fully administrator-owned. */
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

/**
 * Input shape for creating a new, administrator-defined role definition
 * (P013B - see `docs/ROADMAP.md`). `institutionId` is accepted here for
 * shape-compatibility with `RoleDefinition` but is never persisted (Owner
 * decision 3, P013B sprint spec) - see `persistence/roleDefinitionRepository.ts`.
 */
export type NewRoleDefinitionInput = {
  key: string;
  label: string;
  description: string;
  applicableEntityTypes: EntityType[];
  institutionId?: string;
  showInGlobalAddNew: boolean;
  allowMultipleAssignments: boolean;
  supportsDateRange: boolean;
  supportsBillingProfile: boolean;
  icon?: string;
};

/** Patchable subset of `RoleDefinition`'s configurable metadata - never `key` (immutable after creation) and never `isSystem`'s identity fields. */
export type RoleDefinitionPatch = Partial<
  Pick<
    RoleDefinition,
    | 'label'
    | 'description'
    | 'applicableEntityTypes'
    | 'institutionId'
    | 'showInGlobalAddNew'
    | 'allowMultipleAssignments'
    | 'supportsDateRange'
    | 'supportsBillingProfile'
    | 'icon'
    | 'order'
  >
>;

const SEED_TIMESTAMP = '2026-01-01T00:00:00.000Z';

function builtInRole(
  key: BuiltInRoleKey,
  label: string,
  description: string,
  applicableEntityTypes: EntityType[],
  order: number,
  overrides: Partial<
    Pick<
      RoleDefinition,
      'showInGlobalAddNew' | 'allowMultipleAssignments' | 'icon' | 'supportsBillingProfile'
    >
  > = {}
): RoleDefinition {
  return {
    id: `role-def-${key}`,
    key,
    label,
    description,
    applicableEntityTypes,
    status: 'active',
    order,
    showInGlobalAddNew: false,
    allowMultipleAssignments: false,
    supportsDateRange: true,
    supportsBillingProfile: false,
    requiredPermissions: {},
    linkedCustomFieldDefinitionIds: [],
    isSystem: true,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
    ...overrides,
  };
}

/**
 * The built-in role seed. This is the initial content of the
 * administrator-configurable role catalog, not a fixed runtime source of
 * truth - the app layer's RoleDefinitionContext holds the live list
 * (built-ins plus any custom roles), and every function below operates on
 * whatever RoleDefinition[] list is passed to it rather than reading this
 * constant implicitly.
 */
export const entityRoleRegistry: RoleDefinition[] = [
  builtInRole('contact', 'איש קשר', 'איש קשר כללי ללא שיוך עסקי ספציפי.', ['person'], 0),
  builtInRole('employee', 'עובד', 'עובד בארגון.', ['person'], 1, { showInGlobalAddNew: true }),
  builtInRole('avreich', 'אברך', 'אברך המשויך למוסד לימוד.', ['person'], 2, {
    showInGlobalAddNew: true,
  }),
  builtInRole('student', 'תלמיד', 'תלמיד המשויך למסגרת לימודים.', ['person'], 3, {
    showInGlobalAddNew: true,
  }),
  builtInRole('parent', 'הורה', 'הורה או אפוטרופוס של תלמיד.', ['person'], 4),
  builtInRole('donor', 'תורם', 'תורם לארגון.', ['person', 'organization'], 5, {
    allowMultipleAssignments: true,
    supportsBillingProfile: true,
  }),
  builtInRole('administrator', 'מנהל מערכת', 'הרשאת ניהול מערכת.', ['person'], 6),
  builtInRole(
    'individual_supplier',
    'ספק פרטי',
    'איש קשר המשמש כספק באופן פרטי, שלא דרך חברה.',
    ['person'],
    7,
    { supportsBillingProfile: true }
  ),
  builtInRole('supplier', 'ספק', 'ארגון המספק שירותים או מוצרים.', ['organization'], 8, {
    showInGlobalAddNew: true,
    supportsBillingProfile: true,
  }),
  builtInRole('customer', 'לקוח', 'גורם הרוכש שירותים או מוצרים.', ['person', 'organization'], 9, {
    supportsBillingProfile: true,
  }),
  builtInRole('partner', 'שותף עסקי', 'ארגון שותף עסקית.', ['organization'], 10),
  builtInRole(
    'service_provider',
    'נותן שירות',
    'גורם המעניק שירות לארגון.',
    ['person', 'organization'],
    11
  ),
];

function isVisible(role: RoleDefinition): boolean {
  return role.status === 'active' && !role.deletedAt;
}

export function getRolesForEntityType(
  roles: RoleDefinition[],
  entityType: EntityType
): RoleDefinition[] {
  return roles
    .filter(role => isVisible(role) && role.applicableEntityTypes.includes(entityType))
    .sort((a, b) => a.order - b.order);
}

export function findRoleDefinition(
  roles: RoleDefinition[],
  key: EntityRoleId
): RoleDefinition | undefined {
  return roles.find(entry => entry.key === key);
}

export function getRoleDefinition(roles: RoleDefinition[], key: EntityRoleId): RoleDefinition {
  const definition = findRoleDefinition(roles, key);
  if (!definition) {
    throw new Error(`Unknown entity role: ${key}`);
  }
  return definition;
}

export function getRoleLabel(roles: RoleDefinition[], key: EntityRoleId): string {
  return findRoleDefinition(roles, key)?.label ?? key;
}

export type RoleAssignmentStatus = 'active' | 'ended';

/**
 * Links an entity to a role, optionally scoped to one Nera organization.
 * The same entity can hold several assignments at once (e.g. an employee
 * who is also an avreich) - this is how the engine supports an entity
 * having multiple simultaneous roles without duplicating its identity
 * record. See financial.ts for why each assignment must keep its own
 * financial stream rather than being combined at the entity level.
 *
 * `role` stores a RoleDefinition.key (a stable string), never a
 * RoleDefinition.id - role assignments therefore keep working unchanged
 * even as role definitions themselves become editable/administrator-owned.
 */
export type RoleAssignment = {
  id: string;
  entityId: string;
  role: EntityRoleId;
  organizationId?: string;
  status: RoleAssignmentStatus;
  startDate?: string;
  endDate?: string;
  notes?: string;
  /** Extension point: a future module (e.g. Employees) attaches its own profile record keyed by this assignment id. */
  moduleProfileRef?: string;
  createdAt: string;
};

/**
 * Whether a new active assignment of `role` may be added for `entityId`,
 * given its existing assignments and the role's allowMultipleAssignments
 * flag. Built-in roles default to false (one active assignment at a time,
 * matching the platform's original behavior); a role explicitly configured
 * to allow multiple assignments (e.g. "תורם" for repeated pledges) permits
 * more than one simultaneous active assignment of the same role.
 */
export function canAssignRole(
  entityId: string,
  role: EntityRoleId,
  existingAssignments: RoleAssignment[],
  roleDefinition: RoleDefinition | undefined
): boolean {
  if (roleDefinition?.allowMultipleAssignments) {
    return true;
  }
  return !existingAssignments.some(
    assignment =>
      assignment.entityId === entityId && assignment.role === role && assignment.status === 'active'
  );
}

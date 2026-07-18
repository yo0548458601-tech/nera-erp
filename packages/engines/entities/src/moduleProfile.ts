/**
 * Architectural contract (see docs/decisions for the recommended ADR):
 * the Entity Engine is the ONLY identity source on the platform. Every
 * current and future module that deals with a person or an organization
 * (Contacts, Suppliers, Donors, Employees, Avreichim, Students, Parents,
 * Customers, and anything added later) MUST reference a shared entity by
 * entityId (and, where relevant, a specific RoleAssignment by
 * roleAssignmentId) rather than storing its own copy of a name, phone,
 * email, address, ID number or registration number.
 *
 * Concretely:
 *   - Person modules read identity/contact data from PersonProfile
 *     (personProfile.ts), keyed by entityId.
 *   - Organization modules read identity/contact data from
 *     OrganizationProfile (organizationProfile.ts), keyed by entityId.
 *   - A "company supplier" is an OrganizationEntity + a 'supplier'
 *     RoleAssignment; an "individual supplier" is a PersonEntity + an
 *     'individual_supplier' RoleAssignment. Neither has its own name/phone
 *     fields - both resolve identity through the shared entity.
 *   - Module-specific data (e.g. an Employee's salary grade, a Student's
 *     class) lives in a separate module profile record keyed by
 *     entityId and/or roleAssignmentId, never by duplicating identity
 *     fields onto that record.
 *   - Financial streams stay separated by roleAssignmentId (see
 *     financial.ts / assertDistinctRoleStreams) - never combined at the
 *     bare entityId level.
 *
 * ModuleProfileBase below is a lightweight, compile-time self-check: a
 * module profile type built with `ModuleProfile<T>` is rejected by the
 * compiler (resolves to `never`) if T tries to redeclare one of the
 * forbidden identity field names, catching the most common accidental
 * violation (a module re-adding "firstName"/"phones"/etc. instead of
 * reading them from the shared entity). TypeScript cannot fully forbid
 * "must not contain a key with any shape" for arbitrary future fields, so
 * this is a helpful guardrail and a documentation anchor, not a complete
 * enforcement mechanism - code review and the recommended ADR remain the
 * primary enforcement for this rule.
 */
export type ForbiddenIdentityFields =
  | 'firstName'
  | 'lastName'
  | 'displayName'
  | 'legalName'
  | 'idNumber'
  | 'registrationNumber'
  | 'phones'
  | 'emails'
  | 'addresses';

export type ModuleProfileBase = {
  /** The shared Entity this module record belongs to - the only allowed link to identity. */
  entityId: string;
  /** The specific role assignment this module record belongs to, when the module is role-scoped (e.g. Employee, Avreich). */
  roleAssignmentId?: string;
};

/**
 * Builds a module-specific profile type from its own fields `T`, guarded
 * against accidentally redeclaring identity fields that must instead be
 * read from the shared Entity Engine. Usage:
 *
 *   type EmployeeProfile = ModuleProfile<{ salaryGrade: string; department: string }>;
 *
 * If `T` contains a forbidden key (e.g. `firstName`), this resolves to
 * `never` and any attempt to use it as a type produces a compiler error.
 */
export type ModuleProfile<T extends Record<string, unknown>> = Extract<keyof T, ForbiddenIdentityFields> extends never
  ? T & ModuleProfileBase
  : never;

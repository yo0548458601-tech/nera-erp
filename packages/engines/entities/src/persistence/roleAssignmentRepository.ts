/**
 * RoleAssignment persistence repository (P013A - see `docs/ROADMAP.md`).
 *
 * `role` is a plain, application-validated string key (matches
 * `entityRoleRegistry` / `RoleDefinition.key` - see `../roles.ts`) - there is
 * no FK to a role-definition table because `RoleDefinition` is not persisted.
 * "One active assignment unless the role allows multiple" is therefore an
 * application-layer invariant (`canAssignRole`, re-checked here at write
 * time), not a DB constraint - see the P013A design document.
 */

import { appPrisma, type Prisma, type RoleAssignmentStatus } from '@nera/database';
import { canAssignRole, type RoleAssignment, type RoleDefinition } from '../roles.js';

export type RoleAssignmentRecord = {
  id: string;
  organizationId: string;
  entityId: string;
  role: string;
  status: RoleAssignmentStatus;
  startDate: Date | null;
  endDate: Date | null;
  notes: string | null;
  moduleProfileRef: string | null;
  assignedByUserId: string;
  createdAt: Date;
  removedAt: Date | null;
};

export type RoleAssignmentRepositoryDbClient = {
  roleAssignment: {
    create(args: {
      data: Prisma.RoleAssignmentUncheckedCreateInput;
    }): Promise<RoleAssignmentRecord>;
    findMany(args: { where: { entityId: string } }): Promise<RoleAssignmentRecord[]>;
    findUnique(args: { where: { id: string } }): Promise<RoleAssignmentRecord | null>;
    update(args: {
      where: { id: string };
      data: Prisma.RoleAssignmentUncheckedUpdateInput;
    }): Promise<RoleAssignmentRecord>;
  };
};

function assertRequiredString(label: string, value: unknown): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `roleAssignmentRepository: "${label}" is required and must be a non-empty string.`
    );
  }
}

export type AssignRoleInput = {
  organizationId: string;
  entityId: string;
  role: string;
  assignedByUserId: string;
  startDate?: Date;
  endDate?: Date;
  notes?: string;
  roleDefinition: RoleDefinition | undefined;
};

export type RoleAssignmentRepository = {
  listRoleAssignments(entityId: string): Promise<RoleAssignmentRecord[]>;
  assignRole(input: AssignRoleInput): Promise<RoleAssignmentRecord>;
  removeRoleAssignment(id: string, organizationId: string): Promise<RoleAssignmentRecord>;
};

export function createRoleAssignmentRepository(
  client: RoleAssignmentRepositoryDbClient = appPrisma
): RoleAssignmentRepository {
  return {
    async listRoleAssignments(entityId) {
      assertRequiredString('entityId', entityId);
      return client.roleAssignment.findMany({ where: { entityId } });
    },

    async assignRole(input) {
      assertRequiredString('organizationId', input.organizationId);
      assertRequiredString('entityId', input.entityId);
      assertRequiredString('role', input.role);
      assertRequiredString('assignedByUserId', input.assignedByUserId);

      const existingAssignments = await client.roleAssignment.findMany({
        where: { entityId: input.entityId },
      });
      const asDomainAssignments: RoleAssignment[] = existingAssignments
        .filter(assignment => assignment.removedAt === null)
        .map(assignment => ({
          id: assignment.id,
          entityId: assignment.entityId,
          role: assignment.role,
          status: assignment.status,
          createdAt: assignment.createdAt.toISOString(),
        }));

      if (!canAssignRole(input.entityId, input.role, asDomainAssignments, input.roleDefinition)) {
        throw new Error(
          `roleAssignmentRepository: entity "${input.entityId}" already has an active assignment of role "${input.role}", which does not allow multiple assignments.`
        );
      }

      return client.roleAssignment.create({
        data: {
          organizationId: input.organizationId,
          entityId: input.entityId,
          role: input.role,
          assignedByUserId: input.assignedByUserId,
          startDate: input.startDate,
          endDate: input.endDate,
          notes: input.notes,
        },
      });
    },

    async removeRoleAssignment(id, organizationId) {
      assertRequiredString('id', id);
      assertRequiredString('organizationId', organizationId);

      const assignment = await client.roleAssignment.findUnique({ where: { id } });
      if (!assignment || assignment.organizationId !== organizationId) {
        throw new Error(
          `roleAssignmentRepository: assignment "${id}" does not belong to organization "${organizationId}".`
        );
      }

      return client.roleAssignment.update({ where: { id }, data: { removedAt: new Date() } });
    },
  };
}

/**
 * PersonProfile persistence repository (P013A - see `docs/ROADMAP.md`).
 * 1:1 with Entity - `entityId` is both the primary key and the foreign key.
 * No independent soft-delete: a profile's lifecycle always follows its
 * owning Entity's.
 */

import { appPrisma, type PersonGender, type Prisma } from '@nera/database';

export type PersonProfileRecord = {
  entityId: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  idNumber: string | null;
  birthDateGregorian: Date | null;
  hebrewDateAdjustmentDays: number;
  gender: PersonGender;
  profileImageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PersonProfileRepositoryDbClient = {
  personProfile: {
    create(args: { data: Prisma.PersonProfileUncheckedCreateInput }): Promise<PersonProfileRecord>;
    findUnique(args: { where: { entityId: string } }): Promise<PersonProfileRecord | null>;
    update(args: {
      where: { entityId: string };
      data: Prisma.PersonProfileUncheckedUpdateInput;
    }): Promise<PersonProfileRecord>;
  };
};

export type CreatePersonProfileInput = {
  entityId: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  idNumber?: string;
  birthDateGregorian?: Date;
  hebrewDateAdjustmentDays: -1 | 0 | 1;
  gender: PersonGender;
  profileImageUrl?: string;
};

export type UpdatePersonProfileInput = Omit<CreatePersonProfileInput, 'organizationId'> & {
  organizationId: string;
};

export type PersonProfileRepository = {
  createPersonProfile(input: CreatePersonProfileInput): Promise<PersonProfileRecord>;
  getPersonProfile(entityId: string, organizationId: string): Promise<PersonProfileRecord | null>;
  updatePersonProfile(input: UpdatePersonProfileInput): Promise<PersonProfileRecord>;
};

function assertRequiredString(label: string, value: unknown): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `personProfileRepository: "${label}" is required and must be a non-empty string.`
    );
  }
}

export function createPersonProfileRepository(
  client: PersonProfileRepositoryDbClient = appPrisma
): PersonProfileRepository {
  return {
    async createPersonProfile(input) {
      assertRequiredString('entityId', input.entityId);
      assertRequiredString('organizationId', input.organizationId);
      assertRequiredString('firstName', input.firstName);
      assertRequiredString('lastName', input.lastName);

      return client.personProfile.create({
        data: {
          entityId: input.entityId,
          organizationId: input.organizationId,
          firstName: input.firstName,
          lastName: input.lastName,
          idNumber: input.idNumber,
          birthDateGregorian: input.birthDateGregorian,
          hebrewDateAdjustmentDays: input.hebrewDateAdjustmentDays,
          gender: input.gender,
          profileImageUrl: input.profileImageUrl,
        },
      });
    },

    async getPersonProfile(entityId, organizationId) {
      assertRequiredString('entityId', entityId);
      assertRequiredString('organizationId', organizationId);

      const profile = await client.personProfile.findUnique({ where: { entityId } });
      if (!profile || profile.organizationId !== organizationId) {
        return null;
      }
      return profile;
    },

    async updatePersonProfile(input) {
      assertRequiredString('entityId', input.entityId);
      assertRequiredString('organizationId', input.organizationId);

      const existing = await client.personProfile.findUnique({
        where: { entityId: input.entityId },
      });
      if (!existing || existing.organizationId !== input.organizationId) {
        throw new Error(
          `personProfileRepository: profile for entity "${input.entityId}" does not belong to organization "${input.organizationId}".`
        );
      }

      return client.personProfile.update({
        where: { entityId: input.entityId },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          idNumber: input.idNumber ?? null,
          birthDateGregorian: input.birthDateGregorian ?? null,
          hebrewDateAdjustmentDays: input.hebrewDateAdjustmentDays,
          gender: input.gender,
          profileImageUrl: input.profileImageUrl ?? null,
        },
      });
    },
  };
}

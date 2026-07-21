import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { prisma } from '@nera/database';
import {
  createAssertInstitutionBelongsToOrganization,
  InstitutionOwnershipError,
  type InstitutionOwnershipDbClient,
} from './institutionOwnership';

function createFakeClient(
  findUniqueImpl?: InstitutionOwnershipDbClient['institution']['findUnique']
): InstitutionOwnershipDbClient & { findUnique: ReturnType<typeof vi.fn> } {
  const findUnique = vi.fn(findUniqueImpl ?? (async () => null));
  return { institution: { findUnique }, findUnique };
}

describe('createAssertInstitutionBelongsToOrganization', () => {
  it('does not connect to or query the database at construction time', () => {
    const fake = createFakeClient();

    expect(() => createAssertInstitutionBelongsToOrganization(fake)).not.toThrow();
    expect(fake.findUnique).not.toHaveBeenCalled();
  });

  it('defaults to the real @nera/database Prisma client when no client is injected', () => {
    expect(() => createAssertInstitutionBelongsToOrganization()).not.toThrow();
  });

  describe('input validation', () => {
    it('rejects a missing institutionId without querying the database', async () => {
      const fake = createFakeClient();
      const assertInstitutionBelongsToOrganization =
        createAssertInstitutionBelongsToOrganization(fake);

      await expect(
        assertInstitutionBelongsToOrganization(undefined as unknown as string, 'org-1')
      ).rejects.toThrow(/institutionId/);
      expect(fake.findUnique).not.toHaveBeenCalled();
    });

    it('rejects an empty-string organizationId without querying the database', async () => {
      const fake = createFakeClient();
      const assertInstitutionBelongsToOrganization =
        createAssertInstitutionBelongsToOrganization(fake);

      await expect(assertInstitutionBelongsToOrganization('institution-1', '   ')).rejects.toThrow(
        /organizationId/
      );
      expect(fake.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('resolution against Institution', () => {
    it('resolves when the institution exists and belongs to the given organization', async () => {
      const fake = createFakeClient(async () => ({
        id: 'institution-1',
        organizationId: 'org-1',
        deletedAt: null,
      }));
      const assertInstitutionBelongsToOrganization =
        createAssertInstitutionBelongsToOrganization(fake);

      await expect(
        assertInstitutionBelongsToOrganization('institution-1', 'org-1')
      ).resolves.toBeUndefined();
    });

    it('throws unknown-institution when no row exists', async () => {
      const fake = createFakeClient(async () => null);
      const assertInstitutionBelongsToOrganization =
        createAssertInstitutionBelongsToOrganization(fake);

      const error = await assertInstitutionBelongsToOrganization('institution-1', 'org-1').catch(
        (caught: unknown) => caught
      );

      expect(error).toBeInstanceOf(InstitutionOwnershipError);
      expect((error as InstitutionOwnershipError).reason).toBe('unknown-institution');
    });

    it('throws organization-mismatch when the institution belongs to a different organization', async () => {
      const fake = createFakeClient(async () => ({
        id: 'institution-1',
        organizationId: 'org-2',
        deletedAt: null,
      }));
      const assertInstitutionBelongsToOrganization =
        createAssertInstitutionBelongsToOrganization(fake);

      const error = await assertInstitutionBelongsToOrganization('institution-1', 'org-1').catch(
        (caught: unknown) => caught
      );

      expect(error).toBeInstanceOf(InstitutionOwnershipError);
      expect((error as InstitutionOwnershipError).reason).toBe('organization-mismatch');
    });

    it('throws institution-deleted when the institution is soft-deleted, even if the organization matches', async () => {
      const fake = createFakeClient(async () => ({
        id: 'institution-1',
        organizationId: 'org-1',
        deletedAt: new Date('2026-01-01T00:00:00.000Z'),
      }));
      const assertInstitutionBelongsToOrganization =
        createAssertInstitutionBelongsToOrganization(fake);

      const error = await assertInstitutionBelongsToOrganization('institution-1', 'org-1').catch(
        (caught: unknown) => caught
      );

      expect(error).toBeInstanceOf(InstitutionOwnershipError);
      expect((error as InstitutionOwnershipError).reason).toBe('institution-deleted');
    });
  });

  describe('database error handling', () => {
    it('propagates a database error without swallowing or converting it to a deny', async () => {
      const originalError = new Error('connection refused');
      const fake = createFakeClient(async () => {
        throw originalError;
      });
      const assertInstitutionBelongsToOrganization =
        createAssertInstitutionBelongsToOrganization(fake);

      await expect(assertInstitutionBelongsToOrganization('institution-1', 'org-1')).rejects.toBe(
        originalError
      );
    });
  });
});

/**
 * Live-database tests - a plain read against real rows, exercising the exact
 * "same id, different org" and "same name, different org" cases that prove
 * the check is strict id+organization matching, not fuzzy/name-based.
 * Requires a real PostgreSQL connection (see organizationContext.test.ts's
 * describe block comment for what that requires).
 */
describe('assertInstitutionBelongsToOrganization (against real rows, requires PostgreSQL)', () => {
  const assertInstitutionBelongsToOrganization = createAssertInstitutionBelongsToOrganization();

  it('resolves for a real institution matching its real organization', async () => {
    const organization = await prisma.organization.create({
      data: { id: randomUUID(), name: 'Org - real institution match' },
    });
    const institution = await prisma.institution.create({
      data: { id: randomUUID(), organizationId: organization.id, name: 'Real Institution' },
    });

    await expect(
      assertInstitutionBelongsToOrganization(institution.id, organization.id)
    ).resolves.toBeUndefined();
  });

  it('never matches by name across organizations - only by id and organization together', async () => {
    const organizationA = await prisma.organization.create({
      data: { id: randomUUID(), name: 'Org A - name collision' },
    });
    const organizationB = await prisma.organization.create({
      data: { id: randomUUID(), name: 'Org B - name collision' },
    });
    const institutionUnderB = await prisma.institution.create({
      data: { id: randomUUID(), organizationId: organizationB.id, name: 'Shared Institution Name' },
    });
    await prisma.institution.create({
      data: { id: randomUUID(), organizationId: organizationA.id, name: 'Shared Institution Name' },
    });

    const error = await assertInstitutionBelongsToOrganization(
      institutionUnderB.id,
      organizationA.id
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(InstitutionOwnershipError);
    expect((error as InstitutionOwnershipError).reason).toBe('organization-mismatch');
  });
});

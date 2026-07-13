import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.info('Skipping database seed in production.');
    return;
  }

  const organization = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000000' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000000',
      name: 'Platform Seed Organization',
      legalName: 'Platform Seed Organization',
      registrationNumber: 'SEED-001',
      defaultLocale: 'en',
      defaultTimezone: 'UTC',
      defaultCalendarDisplay: 'gregorian',
    },
  });

  const permissions = [
    { permissionKey: 'platform.organization.create', resource: 'organization', action: 'create', description: 'Create organizations' },
    { permissionKey: 'platform.organization.read', resource: 'organization', action: 'read', description: 'Read organizations' },
    { permissionKey: 'platform.organization.update', resource: 'organization', action: 'update', description: 'Update organizations' },
    { permissionKey: 'platform.organization.delete', resource: 'organization', action: 'delete', description: 'Delete organizations' },
    { permissionKey: 'platform.organization.approve', resource: 'organization', action: 'approve', description: 'Approve organizations' },
    { permissionKey: 'platform.organization.cancel', resource: 'organization', action: 'cancel', description: 'Cancel organizations' },
    { permissionKey: 'platform.organization.export', resource: 'organization', action: 'export', description: 'Export organizations' },
    { permissionKey: 'platform.organization.import', resource: 'organization', action: 'import', description: 'Import organizations' },
    { permissionKey: 'platform.organization.print', resource: 'organization', action: 'print', description: 'Print organizations' },
    { permissionKey: 'platform.organization.manage', resource: 'organization', action: 'manage', description: 'Manage organizations' },
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { permissionKey: permission.permissionKey },
      update: {},
      create: permission,
    });
  }

  const systemRole = await prisma.role.upsert({
    where: { id: '11111111-1111-1111-1111-111111111111' },
    update: {},
    create: {
      id: '11111111-1111-1111-1111-111111111111',
      organizationId: organization.id,
      name: 'System Administrator',
      description: 'System administrator template role',
      isSystemRole: true,
      status: 'active',
    },
  });

  const allPermissions = await prisma.permission.findMany();
  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        organizationId_roleId_permissionId: {
          organizationId: organization.id,
          roleId: systemRole.id,
          permissionId: permission.id,
        },
      },
      update: { effect: 'allow' },
      create: {
        organizationId: organization.id,
        roleId: systemRole.id,
        permissionId: permission.id,
        effect: 'allow',
      },
    });
  }

  console.info('Database seed completed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

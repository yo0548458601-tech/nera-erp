-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('active', 'inactive', 'suspended', 'archived');

-- CreateEnum
CREATE TYPE "OrganizationUnitStatus" AS ENUM ('active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "UserProfileStatus" AS ENUM ('active', 'inactive', 'suspended', 'pending');

-- CreateEnum
CREATE TYPE "OrganizationMembershipStatus" AS ENUM ('active', 'invited', 'pending', 'suspended', 'left');

-- CreateEnum
CREATE TYPE "RoleStatus" AS ENUM ('active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "RolePermissionEffect" AS ENUM ('allow', 'deny');

-- CreateEnum
CREATE TYPE "CalendarDisplay" AS ENUM ('gregorian', 'hebrew', 'both');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "legal_name" VARCHAR(255),
    "registration_number" VARCHAR(100),
    "status" "OrganizationStatus" NOT NULL DEFAULT 'active',
    "default_locale" VARCHAR(16) NOT NULL DEFAULT 'en',
    "default_timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "default_calendar_display" "CalendarDisplay" NOT NULL DEFAULT 'gregorian',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_units" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "parent_id" UUID,
    "unit_type" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "status" "OrganizationUnitStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "organization_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL,
    "authentication_user_id" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(255),
    "preferred_locale" VARCHAR(16) NOT NULL DEFAULT 'en',
    "preferred_timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "preferred_calendar_display" "CalendarDisplay" NOT NULL DEFAULT 'gregorian',
    "status" "UserProfileStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_memberships" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_profile_id" UUID NOT NULL,
    "status" "OrganizationMembershipStatus" NOT NULL DEFAULT 'active',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_system_role" BOOLEAN NOT NULL DEFAULT false,
    "status" "RoleStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "permission_key" VARCHAR(255) NOT NULL,
    "resource" VARCHAR(255) NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "effect" "RolePermissionEffect" NOT NULL DEFAULT 'allow',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_roles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "organization_membership_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_user_profile_id" UUID,
    "actor_membership_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(150) NOT NULL,
    "entity_id" VARCHAR(255) NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "metadata" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_authentication_user_id_key" ON "user_profiles"("authentication_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_permission_key_key" ON "permissions"("permission_key");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_org_role_permission_unique" ON "role_permissions"("organization_id", "role_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "membership_roles_membership_role_unique" ON "membership_roles"("organization_membership_id", "role_id");

-- CreateIndex
CREATE INDEX "organization_units_organization_id_idx" ON "organization_units"("organization_id");

-- CreateIndex
CREATE INDEX "organization_units_parent_id_idx" ON "organization_units"("parent_id");

-- CreateIndex
CREATE INDEX "organization_memberships_organization_id_idx" ON "organization_memberships"("organization_id");

-- CreateIndex
CREATE INDEX "organization_memberships_user_profile_id_idx" ON "organization_memberships"("user_profile_id");

-- CreateIndex
CREATE INDEX "organization_memberships_status_idx" ON "organization_memberships"("status");

-- CreateIndex
CREATE INDEX "organization_memberships_organization_id_user_profile_id_idx" ON "organization_memberships"("organization_id", "user_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_memberships_active_unique" ON "organization_memberships"("organization_id", "user_profile_id") WHERE "status" = 'active' AND "deleted_at" IS NULL;

-- CreateIndex
CREATE INDEX "roles_organization_id_idx" ON "roles"("organization_id");

-- CreateIndex
CREATE INDEX "permissions_resource_action_idx" ON "permissions"("resource", "action");

-- CreateIndex
CREATE INDEX "role_permissions_organization_id_idx" ON "role_permissions"("organization_id");

-- CreateIndex
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "membership_roles_organization_id_idx" ON "membership_roles"("organization_id");

-- CreateIndex
CREATE INDEX "membership_roles_organization_membership_id_idx" ON "membership_roles"("organization_membership_id");

-- CreateIndex
CREATE INDEX "membership_roles_role_id_idx" ON "membership_roles"("role_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_idx" ON "audit_logs"("organization_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_profile_id_idx" ON "audit_logs"("actor_user_profile_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_membership_id_idx" ON "audit_logs"("actor_membership_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_idx" ON "audit_logs"("entity_type");

-- CreateIndex
CREATE INDEX "audit_logs_occurred_at_idx" ON "audit_logs"("occurred_at");

-- AddForeignKey
ALTER TABLE "organization_units" ADD CONSTRAINT "organization_units_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_units" ADD CONSTRAINT "organization_units_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "organization_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_organization_membership_id_fkey" FOREIGN KEY ("organization_membership_id") REFERENCES "organization_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_profile_id_fkey" FOREIGN KEY ("actor_user_profile_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_membership_id_fkey" FOREIGN KEY ("actor_membership_id") REFERENCES "organization_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable row level security for tenant-scoped tables
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_units" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "membership_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

-- Create policies that require the application to set the current organization context.
CREATE POLICY "organizations_organization_isolation" ON "organizations"
    FOR ALL
    USING ("id"::text = current_setting('app.current_organization_id', true));

CREATE POLICY "organization_units_organization_isolation" ON "organization_units"
    FOR ALL
    USING ("organization_id"::text = current_setting('app.current_organization_id', true));

CREATE POLICY "user_profiles_organization_isolation" ON "user_profiles"
    FOR ALL
    USING (true);

CREATE POLICY "organization_memberships_organization_isolation" ON "organization_memberships"
    FOR ALL
    USING ("organization_id"::text = current_setting('app.current_organization_id', true));

CREATE POLICY "roles_organization_isolation" ON "roles"
    FOR ALL
    USING ("organization_id"::text = current_setting('app.current_organization_id', true));

CREATE POLICY "permissions_organization_isolation" ON "permissions"
    FOR ALL
    USING (true);

CREATE POLICY "role_permissions_organization_isolation" ON "role_permissions"
    FOR ALL
    USING ("organization_id"::text = current_setting('app.current_organization_id', true));

CREATE POLICY "membership_roles_organization_isolation" ON "membership_roles"
    FOR ALL
    USING ("organization_id"::text = current_setting('app.current_organization_id', true));

CREATE POLICY "audit_logs_organization_isolation" ON "audit_logs"
    FOR ALL
    USING ("organization_id"::text = current_setting('app.current_organization_id', true));

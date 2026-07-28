-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('short_text', 'long_text', 'number', 'currency', 'date', 'boolean', 'single_select', 'multi_select', 'file', 'document');

-- CreateEnum
CREATE TYPE "CustomFieldTargetScope" AS ENUM ('entity_type', 'role', 'module', 'institution');

-- CreateEnum
CREATE TYPE "CustomFieldStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "FieldRequirementScope" AS ENUM ('role', 'institution', 'entity_type', 'module');

-- CreateEnum
CREATE TYPE "FieldRequirementMode" AS ENUM ('hidden', 'optional', 'required', 'read_only');

-- CreateEnum
CREATE TYPE "RoleDefinitionStatus" AS ENUM ('active', 'inactive');

-- CreateTable
CREATE TABLE "custom_field_definitions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "help_text" TEXT,
    "field_type" "CustomFieldType" NOT NULL,
    "target_scope" "CustomFieldTargetScope" NOT NULL,
    "target_entity_type" "EntityType",
    "target_role_key" VARCHAR(100),
    "target_module_id" VARCHAR(100),
    "required" BOOLEAN NOT NULL DEFAULT false,
    "default_value" JSONB,
    "validation" JSONB,
    "options" JSONB,
    "show_in_list" BOOLEAN NOT NULL DEFAULT false,
    "show_in_detail" BOOLEAN NOT NULL DEFAULT true,
    "filterable" BOOLEAN NOT NULL DEFAULT false,
    "searchable" BOOLEAN NOT NULL DEFAULT false,
    "include_in_excel_export" BOOLEAN NOT NULL DEFAULT false,
    "include_in_excel_import" BOOLEAN NOT NULL DEFAULT false,
    "view_permission" VARCHAR(255),
    "edit_permission" VARCHAR(255),
    "order" INTEGER NOT NULL DEFAULT 0,
    "section" VARCHAR(100),
    "status" "CustomFieldStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_values" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "custom_field_definition_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_requirement_rules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "field_key" VARCHAR(100) NOT NULL,
    "scope" "FieldRequirementScope" NOT NULL,
    "target_id" VARCHAR(255) NOT NULL,
    "mode" "FieldRequirementMode" NOT NULL,
    "updated_by_user_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_requirement_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_definitions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "applicable_entity_types" "EntityType"[],
    "status" "RoleDefinitionStatus" NOT NULL DEFAULT 'active',
    "order" INTEGER NOT NULL DEFAULT 0,
    "icon" VARCHAR(100),
    "show_in_global_add_new" BOOLEAN NOT NULL DEFAULT false,
    "allow_multiple_assignments" BOOLEAN NOT NULL DEFAULT false,
    "supports_date_range" BOOLEAN NOT NULL DEFAULT true,
    "supports_billing_profile" BOOLEAN NOT NULL DEFAULT false,
    "required_permissions" JSONB NOT NULL DEFAULT '{}',
    "linked_custom_field_definition_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "role_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_field_definitions_organization_id_idx" ON "custom_field_definitions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_definitions_organization_id_key_key" ON "custom_field_definitions"("organization_id", "key");

-- CreateIndex
CREATE INDEX "custom_field_values_organization_id_idx" ON "custom_field_values"("organization_id");

-- CreateIndex
CREATE INDEX "custom_field_values_custom_field_definition_id_idx" ON "custom_field_values"("custom_field_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_values_entity_id_custom_field_definition_id_key" ON "custom_field_values"("entity_id", "custom_field_definition_id");

-- CreateIndex
CREATE INDEX "field_requirement_rules_organization_id_idx" ON "field_requirement_rules"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "field_requirement_rules_organization_id_field_key_scope_tar_key" ON "field_requirement_rules"("organization_id", "field_key", "scope", "target_id");

-- CreateIndex
CREATE INDEX "role_definitions_organization_id_idx" ON "role_definitions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_definitions_organization_id_key_key" ON "role_definitions"("organization_id", "key");

-- Note: no "person_profiles_organization_id_id_number_idx" statement here.
-- Prisma's shadow-database diff (this migration's autogeneration) does not
-- know that index already exists as a partial index (WHERE "id_number" IS
-- NOT NULL, added by hand in the 20260721090000 migration - schema.prisma's
-- plain @@index([organizationId, idNumber]) cannot express a partial index)
-- and would otherwise emit a second, non-partial CREATE INDEX with the same
-- name, which fails against the real dev database ("already exists").
-- Verified directly against the running dev database: the partial index is
-- already present and matches schema.prisma's intent exactly.

-- AddForeignKey
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_custom_field_definition_id_fkey" FOREIGN KEY ("custom_field_definition_id") REFERENCES "custom_field_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_requirement_rules" ADD CONSTRAINT "field_requirement_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_requirement_rules" ADD CONSTRAINT "field_requirement_rules_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_definitions" ADD CONSTRAINT "role_definitions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Note: no RenameIndex statements here. Prisma's shadow-database diff
-- proposed renaming "membership_roles_membership_role_unique" and
-- "role_permissions_org_role_permission_unique" to its own default naming
-- convention - but schema.prisma explicitly names both constraints via
-- @@unique(..., name: "...") and the real dev database already uses those
-- exact names (verified directly with pg_indexes). Applying the rename
-- would only create drift against schema.prisma's explicit names, not fix
-- any real difference.

-- Enable and force Row Level Security on every new table (P013B, matching
-- the P012/P013A precedent - FORCE is required from the start since the
-- application's Prisma connection is otherwise the table owner, which
-- silently bypasses RLS regardless of policy).
ALTER TABLE "custom_field_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "custom_field_definitions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "custom_field_definitions_organization_isolation" ON "custom_field_definitions"
    FOR ALL
    USING ("organization_id"::text = current_setting('app.current_organization_id', true));

ALTER TABLE "custom_field_values" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "custom_field_values" FORCE ROW LEVEL SECURITY;
CREATE POLICY "custom_field_values_organization_isolation" ON "custom_field_values"
    FOR ALL
    USING ("organization_id"::text = current_setting('app.current_organization_id', true));

ALTER TABLE "field_requirement_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "field_requirement_rules" FORCE ROW LEVEL SECURITY;
CREATE POLICY "field_requirement_rules_organization_isolation" ON "field_requirement_rules"
    FOR ALL
    USING ("organization_id"::text = current_setting('app.current_organization_id', true));

ALTER TABLE "role_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_definitions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "role_definitions_organization_isolation" ON "role_definitions"
    FOR ALL
    USING ("organization_id"::text = current_setting('app.current_organization_id', true));

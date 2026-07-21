-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('person', 'organization');
CREATE TYPE "EntityStatus" AS ENUM ('active', 'inactive', 'archived');
CREATE TYPE "PersonGender" AS ENUM ('male', 'female', 'unspecified');
CREATE TYPE "ContactMethodStatus" AS ENUM ('active', 'inactive');
CREATE TYPE "PhoneType" AS ENUM ('mobile', 'home', 'work', 'fax', 'other');
CREATE TYPE "EmailType" AS ENUM ('personal', 'work', 'billing', 'notifications', 'other');
CREATE TYPE "AddressType" AS ENUM ('home', 'work', 'billing', 'mailing', 'registered', 'other');
CREATE TYPE "RoleAssignmentStatus" AS ENUM ('active', 'ended');
CREATE TYPE "ListViewPreferenceScope" AS ENUM ('system', 'institution', 'role', 'user');

-- CreateTable
CREATE TABLE "entities" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "nera_id" VARCHAR(20) NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'active',
    "tags" TEXT[] NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_profiles" (
    "entity_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "first_name" VARCHAR(255) NOT NULL,
    "last_name" VARCHAR(255) NOT NULL,
    "id_number" VARCHAR(50),
    "birth_date_gregorian" DATE,
    "hebrew_date_adjustment_days" SMALLINT NOT NULL DEFAULT 0,
    "gender" "PersonGender" NOT NULL,
    "profile_image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "person_profiles_pkey" PRIMARY KEY ("entity_id"),
    CONSTRAINT "person_profiles_hebrew_date_adjustment_days_check" CHECK ("hebrew_date_adjustment_days" IN (-1, 0, 1))
);

-- CreateTable
CREATE TABLE "phones" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "type" "PhoneType" NOT NULL,
    "label" VARCHAR(255) NOT NULL DEFAULT '',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "status" "ContactMethodStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "verified_by_user_id" UUID,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emails" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "address" VARCHAR(320) NOT NULL,
    "type" "EmailType" NOT NULL,
    "label" VARCHAR(255) NOT NULL DEFAULT '',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "status" "ContactMethodStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "verified_by_user_id" UUID,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "country" VARCHAR(100),
    "city" VARCHAR(255),
    "city_provider_id" VARCHAR(255),
    "street" VARCHAR(255),
    "street_provider_id" VARCHAR(255),
    "house_number" VARCHAR(20),
    "entrance" VARCHAR(20),
    "floor" VARCHAR(20),
    "apartment" VARCHAR(20),
    "postal_code" VARCHAR(20),
    "type" "AddressType" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "status" "ContactMethodStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "verified_by_user_id" UUID,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- No note_revisions table (Owner-approved P013A design review): audit_logs
-- remains the only historical record of a note's prior content. edited_at is
-- a lightweight signal only, preserving the existing "edited" UI indicator.
CREATE TABLE "notes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_user_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "edited_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "deleted_by_user_id" UUID,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- "role" is a plain, application-validated string key (RoleDefinition is not
-- persisted - see roles.ts); uniqueness beyond "one active assignment unless
-- the role allows multiple" is an application-layer invariant (canAssignRole),
-- not expressible as a DB constraint here.
CREATE TABLE "role_assignments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "role" VARCHAR(100) NOT NULL,
    "status" "RoleAssignmentStatus" NOT NULL DEFAULT 'active',
    "start_date" DATE,
    "end_date" DATE,
    "notes" TEXT,
    "module_profile_ref" VARCHAR(255),
    "assigned_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMP(3),

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- matched_entity_ids is a plain UUID array snapshot, not a live FK - an
-- intentional point-in-time record, unaffected by a later archive/delete of
-- a matched entity.
CREATE TABLE "duplicate_override_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "matched_entity_ids" UUID[] NOT NULL,
    "match_reasons" TEXT[] NOT NULL,
    "override_reason" TEXT NOT NULL,
    "decided_by_user_id" UUID NOT NULL,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "duplicate_override_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- target_id is heterogeneous by design (UserProfile.id / role key string /
-- Institution.id / NULL for 'system' scope) - see the two partial unique
-- indexes below for how "one row per scope/target/screen" is enforced.
CREATE TABLE "list_view_column_preferences" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "scope" "ListViewPreferenceScope" NOT NULL,
    "target_id" VARCHAR(255),
    "screen_id" VARCHAR(100) NOT NULL,
    "visible_column_keys" TEXT[] NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "list_view_column_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entities_organization_id_nera_id_key" ON "entities"("organization_id", "nera_id");
CREATE INDEX "entities_organization_id_idx" ON "entities"("organization_id");
CREATE INDEX "entities_organization_id_status_idx" ON "entities"("organization_id", "status");
CREATE INDEX "entities_organization_id_entity_type_idx" ON "entities"("organization_id", "entity_type");

CREATE INDEX "person_profiles_organization_id_idx" ON "person_profiles"("organization_id");
CREATE INDEX "person_profiles_organization_id_id_number_idx" ON "person_profiles"("organization_id", "id_number") WHERE "id_number" IS NOT NULL;

CREATE INDEX "phones_organization_id_idx" ON "phones"("organization_id");
CREATE INDEX "phones_entity_id_idx" ON "phones"("entity_id");
CREATE INDEX "phones_entity_id_status_idx" ON "phones"("entity_id", "status");
CREATE UNIQUE INDEX "phones_one_primary_active_per_entity" ON "phones"("entity_id")
    WHERE "is_primary" = true AND "status" = 'active' AND "deleted_at" IS NULL;

CREATE INDEX "emails_organization_id_idx" ON "emails"("organization_id");
CREATE INDEX "emails_entity_id_idx" ON "emails"("entity_id");
CREATE INDEX "emails_entity_id_status_idx" ON "emails"("entity_id", "status");
CREATE UNIQUE INDEX "emails_one_primary_active_per_entity" ON "emails"("entity_id")
    WHERE "is_primary" = true AND "status" = 'active' AND "deleted_at" IS NULL;

CREATE INDEX "addresses_organization_id_idx" ON "addresses"("organization_id");
CREATE INDEX "addresses_entity_id_idx" ON "addresses"("entity_id");
CREATE INDEX "addresses_entity_id_status_idx" ON "addresses"("entity_id", "status");
CREATE UNIQUE INDEX "addresses_one_primary_active_per_entity" ON "addresses"("entity_id")
    WHERE "is_primary" = true AND "status" = 'active' AND "deleted_at" IS NULL;

CREATE INDEX "notes_organization_id_idx" ON "notes"("organization_id");
CREATE INDEX "notes_entity_id_idx" ON "notes"("entity_id");
CREATE INDEX "notes_entity_id_deleted_at_idx" ON "notes"("entity_id", "deleted_at");

CREATE INDEX "role_assignments_organization_id_entity_id_idx" ON "role_assignments"("organization_id", "entity_id");
CREATE INDEX "role_assignments_organization_id_role_idx" ON "role_assignments"("organization_id", "role");

CREATE INDEX "duplicate_override_records_organization_id_entity_id_idx" ON "duplicate_override_records"("organization_id", "entity_id");

CREATE INDEX "list_view_column_preferences_organization_id_idx" ON "list_view_column_preferences"("organization_id");
CREATE UNIQUE INDEX "list_view_prefs_scoped_unique" ON "list_view_column_preferences"("organization_id", "scope", "target_id", "screen_id")
    WHERE "scope" != 'system';
CREATE UNIQUE INDEX "list_view_prefs_system_unique" ON "list_view_column_preferences"("organization_id", "screen_id")
    WHERE "scope" = 'system';

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "person_profiles" ADD CONSTRAINT "person_profiles_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "phones" ADD CONSTRAINT "phones_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "phones" ADD CONSTRAINT "phones_verified_by_user_id_fkey" FOREIGN KEY ("verified_by_user_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "phones" ADD CONSTRAINT "phones_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by_user_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "emails" ADD CONSTRAINT "emails_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "emails" ADD CONSTRAINT "emails_verified_by_user_id_fkey" FOREIGN KEY ("verified_by_user_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "emails" ADD CONSTRAINT "emails_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by_user_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "addresses" ADD CONSTRAINT "addresses_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_verified_by_user_id_fkey" FOREIGN KEY ("verified_by_user_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by_user_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notes" ADD CONSTRAINT "notes_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notes" ADD CONSTRAINT "notes_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notes" ADD CONSTRAINT "notes_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notes" ADD CONSTRAINT "notes_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by_user_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "duplicate_override_records" ADD CONSTRAINT "duplicate_override_records_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "duplicate_override_records" ADD CONSTRAINT "duplicate_override_records_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "list_view_column_preferences" ADD CONSTRAINT "list_view_column_preferences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable and force Row Level Security on every new table (P013A, matching
-- the P012 precedent - FORCE is required from the start since the
-- application's Prisma connection is otherwise the table owner, which
-- silently bypasses RLS regardless of policy).
ALTER TABLE "entities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "entities" FORCE ROW LEVEL SECURITY;
CREATE POLICY "entities_organization_isolation" ON "entities"
    FOR ALL
    USING ("organization_id"::text = current_setting('app.current_organization_id', true));

ALTER TABLE "person_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "person_profiles" FORCE ROW LEVEL SECURITY;
CREATE POLICY "person_profiles_organization_isolation" ON "person_profiles"
    FOR ALL
    USING ("organization_id"::text = current_setting('app.current_organization_id', true));

ALTER TABLE "phones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "phones" FORCE ROW LEVEL SECURITY;
CREATE POLICY "phones_organization_isolation" ON "phones"
    FOR ALL
    USING ("organization_id"::text = current_setting('app.current_organization_id', true));

ALTER TABLE "emails" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "emails" FORCE ROW LEVEL SECURITY;
CREATE POLICY "emails_organization_isolation" ON "emails"
    FOR ALL
    USING ("organization_id"::text = current_setting('app.current_organization_id', true));

ALTER TABLE "addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "addresses" FORCE ROW LEVEL SECURITY;
CREATE POLICY "addresses_organization_isolation" ON "addresses"
    FOR ALL
    USING ("organization_id"::text = current_setting('app.current_organization_id', true));

ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "notes_organization_isolation" ON "notes"
    FOR ALL
    USING ("organization_id"::text = current_setting('app.current_organization_id', true));

ALTER TABLE "role_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_assignments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "role_assignments_organization_isolation" ON "role_assignments"
    FOR ALL
    USING ("organization_id"::text = current_setting('app.current_organization_id', true));

ALTER TABLE "duplicate_override_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "duplicate_override_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY "duplicate_override_records_organization_isolation" ON "duplicate_override_records"
    FOR ALL
    USING ("organization_id"::text = current_setting('app.current_organization_id', true));

ALTER TABLE "list_view_column_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "list_view_column_preferences" FORCE ROW LEVEL SECURITY;
CREATE POLICY "list_view_column_preferences_organization_isolation" ON "list_view_column_preferences"
    FOR ALL
    USING ("organization_id"::text = current_setting('app.current_organization_id', true));

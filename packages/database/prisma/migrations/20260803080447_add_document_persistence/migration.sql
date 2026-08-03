-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('uploading', 'available', 'failed');

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'uploading',
    "storage_key" VARCHAR(512) NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "content_type" VARCHAR(127) NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "checksum_sha256" VARCHAR(64) NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "deleted_by_user_id" UUID,
    "purged_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "purged_at" TIMESTAMP(3),
    "reconciled_at" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_links" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "target_record_type" VARCHAR(100) NOT NULL,
    "target_record_id" UUID NOT NULL,
    "linked_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_user_id" UUID,

    CONSTRAINT "document_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documents_storage_key_key" ON "documents"("storage_key");

-- CreateIndex
CREATE INDEX "documents_organization_id_idx" ON "documents"("organization_id");

-- CreateIndex
CREATE INDEX "documents_status_reconciled_at_idx" ON "documents"("status", "reconciled_at");

-- CreateIndex
CREATE INDEX "document_links_document_id_target_record_type_target_record_idx" ON "document_links"("document_id", "target_record_type", "target_record_id");

-- CreateIndex
CREATE INDEX "document_links_organization_id_idx" ON "document_links"("organization_id");

-- CreateIndex
CREATE INDEX "document_links_target_record_type_target_record_id_idx" ON "document_links"("target_record_type", "target_record_id");

-- Note: no re-creation of "person_profiles_organization_id_id_number_idx" here.
-- Prisma's shadow-database diff proposes this every time a new migration
-- touches this schema (documented in the P013B migration's own lessons
-- learned and its sprint closing report): the shadow DB doesn't know about
-- the partial index (`WHERE id_number IS NOT NULL`) added by hand in the
-- P013A migration, so it proposes a duplicate, non-partial index with the
-- same name. The real dev database already has the correct partial index
-- (verified directly with pg_indexes) - applying this would fail with
-- "already exists" (confirmed: this is exactly the P3006 error `prisma
-- migrate dev --create-only` raised before this line was removed).

-- Note: no RenameIndex statements here either, for the same reason recorded
-- in the P013B migration: Prisma's shadow-database diff proposed renaming
-- "membership_roles_membership_role_unique" and
-- "role_permissions_org_role_permission_unique" to its own default naming
-- convention - but schema.prisma explicitly names both constraints via
-- @@unique(..., name: "...") and the real dev database already uses those
-- exact names (verified directly with pg_indexes); `seed.ts` also
-- references them by these exact names in its `upsert` `where` clauses, so
-- renaming them would break the seed script. Applying the rename would only
-- create drift, not fix any real difference.

-- Duplicate-active-link prevention (ADR-013 Decision item D; schema.prisma's
-- DocumentLink doc comment): a partial unique index, not expressible in
-- schema.prisma alone (Prisma has no partial-unique-index syntax) - added by
-- hand, matching the person_profiles precedent above. Excludes soft-deleted
-- rows so the same document can be re-linked to the same target record
-- after a prior link was removed.
CREATE UNIQUE INDEX "document_links_document_target_active_unique" ON "document_links"("document_id", "target_record_type", "target_record_id") WHERE "deleted_at" IS NULL;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by_user_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_purged_by_user_id_fkey" FOREIGN KEY ("purged_by_user_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by_user_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable and force Row Level Security on both new tables (P014, matching the
-- P012/P013A/P013B precedent - FORCE is required from the start since the
-- application's admin Prisma connection is otherwise the table owner, which
-- silently bypasses RLS regardless of policy).
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents" FORCE ROW LEVEL SECURITY;
CREATE POLICY "documents_organization_isolation" ON "documents"
    FOR ALL
    USING ("organization_id"::text = current_setting('app.current_organization_id', true));

ALTER TABLE "document_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_links" FORCE ROW LEVEL SECURITY;
CREATE POLICY "document_links_organization_isolation" ON "document_links"
    FOR ALL
    USING ("organization_id"::text = current_setting('app.current_organization_id', true));

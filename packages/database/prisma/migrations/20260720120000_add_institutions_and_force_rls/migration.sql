-- CreateTable
CREATE TABLE "institutions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "institutions_organization_id_idx" ON "institutions"("organization_id");

-- AddForeignKey
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable and force row level security on the new table (P012 - see
-- docs/ROADMAP.md). FORCE is required from the start here, unlike the P004
-- migration: without it, the table owner - which is what the application's
-- Prisma connection is, absent a separate least-privilege production role -
-- would silently bypass this policy regardless of organization_id.
ALTER TABLE "institutions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "institutions" FORCE ROW LEVEL SECURITY;

CREATE POLICY "institutions_organization_isolation" ON "institutions"
    FOR ALL
    USING ("organization_id"::text = current_setting('app.current_organization_id', true));

-- Retrofit: force row level security on every table that already had RLS
-- enabled (but not forced) since the P004 migration. Enabling RLS alone left
-- these policies dormant for the table owner, which is the only role that
-- has ever connected to this database so far - see docs/ROADMAP.md Section
-- 9.4-adjacent P012 findings. Not applied to "user_profiles" or
-- "permissions": both already carry a USING (true) policy (global identity /
-- global catalog, by design, per ADR-002), so FORCE would change no
-- observable behavior there.
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;
ALTER TABLE "organization_units" FORCE ROW LEVEL SECURITY;
ALTER TABLE "organization_memberships" FORCE ROW LEVEL SECURITY;
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "membership_roles" FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;

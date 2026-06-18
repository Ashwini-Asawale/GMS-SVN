-- Multitenancy: tenants table + tenant_id on core models

CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

INSERT INTO "tenants" ("id", "slug", "name", "is_active", "created_at", "updated_at")
VALUES ('00000000-0000-0000-0000-000000000001', 'default', 'Default Organization', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE "users" ADD COLUMN "tenant_id" TEXT;
UPDATE "users" SET "tenant_id" = '00000000-0000-0000-0000-000000000001';
ALTER TABLE "users" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "groups" ADD COLUMN "tenant_id" TEXT;
UPDATE "groups" SET "tenant_id" = '00000000-0000-0000-0000-000000000001';
ALTER TABLE "groups" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "repositories" ADD COLUMN "tenant_id" TEXT;
UPDATE "repositories" SET "tenant_id" = '00000000-0000-0000-0000-000000000001';
ALTER TABLE "repositories" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "platform_settings" ADD COLUMN "tenant_id" TEXT;
UPDATE "platform_settings" SET "tenant_id" = '00000000-0000-0000-0000-000000000001';
ALTER TABLE "platform_settings" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "audit_logs" ADD COLUMN "tenant_id" TEXT;
UPDATE "audit_logs" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

DROP INDEX IF EXISTS "users_username_key";
DROP INDEX IF EXISTS "users_email_key";
DROP INDEX IF EXISTS "groups_name_key";
DROP INDEX IF EXISTS "repositories_name_key";
DROP INDEX IF EXISTS "repositories_slug_key";
DROP INDEX IF EXISTS "platform_settings_key_key";

CREATE UNIQUE INDEX "users_tenant_id_username_key" ON "users"("tenant_id", "username");
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");
CREATE UNIQUE INDEX "groups_tenant_id_name_key" ON "groups"("tenant_id", "name");
CREATE UNIQUE INDEX "repositories_tenant_id_name_key" ON "repositories"("tenant_id", "name");
CREATE UNIQUE INDEX "repositories_tenant_id_slug_key" ON "repositories"("tenant_id", "slug");
CREATE UNIQUE INDEX "platform_settings_tenant_id_key_key" ON "platform_settings"("tenant_id", "key");

CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");
CREATE INDEX "groups_tenant_id_idx" ON "groups"("tenant_id");
CREATE INDEX "repositories_tenant_id_idx" ON "repositories"("tenant_id");
CREATE INDEX "platform_settings_tenant_id_idx" ON "platform_settings"("tenant_id");
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");

ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "groups" ADD CONSTRAINT "groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

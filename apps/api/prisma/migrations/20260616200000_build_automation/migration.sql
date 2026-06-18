-- Phase 9: Build automation pipeline config and build history

CREATE TYPE "BuildStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED');

CREATE TABLE "repo_pipeline_configs" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "webhook_url" TEXT,
    "webhook_secret" TEXT,
    "trigger_paths" TEXT[] DEFAULT ARRAY['/trunk']::TEXT[],
    "trigger_branches" TEXT[] DEFAULT ARRAY['trunk']::TEXT[],
    "hook_installed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repo_pipeline_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pipeline_builds" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "config_id" TEXT,
    "revision" INTEGER NOT NULL,
    "status" "BuildStatus" NOT NULL DEFAULT 'QUEUED',
    "duration_ms" INTEGER,
    "log_url" TEXT,
    "external_build_id" TEXT,
    "error_message" TEXT,
    "changed_paths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "author" TEXT,
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "idempotency_key" TEXT NOT NULL,

    CONSTRAINT "pipeline_builds_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "repo_pipeline_configs_repository_id_key" ON "repo_pipeline_configs"("repository_id");
CREATE UNIQUE INDEX "pipeline_builds_idempotency_key_key" ON "pipeline_builds"("idempotency_key");
CREATE UNIQUE INDEX "pipeline_builds_repository_id_revision_key" ON "pipeline_builds"("repository_id", "revision");
CREATE INDEX "pipeline_builds_repository_id_triggered_at_idx" ON "pipeline_builds"("repository_id", "triggered_at");
CREATE INDEX "pipeline_builds_status_idx" ON "pipeline_builds"("status");

ALTER TABLE "repo_pipeline_configs" ADD CONSTRAINT "repo_pipeline_configs_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pipeline_builds" ADD CONSTRAINT "pipeline_builds_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pipeline_builds" ADD CONSTRAINT "pipeline_builds_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "repo_pipeline_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('READ', 'WRITE', 'NONE');
CREATE TYPE "PrincipalType" AS ENUM ('USER', 'GROUP');

-- CreateTable
CREATE TABLE "repo_access_rules" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "principal_type" "PrincipalType" NOT NULL,
    "principal_name" TEXT NOT NULL,
    "access" "AccessLevel" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repo_access_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "repo_access_rules_repository_id_idx" ON "repo_access_rules"("repository_id");

-- CreateIndex
CREATE UNIQUE INDEX "repo_access_rules_repository_id_path_principal_type_princip_key" ON "repo_access_rules"("repository_id", "path", "principal_type", "principal_name");

-- AddForeignKey
ALTER TABLE "repo_access_rules" ADD CONSTRAINT "repo_access_rules_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

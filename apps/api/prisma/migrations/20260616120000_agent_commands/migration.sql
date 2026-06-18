-- CreateEnum
CREATE TYPE "AgentCommandStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "agent_commands" (
    "id" TEXT NOT NULL,
    "command_type" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "AgentCommandStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "repository_id" TEXT,
    "requested_by_id" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_commands_idempotency_key_key" ON "agent_commands"("idempotency_key");

-- CreateIndex
CREATE INDEX "agent_commands_status_idx" ON "agent_commands"("status");

-- CreateIndex
CREATE INDEX "agent_commands_correlation_id_idx" ON "agent_commands"("correlation_id");

-- CreateIndex
CREATE INDEX "agent_commands_created_at_idx" ON "agent_commands"("created_at");

-- AddForeignKey
ALTER TABLE "agent_commands" ADD CONSTRAINT "agent_commands_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

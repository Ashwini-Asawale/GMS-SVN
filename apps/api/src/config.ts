export interface AppConfig {
  host: string;
  port: number;
  corsOrigins: string[];
  databaseUrl?: string;
  redisUrl?: string;
  agentBaseUrl: string;
  agentHmacSecret: string;
  agentMock: boolean;
  pipelineHookSecret: string;
  apiPublicUrl: string;
}

export function loadConfig(): AppConfig {
  const port = Number(process.env.API_PORT ?? 3001);
  const host = process.env.API_HOST ?? '0.0.0.0';
  const corsRaw = process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:5175';
  const corsOrigins = corsRaw.split(',').map((o) => o.trim()).filter(Boolean);
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;
  const agentBaseUrl = process.env.AGENT_BASE_URL ?? 'http://localhost:8443';
  const agentHmacSecret = process.env.AGENT_HMAC_SECRET ?? 'change-me-agent-hmac-secret-min-32-chars';
  const agentMock = process.env.AGENT_MOCK === 'true';
  const pipelineHookSecret =
    process.env.PIPELINE_HOOK_SECRET ?? process.env.AGENT_HMAC_SECRET ?? 'change-me-pipeline-hook-secret';
  const apiPublicUrl = process.env.API_PUBLIC_URL ?? `http://localhost:${port}`;

  return {
    host,
    port,
    corsOrigins,
    databaseUrl,
    redisUrl,
    agentBaseUrl,
    agentHmacSecret,
    agentMock,
    pipelineHookSecret,
    apiPublicUrl,
  };
}

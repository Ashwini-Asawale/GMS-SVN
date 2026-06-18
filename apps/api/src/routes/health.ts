import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { PRODUCT_NAMES } from '@gms-svn/shared';

let prisma: PrismaClient | null = null;

function getPrisma(): PrismaClient | null {
  if (!process.env.DATABASE_URL) return null;
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    let dbStatus: 'ok' | 'error' | 'not_configured' = 'not_configured';
    const client = getPrisma();

    if (client) {
      try {
        await client.$queryRaw`SELECT 1`;
        dbStatus = 'ok';
      } catch {
        dbStatus = 'error';
      }
    }

    return {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      service: PRODUCT_NAMES.webAdmin,
      server: PRODUCT_NAMES.server,
      client: PRODUCT_NAMES.client,
      phase: 9,
      checks: { database: dbStatus },
      timestamp: new Date().toISOString(),
    };
  });
}

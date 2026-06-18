import type { FastifyInstance } from 'fastify';
import { updateSettingsSchema } from '../schemas/index.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { getPlatformSettings, upsertPlatformSettings } from '../lib/platform-settings.js';
import { runStorageConnectionTest } from '../services/storage-connection-test.js';
import { writeAuditLog } from '../lib/audit.js';
import { tenantIdFromRequest } from '../lib/tenant.js';

export async function settingsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', requireAdmin);

  app.get('/settings', async (request) => getPlatformSettings(tenantIdFromRequest(request)));

  app.put('/settings', async (request, reply) => {
    const tenantId = tenantIdFromRequest(request);
    const parsed = updateSettingsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const settings = await upsertPlatformSettings(tenantId, parsed.data);

    await writeAuditLog({
      action: 'settings.updated',
      tenantId,
      userId: request.user!.sub,
      metadata: { keys: Object.keys(parsed.data) },
      sourceIp: request.ip,
    });

    return settings;
  });

  app.post('/settings/test-connection', async (request) => {
    const tenantId = tenantIdFromRequest(request);
    const settings = await getPlatformSettings(tenantId);
    const result = await runStorageConnectionTest(settings);

    await writeAuditLog({
      action: 'settings.connection_test',
      tenantId,
      userId: request.user!.sub,
      metadata: { overall: result.overall, testedFrom: result.testedFrom },
      sourceIp: request.ip,
    });

    return result;
  });
}

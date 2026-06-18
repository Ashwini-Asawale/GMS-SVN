import type { FastifyInstance } from 'fastify';

import { updateSettingsSchema } from '../schemas/index.js';

import { authenticate, requireAdmin } from '../middleware/auth.js';

import { getPlatformSettings, upsertPlatformSettings } from '../lib/platform-settings.js';

import { runStorageConnectionTest } from '../services/storage-connection-test.js';

import { writeAuditLog } from '../lib/audit.js';



export async function settingsRoutes(app: FastifyInstance) {

  app.addHook('preHandler', authenticate);

  app.addHook('preHandler', requireAdmin);



  app.get('/settings', async () => getPlatformSettings());



  app.put('/settings', async (request, reply) => {

    const parsed = updateSettingsSchema.safeParse(request.body);

    if (!parsed.success) {

      return reply.status(400).send({ error: parsed.error.flatten() });

    }



    const settings = await upsertPlatformSettings(parsed.data);



    await writeAuditLog({

      action: 'settings.updated',

      userId: request.user!.sub,

      metadata: { keys: Object.keys(parsed.data) },

      sourceIp: request.ip,

    });



    return settings;

  });



  app.post('/settings/test-connection', async (request) => {

    const settings = await getPlatformSettings();

    const result = await runStorageConnectionTest(settings);



    await writeAuditLog({

      action: 'settings.connection_test',

      userId: request.user!.sub,

      metadata: { overall: result.overall, testedFrom: result.testedFrom },

      sourceIp: request.ip,

    });



    return result;

  });

}



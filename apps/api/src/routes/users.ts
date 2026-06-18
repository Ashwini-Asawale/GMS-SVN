import type { FastifyInstance } from 'fastify';
import { createUserSchema, updateUserSchema } from '../schemas/index.js';
import { prisma, userSelect } from '../lib/prisma.js';
import { hashPassword } from '../lib/auth.js';
import { getClientIp, writeAuditLog } from '../lib/audit.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { resolveSvnRepoRoot, upsertSvnPasswdUser, removeSvnPasswdUser } from '../services/svn-passwd-sync.js';

export async function userRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', requireAdmin);

  app.get('/users', async () => {
    const users = await prisma.user.findMany({
      select: {
        ...userSelect(),
        groupMembers: {
          select: { group: { select: { id: true, name: true } } },
        },
      },
      orderBy: { username: 'asc' },
    });

    return users.map((u) => ({
      ...u,
      groups: u.groupMembers.map((m) => m.group),
      groupMembers: undefined,
    }));
  });

  app.post('/users', async (request, reply) => {
    const parsed = createUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { username, email, password, isAdmin } = parsed.data;
    const passwordHash = await hashPassword(password);

    try {
      const user = await prisma.user.create({
        data: { username, email, passwordHash, isAdmin },
        select: userSelect(),
      });

      await writeAuditLog({
        action: 'user.created',
        userId: request.user!.sub,
        metadata: { targetUserId: user.id, username },
        sourceIp: getClientIp(request.headers),
      });

      try {
        upsertSvnPasswdUser(resolveSvnRepoRoot(), username, password);
      } catch {
        // non-fatal when repo root unavailable
      }

      return reply.status(201).send(user);
    } catch {
      return reply.status(409).send({ error: 'Username or email already exists' });
    }
  });

  app.patch('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.email !== undefined) data.email = parsed.data.email;
    if (parsed.data.isAdmin !== undefined) data.isAdmin = parsed.data.isAdmin;
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
    if (parsed.data.password) data.passwordHash = await hashPassword(parsed.data.password);

    try {
      const user = await prisma.user.update({
        where: { id },
        data,
        select: userSelect(),
      });

      await writeAuditLog({
        action: parsed.data.isActive === false ? 'user.disabled' : 'user.updated',
        userId: request.user!.sub,
        metadata: { targetUserId: id, changes: Object.keys(parsed.data) },
        sourceIp: getClientIp(request.headers),
      });

      try {
        const repoRoot = resolveSvnRepoRoot();
        if (parsed.data.password) {
          upsertSvnPasswdUser(repoRoot, user.username, parsed.data.password);
        }
        if (parsed.data.isActive === false) {
          removeSvnPasswdUser(repoRoot, user.username);
        }
      } catch {
        // non-fatal
      }

      return user;
    } catch {
      return reply.status(404).send({ error: 'User not found' });
    }
  });
}

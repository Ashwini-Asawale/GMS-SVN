import type { FastifyInstance } from 'fastify';
import {
  addGroupMemberSchema,
  createGroupSchema,
  updateGroupSchema,
} from '../schemas/index.js';
import { prisma } from '../lib/prisma.js';
import { getClientIp, writeAuditLog } from '../lib/audit.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { tenantIdFromRequest } from '../lib/tenant.js';

function groupWithMembers() {
  return {
    id: true,
    name: true,
    description: true,
    createdAt: true,
    updatedAt: true,
    members: {
      select: {
        id: true,
        createdAt: true,
        user: { select: { id: true, username: true, email: true, isActive: true } },
      },
    },
  } as const;
}

export async function groupRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', requireAdmin);

  app.get('/groups', async (request) => {
    const tenantId = tenantIdFromRequest(request);
    return prisma.group.findMany({
      where: { tenantId },
      select: groupWithMembers(),
      orderBy: { name: 'asc' },
    });
  });

  app.post('/groups', async (request, reply) => {
    const tenantId = tenantIdFromRequest(request);
    const parsed = createGroupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const group = await prisma.group.create({
        data: { tenantId, ...parsed.data },
        select: groupWithMembers(),
      });

      await writeAuditLog({
        action: 'group.created',
        tenantId,
        userId: request.user!.sub,
        metadata: { groupId: group.id, name: group.name },
        sourceIp: getClientIp(request.headers),
      });

      return reply.status(201).send(group);
    } catch {
      return reply.status(409).send({ error: 'Group name already exists' });
    }
  });

  app.patch('/groups/:id', async (request, reply) => {
    const tenantId = tenantIdFromRequest(request);
    const { id } = request.params as { id: string };
    const parsed = updateGroupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const existing = await prisma.group.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return reply.status(404).send({ error: 'Group not found' });
    }

    try {
      const group = await prisma.group.update({
        where: { id },
        data: parsed.data,
        select: groupWithMembers(),
      });

      await writeAuditLog({
        action: 'group.updated',
        tenantId,
        userId: request.user!.sub,
        metadata: { groupId: id },
        sourceIp: getClientIp(request.headers),
      });

      return group;
    } catch {
      return reply.status(404).send({ error: 'Group not found' });
    }
  });

  app.delete('/groups/:id', async (request, reply) => {
    const tenantId = tenantIdFromRequest(request);
    const { id } = request.params as { id: string };

    const existing = await prisma.group.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return reply.status(404).send({ error: 'Group not found' });
    }

    try {
      await prisma.group.delete({ where: { id } });
      await writeAuditLog({
        action: 'group.deleted',
        tenantId,
        userId: request.user!.sub,
        metadata: { groupId: id },
        sourceIp: getClientIp(request.headers),
      });
      return reply.status(204).send();
    } catch {
      return reply.status(404).send({ error: 'Group not found' });
    }
  });

  app.post('/groups/:id/members', async (request, reply) => {
    const tenantId = tenantIdFromRequest(request);
    const { id: groupId } = request.params as { id: string };
    const parsed = addGroupMemberSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const group = await prisma.group.findFirst({ where: { id: groupId, tenantId } });
    if (!group) {
      return reply.status(404).send({ error: 'Group not found' });
    }

    const member = await prisma.user.findFirst({
      where: { id: parsed.data.userId, tenantId },
    });
    if (!member) {
      return reply.status(400).send({ error: 'User not found in this organization' });
    }

    try {
      await prisma.groupMember.create({
        data: { groupId, userId: parsed.data.userId },
      });

      await writeAuditLog({
        action: 'group.member_added',
        tenantId,
        userId: request.user!.sub,
        metadata: { groupId, memberUserId: parsed.data.userId },
        sourceIp: getClientIp(request.headers),
      });

      const updated = await prisma.group.findUnique({
        where: { id: groupId },
        select: groupWithMembers(),
      });

      return reply.status(201).send(updated);
    } catch {
      return reply.status(409).send({ error: 'User already in group or invalid reference' });
    }
  });

  app.delete('/groups/:id/members/:userId', async (request, reply) => {
    const tenantId = tenantIdFromRequest(request);
    const { id: groupId, userId } = request.params as { id: string; userId: string };

    const group = await prisma.group.findFirst({ where: { id: groupId, tenantId } });
    if (!group) {
      return reply.status(404).send({ error: 'Group not found' });
    }

    try {
      await prisma.groupMember.delete({
        where: { userId_groupId: { userId, groupId } },
      });

      await writeAuditLog({
        action: 'group.member_removed',
        tenantId,
        userId: request.user!.sub,
        metadata: { groupId, memberUserId: userId },
        sourceIp: getClientIp(request.headers),
      });

      return reply.status(204).send();
    } catch {
      return reply.status(404).send({ error: 'Membership not found' });
    }
  });
}

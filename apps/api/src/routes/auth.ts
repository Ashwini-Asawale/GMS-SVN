import type { FastifyInstance } from 'fastify';
import { loginSchema } from '../schemas/index.js';
import { prisma, userSelect } from '../lib/prisma.js';
import {
  hashToken,
  refreshTokenExpiresAt,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
  verifyRefreshToken,
} from '../lib/auth.js';
import { getClientIp, writeAuditLog } from '../lib/audit.js';
import { authenticate } from '../middleware/auth.js';
import { resolveSvnRepoRoot, upsertSvnPasswdUser } from '../services/svn-passwd-sync.js';
import { findUserByLoginIdentifier } from '../lib/login-user.js';
import { DEFAULT_TENANT_SLUG, findTenantBySlug } from '../lib/tenant.js';
import { getPlatformSettings } from '../lib/platform-settings.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid email or password' });
    }

    const { email, username, password } = parsed.data;
    const tenantSlug = parsed.data.tenantSlug?.trim().toLowerCase() || DEFAULT_TENANT_SLUG;
    const tenant = await findTenantBySlug(tenantSlug);
    const loginLabel = email?.trim() || username?.trim() || '';
    const ip = getClientIp(request.headers);

    if (!tenant) {
      await writeAuditLog({
        action: 'auth.login_failed',
        metadata: { email: loginLabel, tenantSlug },
        sourceIp: ip,
      });
      return reply.status(401).send({ error: 'Invalid organization or credentials' });
    }

    const user = await findUserByLoginIdentifier(tenant.id, email, username);

    if (!user || !user.isActive) {
      await writeAuditLog({
        action: 'auth.login_failed',
        tenantId: tenant.id,
        metadata: { email: loginLabel, tenantSlug },
        sourceIp: ip,
      });
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await writeAuditLog({
        action: 'auth.login_failed',
        tenantId: tenant.id,
        userId: user.id,
        metadata: { email: user.email, username: user.username, tenantSlug },
        sourceIp: ip,
      });
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const payload = {
      sub: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
    };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshTokenExpiresAt(),
      },
    });

    await writeAuditLog({
      action: 'auth.login',
      tenantId: tenant.id,
      userId: user.id,
      sourceIp: ip,
    });

    try {
      const settings = await getPlatformSettings(tenant.id);
      upsertSvnPasswdUser(resolveSvnRepoRoot(settings.visualsvnRepoRoot), user.username, password);
    } catch (err) {
      request.log.warn({ err }, 'SVN passwd sync failed on login');
    }

    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        ...userSelect(),
        tenant: { select: { id: true, slug: true, name: true } },
      },
    });

    return {
      accessToken,
      refreshToken,
      user: userRecord,
    };
  });

  app.post('/auth/refresh', async (request, reply) => {
    const body = request.body as { refreshToken?: string };
    if (!body?.refreshToken) {
      return reply.status(400).send({ error: 'refreshToken required' });
    }

    try {
      const payload = verifyRefreshToken(body.refreshToken);
      const tokenHash = hashToken(body.refreshToken);
      const stored = await prisma.refreshToken.findFirst({
        where: { userId: payload.sub, tokenHash, expiresAt: { gt: new Date() } },
      });

      if (!stored) {
        return reply.status(401).send({ error: 'Invalid refresh token' });
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        include: { tenant: { select: { id: true, slug: true, isActive: true } } },
      });
      if (!user || !user.isActive || !user.tenant.isActive) {
        return reply.status(401).send({ error: 'User inactive' });
      }

      const newPayload = {
        sub: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
        tenantId: user.tenant.id,
        tenantSlug: user.tenant.slug,
      };
      return { accessToken: signAccessToken(newPayload) };
    } catch {
      return reply.status(401).send({ error: 'Invalid refresh token' });
    }
  });

  app.post('/auth/logout', { preHandler: authenticate }, async (request, reply) => {
    const body = request.body as { refreshToken?: string };
    if (body?.refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { tokenHash: hashToken(body.refreshToken) },
      });
    }

    await writeAuditLog({
      action: 'auth.logout',
      tenantId: request.user!.tenantId,
      userId: request.user!.sub,
      sourceIp: getClientIp(request.headers),
    });

    return reply.status(204).send();
  });

  app.get('/auth/me', { preHandler: authenticate }, async (request, reply) => {
    const user = await prisma.user.findFirst({
      where: { id: request.user!.sub, tenantId: request.user!.tenantId },
      select: {
        ...userSelect(),
        tenant: { select: { id: true, slug: true, name: true } },
        groupMembers: {
          select: {
            group: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return {
      ...user,
      groups: user.groupMembers.map((m) => m.group),
      groupMembers: undefined,
    };
  });
}

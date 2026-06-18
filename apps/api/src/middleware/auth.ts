import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken, type JwtPayload } from '../lib/auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  try {
    const token = header.slice(7);
    request.user = verifyAccessToken(token);
  } catch {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user?.isAdmin) {
    return reply.status(403).send({ error: 'Admin access required' });
  }
}

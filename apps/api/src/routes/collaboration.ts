import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import {
  createIssueSchema,
  createReviewRequestSchema,
  createWikiPageSchema,
  reviewDecisionSchema,
  updateIssueSchema,
  updateWikiPageSchema,
} from '../schemas/index.js';
import {
  createIssue,
  createReviewRequest,
  createWikiPage,
  decideReviewRequest,
  getWikiPage,
  listIssues,
  listReviewRequests,
  listWikiPages,
  updateIssue,
  updateWikiPage,
} from '../services/collaboration-service.js';

export async function collaborationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/repositories/:id/issues', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await listIssues(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to list issues';
      return reply.status(400).send({ error: message });
    }
  });

  app.post('/repositories/:id/issues', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = createIssueSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    try {
      return reply.status(201).send(await createIssue(id, request.user!.sub, parsed.data));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create issue';
      return reply.status(400).send({ error: message });
    }
  });

  app.patch('/repositories/:id/issues/:issueId', async (request, reply) => {
    const { id, issueId } = request.params as { id: string; issueId: string };
    const parsed = updateIssueSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    try {
      return await updateIssue(id, issueId, request.user!.sub, parsed.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update issue';
      return reply.status(400).send({ error: message });
    }
  });

  app.get('/repositories/:id/wiki', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await listWikiPages(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to list wiki pages';
      return reply.status(400).send({ error: message });
    }
  });

  app.get('/repositories/:id/wiki/:slug', async (request, reply) => {
    const { id, slug } = request.params as { id: string; slug: string };
    try {
      return await getWikiPage(id, slug);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Wiki page not found';
      return reply.status(404).send({ error: message });
    }
  });

  app.post('/repositories/:id/wiki', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = createWikiPageSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    try {
      return reply.status(201).send(await createWikiPage(id, request.user!.sub, parsed.data));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create wiki page';
      return reply.status(400).send({ error: message });
    }
  });

  app.patch('/repositories/:id/wiki/:slug', async (request, reply) => {
    const { id, slug } = request.params as { id: string; slug: string };
    const parsed = updateWikiPageSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    try {
      return await updateWikiPage(id, slug, request.user!.sub, parsed.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update wiki page';
      return reply.status(400).send({ error: message });
    }
  });

  app.get('/repositories/:id/reviews', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await listReviewRequests(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to list reviews';
      return reply.status(400).send({ error: message });
    }
  });

  app.post('/repositories/:id/reviews', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = createReviewRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    try {
      return reply.status(201).send(await createReviewRequest(id, request.user!.sub, parsed.data));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create review request';
      return reply.status(400).send({ error: message });
    }
  });

  app.post('/repositories/:id/reviews/:reviewId/decision', async (request, reply) => {
    const { id, reviewId } = request.params as { id: string; reviewId: string };
    const parsed = reviewDecisionSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    try {
      return await decideReviewRequest(
        id,
        reviewId,
        request.user!.sub,
        request.user!.isAdmin,
        parsed.data,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to decide review';
      const status = message.includes('Admin') ? 403 : 400;
      return reply.status(status).send({ error: message });
    }
  });
}

import type { FastifyPluginAsync } from 'fastify';

import { FileServiceError, listDirectory } from '../services/fs.js';

export const fileRoutes: FastifyPluginAsync = async (app) => {
	app.get<{ Querystring: { path?: string } }>('/api/files', async (request, reply) => {
		try {
			const payload = await listDirectory(request.query.path);
			return payload;
		} catch (error) {
			if (error instanceof FileServiceError) {
				return reply.code(error.statusCode).send({ error: error.message });
			}

			const message = error instanceof Error ? error.message : 'Unable to list directory';
			return reply.code(500).send({ error: message });
		}
	});
};
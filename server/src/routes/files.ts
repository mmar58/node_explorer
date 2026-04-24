import type { FastifyPluginAsync } from 'fastify';

import { FileServiceError, listDirectory, readTextFile, writeTextFile } from '../services/fs.js';

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

	app.get<{ Querystring: { path?: string } }>('/api/files/content', async (request, reply) => {
		try {
			const requestedPath = request.query.path;

			if (!requestedPath) {
				return reply.code(400).send({ error: 'The path query parameter is required' });
			}

			return await readTextFile(requestedPath);
		} catch (error) {
			if (error instanceof FileServiceError) {
				return reply.code(error.statusCode).send({ error: error.message });
			}

			const message = error instanceof Error ? error.message : 'Unable to read file';
			return reply.code(500).send({ error: message });
		}
	});

	app.put<{ Body: { path?: string; content?: string } }>('/api/files/content', async (request, reply) => {
		try {
			const requestedPath = request.body.path;

			if (!requestedPath) {
				return reply.code(400).send({ error: 'The path field is required' });
			}

			if (typeof request.body.content !== 'string') {
				return reply.code(400).send({ error: 'The content field must be a string' });
			}

			return await writeTextFile(requestedPath, request.body.content);
		} catch (error) {
			if (error instanceof FileServiceError) {
				return reply.code(error.statusCode).send({ error: error.message });
			}

			const message = error instanceof Error ? error.message : 'Unable to save file';
			return reply.code(500).send({ error: message });
		}
	});
};
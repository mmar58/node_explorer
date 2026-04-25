import type { FastifyPluginAsync } from 'fastify';

import {
	AuthServiceError,
	listUsersWithPermissions,
	removePermission,
	setPermissionLevel
} from '../services/auth.js';

export const adminRoutes: FastifyPluginAsync = async (app) => {
	app.get('/api/admin/users', { preHandler: app.requireAdmin }, async (request, reply) => {
		try {
			return {
				users: await listUsersWithPermissions()
			};
		} catch (error) {
			if (error instanceof AuthServiceError) {
				return reply.code(error.statusCode).send({ error: error.message });
			}

			const message = error instanceof Error ? error.message : 'Unable to load users';
			return reply.code(500).send({ error: message });
		}
	});

	app.put<{ Body: { userId?: number; path?: string; level?: 'read' | 'write' } }>(
		'/api/admin/permissions',
		{ preHandler: app.requireAdmin },
		async (request, reply) => {
			try {
				if (typeof request.body.userId !== 'number' || typeof request.body.path !== 'string') {
					return reply.code(400).send({ error: 'The userId and path fields are required' });
				}

				if (request.body.level !== 'read' && request.body.level !== 'write') {
					return reply.code(400).send({ error: 'The level field must be read or write' });
				}

				return await setPermissionLevel(request.body.userId, request.body.path, request.body.level);
			} catch (error) {
				if (error instanceof AuthServiceError) {
					return reply.code(error.statusCode).send({ error: error.message });
				}

				const message = error instanceof Error ? error.message : 'Unable to save permission';
				return reply.code(500).send({ error: message });
			}
		}
	);

	app.delete<{ Body: { id?: number } }>('/api/admin/permissions', { preHandler: app.requireAdmin }, async (request, reply) => {
		try {
			if (typeof request.body.id !== 'number') {
				return reply.code(400).send({ error: 'The id field is required' });
			}

			return await removePermission(request.body.id);
		} catch (error) {
			if (error instanceof AuthServiceError) {
				return reply.code(error.statusCode).send({ error: error.message });
			}

			const message = error instanceof Error ? error.message : 'Unable to delete permission';
			return reply.code(500).send({ error: message });
		}
	});
};
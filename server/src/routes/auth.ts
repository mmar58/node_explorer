import type { FastifyPluginAsync } from 'fastify';

import {
	AuthServiceError,
	getUserPermissions,
	loginUser,
	registerUser,
	type AuthenticatedUser
} from '../services/auth.js';

function buildAuthResponse(app: Parameters<FastifyPluginAsync>[0], user: AuthenticatedUser) {
	return {
		token: app.jwt.sign(user, { expiresIn: '12h' }),
		user
	};
}

export const authRoutes: FastifyPluginAsync = async (app) => {
	app.post<{ Body: { username?: string; password?: string } }>('/api/auth/register', async (request, reply) => {
		try {
			if (typeof request.body.username !== 'string' || typeof request.body.password !== 'string') {
				return reply.code(400).send({ error: 'The username and password fields are required' });
			}

			const user = await registerUser(request.body.username, request.body.password);
			return buildAuthResponse(app, user);
		} catch (error) {
			if (error instanceof AuthServiceError) {
				return reply.code(error.statusCode).send({ error: error.message });
			}

			const message = error instanceof Error ? error.message : 'Unable to register user';
			return reply.code(500).send({ error: message });
		}
	});

	app.post<{ Body: { username?: string; password?: string } }>('/api/auth/login', async (request, reply) => {
		try {
			if (typeof request.body.username !== 'string' || typeof request.body.password !== 'string') {
				return reply.code(400).send({ error: 'The username and password fields are required' });
			}

			const user = await loginUser(request.body.username, request.body.password);
			return buildAuthResponse(app, user);
		} catch (error) {
			if (error instanceof AuthServiceError) {
				return reply.code(error.statusCode).send({ error: error.message });
			}

			const message = error instanceof Error ? error.message : 'Unable to log in';
			return reply.code(500).send({ error: message });
		}
	});

	app.get('/api/auth/me', { preHandler: app.authenticate }, async (request, reply) => {
		try {
			return {
				user: request.authUser,
				permissions: await getUserPermissions(request.authUser.id)
			};
		} catch (error) {
			if (error instanceof AuthServiceError) {
				return reply.code(error.statusCode).send({ error: error.message });
			}

			const message = error instanceof Error ? error.message : 'Unable to load current user';
			return reply.code(500).send({ error: message });
		}
	});
};
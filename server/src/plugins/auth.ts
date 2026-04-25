import jwt from '@fastify/jwt';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { config } from '../config.js';
import { AuthServiceError, type AuthTokenPayload } from '../services/auth.js';

function extractToken(request: FastifyRequest) {
	const authorizationHeader = request.headers.authorization;

	if (authorizationHeader?.startsWith('Bearer ')) {
		return authorizationHeader.slice('Bearer '.length).trim();
	}

	const query = request.query as Record<string, unknown> | undefined;
	return typeof query?.token === 'string' && query.token.length > 0 ? query.token : null;
}

const authPluginFn: FastifyPluginAsync = async (app) => {
	await app.register(jwt, {
		secret: config.jwtSecret
	});

	app.decorate('verifyAuth', async (request) => {
		const token = extractToken(request);

		if (!token) {
			throw new AuthServiceError('Authentication required', 401);
		}

		try {
			const payload = await app.jwt.verify<AuthTokenPayload>(token);
			request.authUser = payload;
			return payload;
		} catch {
			throw new AuthServiceError('Invalid or expired authentication token', 401);
		}
	});

	app.decorate('authenticate', async (request, reply) => {
		try {
			await app.verifyAuth(request);
		} catch (error) {
			if (error instanceof AuthServiceError) {
				return reply.code(error.statusCode).send({ error: error.message });
			}

			const message = error instanceof Error ? error.message : 'Authentication failed';
			return reply.code(401).send({ error: message });
		}
	});

	app.decorate('requireAdmin', async (request, reply) => {
		try {
			const user = await app.verifyAuth(request);

			if (user.role !== 'admin') {
				return reply.code(403).send({ error: 'Administrator access is required' });
			}
		} catch (error) {
			if (error instanceof AuthServiceError) {
				return reply.code(error.statusCode).send({ error: error.message });
			}

			const message = error instanceof Error ? error.message : 'Authentication failed';
			return reply.code(401).send({ error: message });
		}
	});
};

export const authPlugin = fp(authPluginFn, { name: 'auth' });

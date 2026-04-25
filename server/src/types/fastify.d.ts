import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AuthenticatedUser } from '../services/auth.js';

declare module 'fastify' {
	interface FastifyRequest {
		authUser: AuthenticatedUser;
	}

	interface FastifyInstance {
		verifyAuth(request: FastifyRequest): Promise<AuthenticatedUser>;
		authenticate(request: FastifyRequest, reply: FastifyReply): Promise<unknown>;
		requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<unknown>;
	}
}
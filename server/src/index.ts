import cors from '@fastify/cors';
import Fastify from 'fastify';

import { config } from './config.js';
import { fileRoutes } from './routes/files.js';
import { healthRoutes } from './routes/health.js';

const app = Fastify({ logger: true });

await app.register(cors, {
	origin: true
});

await app.register(healthRoutes);
await app.register(fileRoutes);

try {
	await app.listen({ port: config.port, host: config.host });
	app.log.info(`server listening on http://${config.host}:${config.port}`);
} catch (error) {
	app.log.error(error);
	process.exit(1);
}
import { config as loadEnv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));

loadEnv({ path: resolve(currentDir, '../.env') });

export const config = {
	port: Number(process.env.PORT ?? 3001),
	host: process.env.HOST ?? '127.0.0.1',
	jwtSecret: process.env.JWT_SECRET ?? 'node-explorer-dev-secret-change-me',
	db: {
		host: process.env.DB_HOST ?? '127.0.0.1',
		port: Number(process.env.DB_PORT ?? 3306),
		user: process.env.DB_USER ?? 'root',
		password: process.env.DB_PASSWORD ?? '',
		database: process.env.DB_NAME ?? 'node_explorer'
	}
};
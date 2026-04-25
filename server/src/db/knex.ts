import knex from 'knex';

import { config } from '../config.js';
import { PERMISSION_PATH_MAX_LENGTH } from './schema.js';

export const db = knex({
	client: 'mysql2',
	connection: {
		host: config.db.host,
		port: config.db.port,
		user: config.db.user,
		password: config.db.password,
		database: config.db.database
	},
	pool: {
		min: 0,
		max: 10
	}
});

const PERMISSIONS_UNIQUE_INDEX = 'permissions_user_id_path_unique';

type ColumnInfoRow = { CHARACTER_MAXIMUM_LENGTH: number | null };
type IndexInfoRow = { INDEX_NAME: string };

async function getPermissionPathColumnLength(): Promise<number> {
	const [rows] = await db.raw<[ColumnInfoRow[]]>(
		`SELECT CHARACTER_MAXIMUM_LENGTH
		 FROM information_schema.COLUMNS
		 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'permissions' AND COLUMN_NAME = 'path'`,
		[config.db.database]
	);
	return Number(rows[0]?.CHARACTER_MAXIMUM_LENGTH ?? 0);
}

async function permissionsUniqueIndexExists(): Promise<boolean> {
	const [rows] = await db.raw<[IndexInfoRow[]]>(
		`SELECT INDEX_NAME
		 FROM information_schema.STATISTICS
		 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'permissions' AND INDEX_NAME = ?`,
		[config.db.database, PERMISSIONS_UNIQUE_INDEX]
	);
	return rows.length > 0;
}

async function repairPermissionsTableIfNeeded() {
	const currentLength = await getPermissionPathColumnLength();

	if (currentLength > PERMISSION_PATH_MAX_LENGTH) {
		const [oversized] = await db.raw<[Array<{ id: number; path: string }>]>(
			`SELECT id, path FROM permissions WHERE CHAR_LENGTH(path) > ? LIMIT 1`,
			[PERMISSION_PATH_MAX_LENGTH]
		);
		if (oversized.length > 0) {
			throw new Error(
				`Permission id=${oversized[0].id} path exceeds the supported ${PERMISSION_PATH_MAX_LENGTH}-character limit. Shorten or remove it, then restart.`
			);
		}
		await db.raw(
			`ALTER TABLE \`permissions\` MODIFY COLUMN \`path\` VARCHAR(${PERMISSION_PATH_MAX_LENGTH}) NOT NULL`
		);
	}

	if (!(await permissionsUniqueIndexExists())) {
		await db.raw(
			`ALTER TABLE \`permissions\` ADD UNIQUE KEY \`${PERMISSIONS_UNIQUE_INDEX}\` (\`user_id\`, \`path\`)`
		);
	}
}

function definePermissionsTable(table: knex.Knex.CreateTableBuilder) {
	table.increments('id').primary();
	table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
	table.string('path', PERMISSION_PATH_MAX_LENGTH).notNullable();
	table.enum('level', ['read', 'write']).notNullable();
	table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
	table.unique(['user_id', 'path']);
}

export async function ensureDatabaseSchema() {
	const hasUsersTable = await db.schema.hasTable('users');

	if (!hasUsersTable) {
		await db.schema.createTable('users', (table) => {
			table.increments('id').primary();
			table.string('username', 64).notNullable().unique();
			table.string('password_hash', 255).notNullable();
			table.enum('role', ['admin', 'user']).notNullable();
			table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
		});
	}

	const hasPermissionsTable = await db.schema.hasTable('permissions');

	if (!hasPermissionsTable) {
		await db.schema.createTable('permissions', definePermissionsTable);
		return;
	}

	await repairPermissionsTableIfNeeded();
}
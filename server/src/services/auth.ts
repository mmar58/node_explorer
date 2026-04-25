import bcrypt from 'bcryptjs';

import { PERMISSION_PATH_MAX_LENGTH } from '../db/schema.js';
import { db } from '../db/knex.js';

export type UserRole = 'admin' | 'user';
export type PermissionLevel = 'read' | 'write';

export type AuthenticatedUser = {
	id: number;
	username: string;
	role: UserRole;
};

export type AuthTokenPayload = AuthenticatedUser;

export type UserPermission = {
	id: number;
	userId: number;
	path: string;
	level: PermissionLevel;
	createdAt: string;
};

type UserRow = {
	id: number;
	username: string;
	password_hash: string;
	role: UserRole;
	created_at: Date | string;
};

type PermissionRow = {
	id: number;
	user_id: number;
	path: string;
	level: PermissionLevel;
	created_at: Date | string;
};

export class AuthServiceError extends Error {
	constructor(
		message: string,
		readonly statusCode: number
	) {
		super(message);
		this.name = 'AuthServiceError';
	}
}

export function sanitizeUsername(username: string) {
	const trimmedUsername = username.trim();

	if (!/^[a-zA-Z0-9._-]{3,64}$/.test(trimmedUsername)) {
		throw new AuthServiceError(
			'Username must be 3-64 characters and contain only letters, numbers, dot, underscore, or dash',
			400
		);
	}

	return trimmedUsername;
}

export function validatePassword(password: string) {
	return password;
}

function toAuthenticatedUser(user: Pick<UserRow, 'id' | 'username' | 'role'>): AuthenticatedUser {
	return {
		id: user.id,
		username: user.username,
		role: user.role
	};
}

function toPermission(permission: PermissionRow): UserPermission {
	return {
		id: permission.id,
		userId: permission.user_id,
		path: permission.path,
		level: permission.level,
		createdAt: new Date(permission.created_at).toISOString()
	};
}

async function findUserByUsername(username: string) {
	return (await db<UserRow>('users').where({ username }).first()) ?? null;
}

export async function getUserById(id: number) {
	const user = await db<UserRow>('users').where({ id }).first();
	return user ? toAuthenticatedUser(user) : null;
}

export async function getUserPermissions(userId: number) {
	const permissions = await db<PermissionRow>('permissions').where({ user_id: userId }).orderBy('path', 'asc');
	return permissions.map(toPermission);
}

export async function registerUser(username: string, password: string) {
	const normalizedUsername = sanitizeUsername(username);
	validatePassword(password);
	const existingUser = await findUserByUsername(normalizedUsername);

	if (existingUser) {
		throw new AuthServiceError('That username is already registered', 409);
	}

	const countResult = await db<UserRow>('users').count<{ count: number | string }>('* as count').first();
	const role: UserRole = Number(countResult?.count ?? 0) === 0 ? 'admin' : 'user';
	const passwordHash = await bcrypt.hash(password, 10);
	const [createdUserId] = await db<UserRow>('users').insert({
		username: normalizedUsername,
		password_hash: passwordHash,
		role
	});
	const user = await getUserById(Number(createdUserId));

	if (!user) {
		throw new AuthServiceError('Unable to load created user', 500);
	}

	return user;
}

export async function loginUser(username: string, password: string) {
	const normalizedUsername = sanitizeUsername(username);
	validatePassword(password);
	const user = await findUserByUsername(normalizedUsername);

	if (!user) {
		throw new AuthServiceError('Invalid username or password', 401);
	}

	const matches = await bcrypt.compare(password, user.password_hash);

	if (!matches) {
		throw new AuthServiceError('Invalid username or password', 401);
	}

	return toAuthenticatedUser(user);
}

export async function listUsersWithPermissions() {
	const [users, permissions] = await Promise.all([
		db<UserRow>('users').select('id', 'username', 'role', 'created_at').orderBy('created_at', 'asc'),
		db<PermissionRow>('permissions').orderBy('path', 'asc')
	]);

	return users.map((user) => ({
		id: user.id,
		username: user.username,
		role: user.role,
		createdAt: new Date(user.created_at).toISOString(),
		permissions: permissions.filter((permission) => permission.user_id === user.id).map(toPermission)
	}));
}

export async function setPermissionLevel(userId: number, requestedPath: string, level: PermissionLevel) {
	const existingUser = await db<UserRow>('users').where({ id: userId }).first();

	if (!existingUser) {
		throw new AuthServiceError('The selected user does not exist', 404);
	}

	const normalizedPath = requestedPath.trim();

	if (!normalizedPath) {
		throw new AuthServiceError('A permission path is required', 400);
	}

	if (normalizedPath.length > PERMISSION_PATH_MAX_LENGTH) {
		throw new AuthServiceError(
			`Permission paths must be ${PERMISSION_PATH_MAX_LENGTH} characters or fewer`,
			400
		);
	}

	const existingPermission = await db<PermissionRow>('permissions')
		.where({ user_id: userId, path: normalizedPath })
		.first();

	if (existingPermission) {
		await db<PermissionRow>('permissions').where({ id: existingPermission.id }).update({ level });
		const updatedPermission = await db<PermissionRow>('permissions').where({ id: existingPermission.id }).first();

		if (!updatedPermission) {
			throw new AuthServiceError('Unable to load updated permission', 500);
		}

		return toPermission(updatedPermission);
	}

	const [permissionId] = await db<PermissionRow>('permissions').insert({
		user_id: userId,
		path: normalizedPath,
		level
	});
	const createdPermission = await db<PermissionRow>('permissions').where({ id: Number(permissionId) }).first();

	if (!createdPermission) {
		throw new AuthServiceError('Unable to load created permission', 500);
	}

	return toPermission(createdPermission);
}

export async function removePermission(id: number) {
	const deleted = await db<PermissionRow>('permissions').where({ id }).delete();

	if (!deleted) {
		throw new AuthServiceError('The selected permission does not exist', 404);
	}

	return { deleted: true };
}
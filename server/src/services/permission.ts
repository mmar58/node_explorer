import { promises as fs } from 'node:fs';
import path from 'node:path';

import { db } from '../db/knex.js';
import type { AuthenticatedUser, PermissionLevel, UserPermission } from './auth.js';
import { AuthServiceError } from './auth.js';
import type { FileEntry, FileListing } from './fs.js';

type PermissionRow = {
	id: number;
	user_id: number;
	path: string;
	level: PermissionLevel;
	created_at: Date | string;
};

const permissionRank: Record<PermissionLevel, number> = {
	read: 1,
	write: 2
};

function getPathModule() {
	return process.platform === 'win32' ? path.win32 : path.posix;
}

function formatApiPath(absolutePath: string) {
	return process.platform === 'win32' ? absolutePath.replaceAll('\\', '/') : absolutePath;
}

export function normalizePermissionPath(requestedPath: string) {
	if (!requestedPath || requestedPath === '/') {
		return '/';
	}

	if (process.platform === 'win32') {
		const windowsPath = requestedPath.replaceAll('/', '\\');

		if (!path.win32.isAbsolute(windowsPath)) {
			throw new AuthServiceError('Requested path must be an absolute path', 400);
		}

		return formatApiPath(path.win32.normalize(windowsPath));
	}

	if (!path.posix.isAbsolute(requestedPath)) {
		throw new AuthServiceError('Requested path must be an absolute path', 400);
	}

	return path.posix.normalize(requestedPath);
}

export function matchesPermissionPath(requestedPath: string, permissionPath: string) {
	if (permissionPath === '/') {
		return true;
	}

	return requestedPath === permissionPath || requestedPath.startsWith(`${permissionPath}/`);
}

async function getPermissionsForUser(userId: number) {
	const permissions = await db<PermissionRow>('permissions').where({ user_id: userId });
	return permissions.map(
		(permission) =>
			({
				id: permission.id,
				userId: permission.user_id,
				path: permission.path,
				level: permission.level,
				createdAt: new Date(permission.created_at).toISOString()
			}) satisfies UserPermission
	);
}

function findBestPermission(permissions: UserPermission[], requestedPath: string) {
	return permissions
		.filter((permission) => matchesPermissionPath(requestedPath, permission.path))
		.sort((left, right) => right.path.length - left.path.length)[0] ?? null;
}

async function statPermissionPath(permissionPath: string): Promise<FileEntry | null> {
	if (permissionPath === '/') {
		return null;
	}

	const normalizedPath = normalizePermissionPath(permissionPath);

	try {
		const stats = await fs.stat(process.platform === 'win32' ? normalizedPath.replaceAll('/', '\\') : normalizedPath);
		return {
			name: path.basename(normalizedPath) || normalizedPath,
			path: normalizedPath,
			type: stats.isDirectory() ? 'directory' : 'file',
			size: stats.size,
			modifiedAt: stats.mtime.toISOString(),
			isAccessible: true
		};
	} catch {
		return {
			name: path.basename(normalizedPath) || normalizedPath,
			path: normalizedPath,
			type: 'directory',
			size: 0,
			modifiedAt: new Date(0).toISOString(),
			isAccessible: false
		};
	}
}

export async function ensurePathPermission(user: AuthenticatedUser, requestedPath: string, requiredLevel: PermissionLevel) {
	if (user.role === 'admin') {
		return;
	}

	const normalizedPath = normalizePermissionPath(requestedPath);
	const permissions = await getPermissionsForUser(user.id);
	const bestPermission = findBestPermission(permissions, normalizedPath);

	if (!bestPermission || permissionRank[bestPermission.level] < permissionRank[requiredLevel]) {
		throw new AuthServiceError('Permission denied for the requested path', 403);
	}
}

export async function listPermissionRoots(userId: number): Promise<FileListing> {
	const permissions = await getPermissionsForUser(userId);
	const rootEntries = await Promise.all(
		permissions
			.filter((permission) => permission.level === 'read' || permission.level === 'write')
			.map((permission) => statPermissionPath(permission.path))
	);

	const dedupedEntries = rootEntries
		.filter((entry): entry is FileEntry => entry !== null)
		.filter((entry, index, entries) => entries.findIndex((candidate) => candidate.path === entry.path) === index)
		.sort((left, right) => {
			if (left.type !== right.type) {
				return left.type === 'directory' ? -1 : 1;
			}

			return left.name.localeCompare(right.name);
		});

	return {
		currentPath: '/',
		parentPath: null,
		entries: dedupedEntries
	};
}
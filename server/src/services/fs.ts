import { promises as fs } from 'node:fs';
import path from 'node:path';

export class FileServiceError extends Error {
	constructor(
		message: string,
		readonly statusCode: number
	) {
		super(message);
		this.name = 'FileServiceError';
	}
}

export type FileEntry = {
	name: string;
	path: string;
	type: 'file' | 'directory';
	size: number;
	modifiedAt: string;
};

export type FileListing = {
	currentPath: string;
	parentPath: string | null;
	entries: FileEntry[];
};

function toPosixPath(value: string) {
	return value.split(path.sep).join('/');
}

function normalizeAbsolutePath(requestedPath?: string) {
	if (!requestedPath || requestedPath === '/') {
		return null;
	}

	if (process.platform === 'win32') {
		const windowsPath = requestedPath.replaceAll('/', '\\');

		if (!path.win32.isAbsolute(windowsPath)) {
			throw new FileServiceError('Requested path must be an absolute path', 400);
		}

		return path.win32.normalize(windowsPath);
	}

	if (!path.posix.isAbsolute(requestedPath)) {
		throw new FileServiceError('Requested path must be an absolute path', 400);
	}

	return path.posix.normalize(requestedPath);
}

async function listWindowsDrives() {
	const driveLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
	const driveChecks = await Promise.all(
		driveLetters.map(async (driveLetter) => {
			const drivePath = `${driveLetter}:\\`;

			try {
				await fs.access(drivePath);
				return drivePath;
			} catch {
				return null;
			}
		})
	);

	return driveChecks
		.filter((drivePath): drivePath is string => drivePath !== null)
		.map((drivePath) => ({
			name: drivePath.slice(0, 2),
			path: toPosixPath(drivePath),
			type: 'directory',
			size: 0,
			modifiedAt: new Date(0).toISOString()
		}) satisfies FileEntry);
}

function getPathModule() {
	return process.platform === 'win32' ? path.win32 : path.posix;
}

function formatApiPath(absolutePath: string) {
	return process.platform === 'win32' ? absolutePath.replaceAll('\\', '/') : absolutePath;
}

function getParentPath(currentPath: string) {
	if (currentPath === '/') {
		return null;
	}

	if (process.platform === 'win32') {
		const normalizedPath = currentPath.replaceAll('/', '\\');
		const parsedPath = path.win32.parse(normalizedPath);

		if (normalizedPath === parsedPath.root) {
			return '/';
		}

		const parentPath = path.win32.dirname(normalizedPath);
		return formatApiPath(parentPath);
	}

	if (currentPath === path.posix.sep) {
		return null;
	}

	const parentPath = path.posix.dirname(currentPath);
	return parentPath === path.posix.sep ? '/' : parentPath;
}

async function statDirectory(absolutePath: string) {
	try {
		return await fs.stat(absolutePath);
	} catch (error) {
		if (typeof error === 'object' && error && 'code' in error) {
			if (error.code === 'ENOENT') {
				throw new FileServiceError('Requested path does not exist', 404);
			}

			if (error.code === 'EACCES' || error.code === 'EPERM') {
				throw new FileServiceError('Permission denied for requested path', 403);
			}
		}

		throw error;
	}
}

async function readDirectoryEntries(absolutePath: string) {
	try {
		return await fs.readdir(absolutePath, { withFileTypes: true });
	} catch (error) {
		if (typeof error === 'object' && error && 'code' in error) {
			if (error.code === 'EACCES' || error.code === 'EPERM') {
				throw new FileServiceError('Permission denied for requested path', 403);
			}
		}

		throw error;
	}
}


export async function listDirectory(requestedPath?: string): Promise<FileListing> {
	if (!requestedPath || requestedPath === '/') {
		if (process.platform === 'win32') {
			return {
				currentPath: '/',
				parentPath: null,
				entries: await listWindowsDrives()
			};
		}

		requestedPath = '/';
	}

	const absolutePath = normalizeAbsolutePath(requestedPath);

	if (!absolutePath) {
		throw new FileServiceError('Unable to resolve requested path', 400);
	}

	const stats = await statDirectory(absolutePath);

	if (!stats.isDirectory()) {
		throw new FileServiceError('Requested path is not a directory', 400);
	}

	const pathModule = getPathModule();
	const children = await readDirectoryEntries(absolutePath);
	const entries = await Promise.all(
		children.map(async (child) => {
			const childAbsolutePath = pathModule.join(absolutePath, child.name);
			const childStats = await fs.stat(childAbsolutePath);

			return {
				name: child.name,
				path: formatApiPath(childAbsolutePath),
				type: child.isDirectory() ? 'directory' : 'file',
				size: childStats.size,
				modifiedAt: childStats.mtime.toISOString()
			} satisfies FileEntry;
		})
	);

	entries.sort((left, right) => {
		if (left.type !== right.type) {
			return left.type === 'directory' ? -1 : 1;
		}

		return left.name.localeCompare(right.name);
	});

	return {
		currentPath: formatApiPath(absolutePath),
		parentPath: getParentPath(formatApiPath(absolutePath)),
		entries
	};
}
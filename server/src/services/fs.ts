import { promises as fs } from 'node:fs';
import path from 'node:path';

import AdmZip from 'adm-zip';

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
	isAccessible: boolean;
};

export type FileListing = {
	currentPath: string;
	parentPath: string | null;
	entries: FileEntry[];
};

export type FileContent = {
	path: string;
	name: string;
	content: string;
	encoding: 'utf8';
	size: number;
	modifiedAt: string;
};

export type FileStreamTarget = {
	absolutePath: string;
	path: string;
	name: string;
	size: number;
	modifiedAt: string;
};

export type ArchiveEntry = {
	path: string;
	type: 'file' | 'directory';
	size: number;
	compressedSize: number;
};

const MAX_TEXT_FILE_BYTES = 1024 * 1024;

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
			modifiedAt: new Date(0).toISOString(),
			isAccessible: true
		}) satisfies FileEntry);
}

function getPathModule() {
	return process.platform === 'win32' ? path.win32 : path.posix;
}

function formatApiPath(absolutePath: string) {
	return process.platform === 'win32' ? absolutePath.replaceAll('\\', '/') : absolutePath;
}

function normalizeRequiredAbsolutePath(requestedPath?: string) {
	const absolutePath = normalizeAbsolutePath(requestedPath);

	if (!absolutePath) {
		throw new FileServiceError('Requested path must be an absolute path', 400);
	}

	return absolutePath;
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

async function statPath(absolutePath: string) {
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

function ensureFile(stats: Awaited<ReturnType<typeof statPath>>) {
	if (!stats.isFile()) {
		throw new FileServiceError('Requested path is not a file', 400);
	}
}

function ensureTextFile(buffer: Buffer) {
	if (buffer.includes(0)) {
		throw new FileServiceError('Requested file is not a UTF-8 text file', 415);
	}
}

function isPermissionError(error: unknown) {
	return typeof error === 'object' && error !== null && 'code' in error && (error.code === 'EACCES' || error.code === 'EPERM');
}

function normalizeUploadRelativePath(relativePath: string) {
	const normalized = path.posix.normalize(relativePath.replaceAll('\\', '/'));

	if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) {
		throw new FileServiceError('Upload path must stay within the selected destination folder', 400);
	}

	if (path.posix.isAbsolute(normalized)) {
		throw new FileServiceError('Upload path must be relative', 400);
	}

	return normalized;
}

async function ensureDirectory(absolutePath: string) {
	const stats = await statDirectory(absolutePath);

	if (!stats.isDirectory()) {
		throw new FileServiceError('Requested path is not a directory', 400);
	}

	return absolutePath;
}

async function statChildEntry(childAbsolutePath: string, child: Awaited<ReturnType<typeof readDirectoryEntries>>[number]) {
	try {
		const childStats = await fs.stat(childAbsolutePath);

		return {
			name: child.name,
			path: formatApiPath(childAbsolutePath),
			type: child.isDirectory() ? 'directory' : 'file',
			size: childStats.size,
			modifiedAt: childStats.mtime.toISOString(),
			isAccessible: true
		} satisfies FileEntry;
	} catch (error) {
		if (isPermissionError(error)) {
			return {
				name: child.name,
				path: formatApiPath(childAbsolutePath),
				type: child.isDirectory() ? 'directory' : 'file',
				size: 0,
				modifiedAt: new Date(0).toISOString(),
				isAccessible: false
			} satisfies FileEntry;
		}

		if (typeof error === 'object' && error && 'code' in error && error.code === 'ENOENT') {
			return null;
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
			return await statChildEntry(childAbsolutePath, child);
		})
	);

	const visibleEntries = entries.filter((entry): entry is FileEntry => entry !== null);

	visibleEntries.sort((left, right) => {
		if (left.type !== right.type) {
			return left.type === 'directory' ? -1 : 1;
		}

		return left.name.localeCompare(right.name);
	});

	return {
		currentPath: formatApiPath(absolutePath),
		parentPath: getParentPath(formatApiPath(absolutePath)),
		entries: visibleEntries
	};
}

export async function readTextFile(requestedPath: string): Promise<FileContent> {
	const absolutePath = normalizeRequiredAbsolutePath(requestedPath);
	const stats = await statPath(absolutePath);

	ensureFile(stats);

	if (stats.size > MAX_TEXT_FILE_BYTES) {
		throw new FileServiceError('Requested file exceeds the 1 MB text preview limit', 413);
	}

	let buffer: Buffer;

	try {
		buffer = await fs.readFile(absolutePath);
	} catch (error) {
		if (typeof error === 'object' && error && 'code' in error) {
			if (error.code === 'EACCES' || error.code === 'EPERM') {
				throw new FileServiceError('Permission denied for requested path', 403);
			}
		}

		throw error;
	}

	ensureTextFile(buffer);

	return {
		path: formatApiPath(absolutePath),
		name: path.basename(absolutePath),
		content: buffer.toString('utf8'),
		encoding: 'utf8',
		size: stats.size,
		modifiedAt: stats.mtime.toISOString()
	};
}

export async function writeTextFile(requestedPath: string, content: string) {
	const absolutePath = normalizeRequiredAbsolutePath(requestedPath);
	const stats = await statPath(absolutePath);

	ensureFile(stats);

	if (Buffer.byteLength(content, 'utf8') > MAX_TEXT_FILE_BYTES) {
		throw new FileServiceError('Updated file exceeds the 1 MB text save limit', 413);
	}

	try {
		await fs.writeFile(absolutePath, content, 'utf8');
	} catch (error) {
		if (typeof error === 'object' && error && 'code' in error) {
			if (error.code === 'EACCES' || error.code === 'EPERM') {
				throw new FileServiceError('Permission denied for requested path', 403);
			}
		}

		throw error;
	}

	const updatedStats = await statPath(absolutePath);

	return {
		path: formatApiPath(absolutePath),
		name: path.basename(absolutePath),
		size: updatedStats.size,
		modifiedAt: updatedStats.mtime.toISOString()
	};
}

export async function getFileStreamTarget(requestedPath: string): Promise<FileStreamTarget> {
	const absolutePath = normalizeRequiredAbsolutePath(requestedPath);
	const stats = await statPath(absolutePath);

	ensureFile(stats);

	return {
		absolutePath,
		path: formatApiPath(absolutePath),
		name: path.basename(absolutePath),
		size: stats.size,
		modifiedAt: stats.mtime.toISOString()
	};
}

export async function getDownloadTarget(requestedPath: string) {
	const absolutePath = normalizeRequiredAbsolutePath(requestedPath);
	const stats = await statPath(absolutePath);

	return {
		absolutePath,
		path: formatApiPath(absolutePath),
		name: path.basename(absolutePath) || formatApiPath(absolutePath).replace(/[:/\\]+/g, '_'),
		isDirectory: stats.isDirectory(),
		size: stats.size,
		modifiedAt: stats.mtime.toISOString()
	};
}

export async function getArchivePreview(requestedPath: string) {
	const target = await getFileStreamTarget(requestedPath);

	if (!target.name.toLowerCase().endsWith('.zip')) {
		throw new FileServiceError('Requested file is not a zip archive', 400);
	}

	let zip: AdmZip;

	try {
		zip = new AdmZip(target.absolutePath);
	} catch {
		throw new FileServiceError('Unable to open zip archive', 400);
	}

	const entries = zip
		.getEntries()
		.map((entry: AdmZip.IZipEntry) => ({
			path: entry.entryName,
			type: entry.isDirectory ? 'directory' : 'file',
			size: entry.header.size,
			compressedSize: entry.header.compressedSize
		}) satisfies ArchiveEntry);

	return {
		path: target.path,
		name: target.name,
		entries
	};
}

export async function resolveUploadDestination(requestedDirectoryPath: string, relativeFilePath: string) {
	const destinationDirectory = await ensureDirectory(normalizeRequiredAbsolutePath(requestedDirectoryPath));
	const normalizedRelativePath = normalizeUploadRelativePath(relativeFilePath);
	const pathModule = getPathModule();
	const absoluteDestinationPath = pathModule.join(
		destinationDirectory,
		...normalizedRelativePath.split('/').filter(Boolean)
	);
	const relativeToDestination = pathModule.relative(destinationDirectory, absoluteDestinationPath);

	if (relativeToDestination.startsWith('..') || pathModule.isAbsolute(relativeToDestination)) {
		throw new FileServiceError('Upload path must stay within the selected destination folder', 400);
	}

	await fs.mkdir(pathModule.dirname(absoluteDestinationPath), { recursive: true });

	return {
		absolutePath: absoluteDestinationPath,
		path: formatApiPath(absoluteDestinationPath),
		name: path.basename(absoluteDestinationPath)
	};
}
import { env } from '$env/dynamic/public';

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

export type FileContent = {
	path: string;
	name: string;
	content: string;
	encoding: 'utf8';
	size: number;
	modifiedAt: string;
};

export type SavedFileContent = {
	path: string;
	name: string;
	size: number;
	modifiedAt: string;
};

export class DirectoryRequestError extends Error {
	constructor(
		message: string,
		readonly statusCode: number
	) {
		super(message);
		this.name = 'DirectoryRequestError';
	}
}

const apiBaseUrl = env.PUBLIC_API_BASE_URL || 'http://127.0.0.1:3001';

export async function getDirectoryListing(requestedPath = '/') {
	const url = new URL('/api/files', apiBaseUrl);
	url.searchParams.set('path', requestedPath);

	const response = await fetch(url);

	if (!response.ok) {
		const payload = (await response.json().catch(() => null)) as { error?: string } | null;
		throw new DirectoryRequestError(payload?.error ?? 'Unable to load directory', response.status);
	}

	return (await response.json()) as FileListing;
}

export class FileContentRequestError extends Error {
	constructor(
		message: string,
		readonly statusCode: number
	) {
		super(message);
		this.name = 'FileContentRequestError';
	}
}

export async function getTextFileContent(requestedPath: string) {
	const url = new URL('/api/files/content', apiBaseUrl);
	url.searchParams.set('path', requestedPath);

	const response = await fetch(url);

	if (!response.ok) {
		const payload = (await response.json().catch(() => null)) as { error?: string } | null;
		throw new FileContentRequestError(payload?.error ?? 'Unable to read file', response.status);
	}

	return (await response.json()) as FileContent;
}

export async function saveTextFileContent(requestedPath: string, content: string) {
	const url = new URL('/api/files/content', apiBaseUrl);
	const response = await fetch(url, {
		method: 'PUT',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify({ path: requestedPath, content })
	});

	if (!response.ok) {
		const payload = (await response.json().catch(() => null)) as { error?: string } | null;
		throw new FileContentRequestError(payload?.error ?? 'Unable to save file', response.status);
	}

	return (await response.json()) as SavedFileContent;
}

export function getTerminalSocketUrl(options: { cwd?: string }) {
	const url = new URL('/api/terminal/socket', apiBaseUrl);

	if (options.cwd) {
		url.searchParams.set('cwd', options.cwd);
	}

	url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	return url.toString();
}
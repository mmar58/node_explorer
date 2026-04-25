import { env } from '$env/dynamic/public';

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

export type SavedFileContent = {
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

export type ArchivePreview = {
	path: string;
	name: string;
	entries: ArchiveEntry[];
};

export type UploadItem = {
	file: File;
	relativePath: string;
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

async function throwApiError(response: Response, fallbackMessage: string): Promise<never> {
	const payload = (await response.json().catch(() => null)) as { error?: string } | null;
	throw new FileContentRequestError(payload?.error ?? fallbackMessage, response.status);
}

export async function getTextFileContent(requestedPath: string) {
	const url = new URL('/api/files/content', apiBaseUrl);
	url.searchParams.set('path', requestedPath);

	const response = await fetch(url);

	if (!response.ok) {
		await throwApiError(response, 'Unable to read file');
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
		await throwApiError(response, 'Unable to save file');
	}

	return (await response.json()) as SavedFileContent;
}

export async function getArchivePreview(requestedPath: string) {
	const url = new URL('/api/files/archive', apiBaseUrl);
	url.searchParams.set('path', requestedPath);

	const response = await fetch(url);

	if (!response.ok) {
		await throwApiError(response, 'Unable to inspect archive');
	}

	return (await response.json()) as ArchivePreview;
}

export async function uploadFilesToDirectory(destinationPath: string, items: UploadItem[]) {
	const url = new URL('/api/files/upload', apiBaseUrl);
	url.searchParams.set('path', destinationPath);

	const formData = new FormData();

	for (const item of items) {
		formData.append('files', item.file, item.relativePath);
	}

	const response = await fetch(url, {
		method: 'POST',
		body: formData
	});

	if (!response.ok) {
		await throwApiError(response, 'Unable to upload files');
	}

	return (await response.json()) as { uploaded: Array<{ path: string; name: string }> };
}

export function getFileBlobUrl(requestedPath: string) {
	const url = new URL('/api/files/blob', apiBaseUrl);
	url.searchParams.set('path', requestedPath);
	return url.toString();
}

export function getDownloadUrl(requestedPath: string) {
	const url = new URL('/api/files/download', apiBaseUrl);
	url.searchParams.set('path', requestedPath);
	return url.toString();
}

export function getTerminalSocketUrl(options: { cwd?: string }) {
	const url = new URL('/api/terminal/socket', apiBaseUrl);

	if (options.cwd) {
		url.searchParams.set('cwd', options.cwd);
	}

	url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	return url.toString();
}
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
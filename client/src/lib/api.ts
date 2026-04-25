import { env } from '$env/dynamic/public';

export type UserRole = 'admin' | 'user';

export type UserPermission = {
	id: number;
	userId: number;
	path: string;
	level: 'read' | 'write';
	createdAt: string;
};

export type AuthenticatedUser = {
	id: number;
	username: string;
	role: UserRole;
};

export type AuthResponse = {
	token: string;
	user: AuthenticatedUser;
};

export type CurrentSessionResponse = {
	user: AuthenticatedUser;
	permissions: UserPermission[];
};

export type AdminUser = AuthenticatedUser & {
	createdAt: string;
	permissions: UserPermission[];
};

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

export type FileOperationResult = {
	path: string;
	name: string;
	type: 'file' | 'directory';
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
const authStorageKey = 'node-explorer-auth-token';

function getStoredToken() {
	if (typeof window === 'undefined') {
		return null;
	}

	return window.localStorage.getItem(authStorageKey);
}

export function setAuthToken(token: string) {
	if (typeof window !== 'undefined') {
		window.localStorage.setItem(authStorageKey, token);
	}
}

export function clearAuthToken() {
	if (typeof window !== 'undefined') {
		window.localStorage.removeItem(authStorageKey);
	}
}

export function getAuthToken() {
	return getStoredToken();
}

function withAuthHeaders(headers: HeadersInit = {}) {
	const token = getStoredToken();
	return token
		? {
			...headers,
			Authorization: `Bearer ${token}`
		}
		: headers;
}

async function apiFetch(input: URL | string, init: RequestInit = {}) {
	return fetch(input, {
		...init,
		headers: withAuthHeaders(init.headers)
	});
}

function withAuthQuery(url: URL) {
	const token = getStoredToken();

	if (token) {
		url.searchParams.set('token', token);
	}

	return url;
}

export async function getDirectoryListing(requestedPath = '/') {
	const url = new URL('/api/files', apiBaseUrl);
	url.searchParams.set('path', requestedPath);

	const response = await apiFetch(url);

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

	const response = await apiFetch(url);

	if (!response.ok) {
		await throwApiError(response, 'Unable to read file');
	}

	return (await response.json()) as FileContent;
}

export async function saveTextFileContent(requestedPath: string, content: string) {
	const url = new URL('/api/files/content', apiBaseUrl);
	const response = await apiFetch(url, {
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

	const response = await apiFetch(url);

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

	const response = await apiFetch(url, {
		method: 'POST',
		body: formData
	});

	if (!response.ok) {
		await throwApiError(response, 'Unable to upload files');
	}

	return (await response.json()) as { uploaded: Array<{ path: string; name: string }> };
}

export async function deleteFileSystemItem(requestedPath: string) {
	const url = new URL('/api/files', apiBaseUrl);
	url.searchParams.set('path', requestedPath);

	const response = await apiFetch(url, {
		method: 'DELETE'
	});

	if (!response.ok) {
		await throwApiError(response, 'Unable to delete item');
	}

	return (await response.json()) as { path: string; deleted: true };
}

export async function renameFileSystemItem(requestedPath: string, name: string) {
	const url = new URL('/api/files/rename', apiBaseUrl);
	const response = await apiFetch(url, {
		method: 'PATCH',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify({ path: requestedPath, name })
	});

	if (!response.ok) {
		await throwApiError(response, 'Unable to rename item');
	}

	return (await response.json()) as FileOperationResult;
}

export async function moveFileSystemItem(requestedPath: string, destinationPath: string) {
	const url = new URL('/api/files/move', apiBaseUrl);
	const response = await apiFetch(url, {
		method: 'PATCH',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify({ path: requestedPath, destinationPath })
	});

	if (!response.ok) {
		await throwApiError(response, 'Unable to move item');
	}

	return (await response.json()) as FileOperationResult;
}

export function getFileBlobUrl(requestedPath: string) {
	const url = withAuthQuery(new URL('/api/files/blob', apiBaseUrl));
	url.searchParams.set('path', requestedPath);
	return url.toString();
}

export function getDownloadUrl(requestedPath: string) {
	const url = withAuthQuery(new URL('/api/files/download', apiBaseUrl));
	url.searchParams.set('path', requestedPath);
	return url.toString();
}

export function getTerminalSocketUrl(options: { cwd?: string }) {
	const url = withAuthQuery(new URL('/api/terminal/socket', apiBaseUrl));

	if (options.cwd) {
		url.searchParams.set('cwd', options.cwd);
	}

	url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	return url.toString();
}

export async function registerUser(username: string, password: string) {
	const url = new URL('/api/auth/register', apiBaseUrl);
	const response = await apiFetch(url, {
		method: 'POST',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify({ username, password })
	});

	if (!response.ok) {
		await throwApiError(response, 'Unable to register user');
	}

	return (await response.json()) as AuthResponse;
}

export async function loginUser(username: string, password: string) {
	const url = new URL('/api/auth/login', apiBaseUrl);
	const response = await apiFetch(url, {
		method: 'POST',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify({ username, password })
	});

	if (!response.ok) {
		await throwApiError(response, 'Unable to log in');
	}

	return (await response.json()) as AuthResponse;
}

export async function getCurrentSession() {
	const url = new URL('/api/auth/me', apiBaseUrl);
	const response = await apiFetch(url);

	if (!response.ok) {
		await throwApiError(response, 'Unable to load current session');
	}

	return (await response.json()) as CurrentSessionResponse;
}

export async function getAdminUsers() {
	const url = new URL('/api/admin/users', apiBaseUrl);
	const response = await apiFetch(url);

	if (!response.ok) {
		await throwApiError(response, 'Unable to load users');
	}

	return (await response.json()) as { users: AdminUser[] };
}

export async function savePermission(userId: number, path: string, level: 'read' | 'write') {
	const url = new URL('/api/admin/permissions', apiBaseUrl);
	const response = await apiFetch(url, {
		method: 'PUT',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify({ userId, path, level })
	});

	if (!response.ok) {
		await throwApiError(response, 'Unable to save permission');
	}

	return (await response.json()) as UserPermission;
}

export async function deletePermission(id: number) {
	const url = new URL('/api/admin/permissions', apiBaseUrl);
	const response = await apiFetch(url, {
		method: 'DELETE',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify({ id })
	});

	if (!response.ok) {
		await throwApiError(response, 'Unable to delete permission');
	}

	return (await response.json()) as { deleted: true };
}
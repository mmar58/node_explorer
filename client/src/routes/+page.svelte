<svelte:options runes={false} />

<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ChevronUp,
		Download,
		File,
		FileArchive,
		FileCode2,
		FileText,
		Folder,
		FolderUp,
		HardDrive,
		Image as ImageIcon,
		LayoutPanelLeft,
		LockKeyhole,
		LogOut,
		Music4,
		RefreshCw,
		Save,
		Search,
		Shield,
		SquareTerminal,
		Upload,
		UserRound,
		Video,
		X
	} from '@lucide/svelte';

	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import FileContextMenu from '$lib/components/FileContextMenu.svelte';
	import FilePreviewModal from '$lib/components/FilePreviewModal.svelte';
	import Terminal from '$lib/components/Terminal.svelte';
	import ToastStack from '$lib/components/ToastStack.svelte';
	import {
		clearAuthToken,
		deleteFileSystemItem,
		deletePermission,
		DirectoryRequestError,
		getAdminUsers,
		getArchivePreview,
		getAuthToken,
		getCurrentSession,
		getDirectoryListing,
		getDownloadUrl,
		getFileBlobUrl,
		getTextFileContent,
		loginUser,
		moveFileSystemItem,
		renameFileSystemItem,
		registerUser,
		savePermission,
		saveTextFileContent,
		setAuthToken,
		uploadFilesToDirectory,
		type AdminUser,
		type ArchiveEntry,
		type AuthenticatedUser,
		type AuthResponse,
		type FileContent,
		type FileEntry,
		type FileOperationResult,
		type UploadItem,
		type UserPermission
	} from '$lib/api';

	type FileListingState = {
		currentPath: string;
		parentPath: string | null;
		entries: FileEntry[];
	};

	type ToastItem = {
		id: number;
		title: string;
		message: string;
		tone?: 'error' | 'info';
	};

	type EditorTab = FileContent & {
		language: string;
		draftContent: string;
		isDirty: boolean;
	};

	type PreviewKind = 'image' | 'video' | 'audio' | 'archive' | 'document' | 'other';

	type PreviewState = {
		isOpen: boolean;
		title: string;
		kind: PreviewKind;
		src: string;
		archiveEntries: ArchiveEntry[];
	};

	type ContextMenuState = {
		isOpen: boolean;
		x: number;
		y: number;
		entry: FileEntry | null;
	};

	type AuthMode = 'login' | 'register';

	let listing: FileListingState = {
		currentPath: '/',
		parentPath: null,
		entries: []
	};
	let isLoading = false;
	let isAuthLoading = true;
	let isAuthenticating = false;
	let isAdminLoading = false;
	let selectedFilePath = '';
	let filterQuery = '';
	let terminalCwd: string | undefined = undefined;
	let terminalSessionKey = 0;
	let isTerminalVisible = false;
	let isEditorModalOpen = false;
	let isLoadingArchive = false;
	let isAdminPanelOpen = false;
	let toasts: ToastItem[] = [];
	let toastId = 0;
	let openTabs: EditorTab[] = [];
	let activeTabPath = '';
	let previewState: PreviewState = {
		isOpen: false,
		title: '',
		kind: 'other',
		src: '',
		archiveEntries: []
	};
	let contextMenu: ContextMenuState = {
		isOpen: false,
		x: 0,
		y: 0,
		entry: null
	};
	let currentUser: AuthenticatedUser | null = null;
	let currentPermissions: UserPermission[] = [];
	let adminUsers: AdminUser[] = [];
	let authMode: AuthMode = 'login';
	let authUsername = '';
	let authPassword = '';
	let permissionDraftUserId = '';
	let permissionDraftPath = '';
	let permissionDraftLevel: 'read' | 'write' = 'read';
	let fileUploadInput: HTMLInputElement;
	let folderUploadInput: HTMLInputElement;
	let uploadTargetPath = '/';
	let dragTargetPath = '';

	const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico']);
	const videoExtensions = new Set(['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv']);
	const audioExtensions = new Set(['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac']);
	const archiveExtensions = new Set(['zip']);
	const documentExtensions = new Set(['pdf']);
	const textExtensions = new Set([
		'ts',
		'tsx',
		'js',
		'jsx',
		'mjs',
		'cjs',
		'json',
		'svelte',
		'md',
		'txt',
		'log',
		'css',
		'html',
		'htm',
		'yml',
		'yaml',
		'xml',
		'sh',
		'ps1',
		'bat',
		'py',
		'java',
		'c',
		'cpp',
		'cxx',
		'h',
		'hpp',
		'rs',
		'go',
		'php',
		'rb',
		'cs',
		'sql',
		'ini',
		'toml',
		'env'
	]);
	const textFileNames = new Set(['.gitignore', '.npmrc', '.env', '.editorconfig']);

	function pushToast(title: string, message: string, tone: ToastItem['tone'] = 'error') {
		const id = ++toastId;
		toasts = [...toasts, { id, title, message, tone }];
		setTimeout(() => {
			toasts = toasts.filter((item) => item.id !== id);
		}, 4200);
	}

	function dismissToast(id: number) {
		toasts = toasts.filter((item) => item.id !== id);
	}

	function getErrorStatusCode(error: unknown) {
		return typeof error === 'object' && error !== null && 'statusCode' in error
			? Number((error as { statusCode: number }).statusCode)
			: null;
	}

	function handleLogout(skipToast = false) {
		clearAuthToken();
		currentUser = null;
		currentPermissions = [];
		adminUsers = [];
		permissionDraftUserId = '';
		permissionDraftPath = '';
		permissionDraftLevel = 'read';
		listing = { currentPath: '/', parentPath: null, entries: [] };
		selectedFilePath = '';
		filterQuery = '';
		terminalCwd = undefined;
		terminalSessionKey = 0;
		isTerminalVisible = false;
		isEditorModalOpen = false;
		isLoadingArchive = false;
		openTabs = [];
		activeTabPath = '';
		previewState = { isOpen: false, title: '', kind: 'other', src: '', archiveEntries: [] };
		contextMenu = { isOpen: false, x: 0, y: 0, entry: null };
		dragTargetPath = '';
		if (!skipToast) {
			pushToast('Logged out', 'Your session was cleared.', 'info');
		}
	}

	function handleApiFailure(title: string, error: unknown, fallbackMessage: string) {
		const statusCode = getErrorStatusCode(error);
		if (statusCode === 401) {
			handleLogout(true);
			pushToast('Session expired', 'Please log in again.');
			return;
		}
		pushToast(title, error instanceof Error ? error.message : fallbackMessage);
	}

	async function refreshAdminUsers() {
		if (currentUser?.role !== 'admin') {
			adminUsers = [];
			permissionDraftUserId = '';
			return;
		}

		isAdminLoading = true;
		try {
			const response = await getAdminUsers();
			adminUsers = response.users;
			if (!permissionDraftUserId) {
				permissionDraftUserId = String(response.users.find((user) => user.role !== 'admin')?.id ?? response.users[0]?.id ?? '');
			}
		} catch (error) {
			handleApiFailure('Unable to load users', error, 'Unable to load users');
		} finally {
			isAdminLoading = false;
		}
	}

	async function loadDirectory(path = '/') {
		if (!currentUser) {
			return;
		}

		isLoading = true;
		try {
			listing = await getDirectoryListing(path);
		} catch (error) {
			const isRecoverableDirectoryError =
				error instanceof DirectoryRequestError &&
				path !== '/' &&
				(error.statusCode === 400 || error.statusCode === 404);

			if (isRecoverableDirectoryError) {
				try {
					listing = await getDirectoryListing('/');
					pushToast('Directory unavailable', 'Requested directory is unavailable. Returned to your accessible roots.');
					return;
				} catch (rootError) {
					handleApiFailure('Unable to load roots', rootError, 'Unable to load roots');
					return;
				}
			}

			handleApiFailure('Unable to load directory', error, 'Unable to load directory');
		} finally {
			isLoading = false;
		}
	}

	async function hydrateSession() {
		const token = getAuthToken();
		if (!token) {
			isAuthLoading = false;
			return;
		}

		try {
			const session = await getCurrentSession();
			currentUser = session.user;
			currentPermissions = session.permissions;
			isAdminPanelOpen = session.user.role === 'admin';
			await loadDirectory('/');
			if (session.user.role === 'admin') {
				await refreshAdminUsers();
			}
		} catch (error) {
			clearAuthToken();
			pushToast('Session cleared', error instanceof Error ? error.message : 'Please log in again.');
		} finally {
			isAuthLoading = false;
		}
	}

	async function handleAuthSubmit() {
		if (!authUsername.trim() || !authPassword) {
			pushToast('Credentials required', 'Enter both username and password.');
			return;
		}

		isAuthenticating = true;
		try {
			const response: AuthResponse = authMode === 'register'
				? await registerUser(authUsername.trim(), authPassword)
				: await loginUser(authUsername.trim(), authPassword);
			setAuthToken(response.token);
			authPassword = '';
			const session = await getCurrentSession();
			currentUser = session.user;
			currentPermissions = session.permissions;
			isAdminPanelOpen = session.user.role === 'admin';
			await loadDirectory('/');
			if (session.user.role === 'admin') {
				await refreshAdminUsers();
			}
			pushToast(authMode === 'register' ? 'Registration complete' : 'Logged in', `Signed in as ${session.user.username}.`, 'info');
		} catch (error) {
			handleApiFailure(
				authMode === 'register' ? 'Registration failed' : 'Login failed',
				error,
				authMode === 'register' ? 'Unable to register user' : 'Unable to log in'
			);
		} finally {
			isAuthenticating = false;
		}
	}

	async function handlePermissionSave() {
		if (!permissionDraftUserId || !permissionDraftPath.trim()) {
			pushToast('Permission details required', 'Choose a user and enter an absolute path.');
			return;
		}

		try {
			await savePermission(Number(permissionDraftUserId), permissionDraftPath.trim(), permissionDraftLevel);
			permissionDraftPath = '';
			pushToast('Permission saved', 'The permission entry was updated.', 'info');
			await refreshAdminUsers();
		} catch (error) {
			handleApiFailure('Unable to save permission', error, 'Unable to save permission');
		}
	}

	async function handlePermissionDelete(id: number) {
		try {
			await deletePermission(id);
			pushToast('Permission removed', 'The permission entry was deleted.', 'info');
			await refreshAdminUsers();
		} catch (error) {
			handleApiFailure('Unable to remove permission', error, 'Unable to remove permission');
		}
	}

	function getExtension(filePath: string) {
		const fileName = filePath.split('/').at(-1) ?? filePath;
		const index = fileName.lastIndexOf('.');
		return index <= 0 ? '' : fileName.slice(index + 1).toLowerCase();
	}

	function getFileType(filePath: string): 'editor' | 'image' | 'video' | 'audio' | 'archive' | 'document' | 'other' {
		const fileName = filePath.split('/').at(-1)?.toLowerCase() ?? '';
		const extension = getExtension(filePath);
		if (textExtensions.has(extension) || textFileNames.has(fileName)) return 'editor';
		if (imageExtensions.has(extension)) return 'image';
		if (videoExtensions.has(extension)) return 'video';
		if (audioExtensions.has(extension)) return 'audio';
		if (archiveExtensions.has(extension)) return 'archive';
		if (documentExtensions.has(extension)) return 'document';
		return 'other';
	}

	function getLanguageFromPath(filePath: string) {
		const normalizedPath = filePath.toLowerCase();
		if (normalizedPath.endsWith('.ts') || normalizedPath.endsWith('.tsx')) return 'typescript';
		if (normalizedPath.endsWith('.js') || normalizedPath.endsWith('.mjs') || normalizedPath.endsWith('.cjs')) return 'javascript';
		if (normalizedPath.endsWith('.json')) return 'json';
		if (normalizedPath.endsWith('.svelte') || normalizedPath.endsWith('.html')) return 'html';
		if (normalizedPath.endsWith('.md')) return 'markdown';
		if (normalizedPath.endsWith('.css')) return 'css';
		if (normalizedPath.endsWith('.yml') || normalizedPath.endsWith('.yaml')) return 'yaml';
		if (normalizedPath.endsWith('.xml')) return 'xml';
		if (normalizedPath.endsWith('.sh') || normalizedPath.endsWith('.ps1') || normalizedPath.endsWith('.bat')) return 'shell';
		return 'plaintext';
	}

	function formatBytes(value: number) {
		if (value < 1024) return `${value} B`;
		const units = ['KB', 'MB', 'GB', 'TB'];
		let size = value / 1024;
		let index = 0;
		while (size >= 1024 && index < units.length - 1) {
			size /= 1024;
			index += 1;
		}
		return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[index]}`;
	}

	function isAffectedPath(candidatePath: string, targetPath: string) {
		return candidatePath === targetPath || candidatePath.startsWith(`${targetPath}/`);
	}

	function remapPath(candidatePath: string, fromPath: string, toPath: string) {
		if (candidatePath === fromPath) return toPath;
		if (candidatePath.startsWith(`${fromPath}/`)) return `${toPath}${candidatePath.slice(fromPath.length)}`;
		return candidatePath;
	}

	function syncPathsAfterMutation(fromPath: string, result: FileOperationResult) {
		openTabs = openTabs.map((tab) => {
			const nextPath = remapPath(tab.path, fromPath, result.path);
			return nextPath === tab.path ? tab : { ...tab, path: nextPath, name: nextPath.split('/').at(-1) ?? tab.name };
		});
		activeTabPath = remapPath(activeTabPath, fromPath, result.path);
		selectedFilePath = remapPath(selectedFilePath, fromPath, result.path);
		if (previewState.isOpen && isAffectedPath(selectedFilePath, fromPath)) {
			previewState = { ...previewState, isOpen: false };
		}
	}

	function clearDeletedPath(targetPath: string) {
		const wasActiveDeleted = isAffectedPath(activeTabPath, targetPath);
		const wasSelectedDeleted = isAffectedPath(selectedFilePath, targetPath);
		const nextTabs = openTabs.filter((tab) => !isAffectedPath(tab.path, targetPath));
		openTabs = nextTabs;
		if (wasActiveDeleted) activeTabPath = nextTabs.at(-1)?.path ?? '';
		if (wasSelectedDeleted) selectedFilePath = activeTabPath;
		if (previewState.isOpen && wasSelectedDeleted) previewState = { ...previewState, isOpen: false };
	}

	function hasFileDragPayload(event: DragEvent) {
		return Array.from(event.dataTransfer?.types ?? []).includes('Files');
	}

	function clearDragState() {
		dragTargetPath = '';
	}

	function getPathSegments(currentPath: string) {
		if (currentPath === '/') {
			return [{ label: 'Accessible roots', path: '/' }];
		}
		const parts = currentPath.split('/').filter(Boolean);
		let accumulator = '';
		return [
			{ label: 'Accessible roots', path: '/' },
			...parts.map((part, index) => {
				accumulator = index === 0 ? part : `${accumulator}/${part}`;
				return { label: part, path: accumulator.includes(':') ? accumulator : `/${accumulator}` };
			})
		];
	}

	async function openEditorFile(filePath: string) {
		selectedFilePath = filePath;
		const existingTab = openTabs.find((tab) => tab.path === filePath);
		if (existingTab) {
			activeTabPath = existingTab.path;
			return;
		}
		try {
			const file = await getTextFileContent(filePath);
			const tab: EditorTab = { ...file, language: getLanguageFromPath(file.path), draftContent: file.content, isDirty: false };
			openTabs = [...openTabs, tab];
			activeTabPath = tab.path;
			isEditorModalOpen = false;
		} catch (error) {
			handleApiFailure('Unable to open file', error, 'Unable to load file');
		}
	}

	async function openPreview(entry: FileEntry) {
		selectedFilePath = entry.path;
		const fileType = getFileType(entry.path);
		if (fileType === 'archive') {
			isLoadingArchive = true;
			try {
				const preview = await getArchivePreview(entry.path);
				previewState = { isOpen: true, title: preview.name, kind: 'archive', src: '', archiveEntries: preview.entries };
			} catch (error) {
				handleApiFailure('Unable to preview archive', error, 'Unable to inspect archive');
			} finally {
				isLoadingArchive = false;
			}
			return;
		}
		if (fileType === 'other') {
			pushToast('No inline preview', 'This file type is not previewed inline yet. Use download from the context menu.', 'info');
			return;
		}
		if (fileType === 'editor') {
			await openEditorFile(entry.path);
			return;
		}
		previewState = { isOpen: true, title: entry.name, kind: fileType, src: getFileBlobUrl(entry.path), archiveEntries: [] };
	}

	async function openEntry(entry: FileEntry) {
		closeContextMenu();
		if (!entry.isAccessible) {
			pushToast('Restricted item', `${entry.name} is not accessible with the current filesystem permissions.`);
			return;
		}
		if (entry.type === 'directory') {
			selectedFilePath = entry.path;
			await loadDirectory(entry.path);
			return;
		}
		if (getFileType(entry.path) === 'editor') {
			await openEditorFile(entry.path);
			return;
		}
		await openPreview(entry);
	}

	function handleEditorChange(value: string) {
		openTabs = openTabs.map((tab) =>
			tab.path === activeTabPath ? { ...tab, draftContent: value, isDirty: value !== tab.content } : tab
		);
	}

	async function saveActiveTab() {
		if (!activeTab) return;
		try {
			const saved = await saveTextFileContent(activeTab.path, activeTab.draftContent);
			openTabs = openTabs.map((tab) =>
				tab.path === activeTab.path
					? { ...tab, content: activeTab.draftContent, size: saved.size, modifiedAt: saved.modifiedAt, isDirty: false }
					: tab
			);
			pushToast('File saved', `${activeTab.name} was saved successfully.`, 'info');
			await loadDirectory(listing.currentPath);
		} catch (error) {
			handleApiFailure('Save failed', error, 'Unable to save file');
		}
	}

	function closeTab(path: string) {
		const nextTabs = openTabs.filter((tab) => tab.path !== path);
		openTabs = nextTabs;
		if (activeTabPath === path) activeTabPath = nextTabs.at(-1)?.path ?? '';
		if (selectedFilePath === path) selectedFilePath = activeTabPath;
	}

	function openTerminalHere(path = listing.currentPath) {
		terminalCwd = path === '/' ? undefined : path;
		terminalSessionKey += 1;
		isTerminalVisible = true;
	}

	function toggleTerminal() {
		isTerminalVisible = !isTerminalVisible;
		if (isTerminalVisible && terminalSessionKey === 0) openTerminalHere();
	}

	function handleTerminalError(message: string) {
		pushToast('Terminal unavailable', message);
	}

	function downloadItem(itemPath: string) {
		const link = document.createElement('a');
		link.href = getDownloadUrl(itemPath);
		link.rel = 'noopener';
		link.click();
	}

	function triggerUploadFiles(destinationPath: string) {
		uploadTargetPath = destinationPath;
		fileUploadInput.value = '';
		fileUploadInput.click();
	}

	function triggerUploadFolder(destinationPath: string) {
		uploadTargetPath = destinationPath;
		folderUploadInput.value = '';
		folderUploadInput.click();
	}

	async function uploadSelectedFiles(destinationPath: string, files: FileList | null, isFolderUpload: boolean) {
		if (!files || files.length === 0) return;
		const items: UploadItem[] = Array.from(files).map((file) => {
			const relativePath =
				isFolderUpload && (file as File & { webkitRelativePath?: string }).webkitRelativePath
					? (file as File & { webkitRelativePath?: string }).webkitRelativePath!
					: file.name;
			return { file, relativePath };
		});
		try {
			const result = await uploadFilesToDirectory(destinationPath, items);
			pushToast('Upload complete', `${result.uploaded.length} item${result.uploaded.length === 1 ? '' : 's'} uploaded successfully.`, 'info');
			clearDragState();
			await loadDirectory(listing.currentPath);
		} catch (error) {
			handleApiFailure('Upload failed', error, 'Unable to upload files');
		}
	}

	function handleFileInputChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		void uploadSelectedFiles(uploadTargetPath, input.files, false);
	}

	function handleFolderInputChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		void uploadSelectedFiles(uploadTargetPath, input.files, true);
	}

	function handleDragOver(event: DragEvent, destinationPath: string) {
		if (!hasFileDragPayload(event)) return;
		event.preventDefault();
		dragTargetPath = destinationPath;
	}

	function handleDragLeave(event: DragEvent, destinationPath: string) {
		const nextTarget = event.relatedTarget;
		if (nextTarget instanceof Node && (event.currentTarget as Node | null)?.contains(nextTarget)) return;
		if (dragTargetPath === destinationPath) clearDragState();
	}

	async function handleDropUpload(event: DragEvent, destinationPath: string) {
		if (!hasFileDragPayload(event)) return;
		event.preventDefault();
		await uploadSelectedFiles(destinationPath, event.dataTransfer?.files ?? null, false);
	}

	async function renameEntry(entry: FileEntry) {
		const requestedName = window.prompt(`Rename ${entry.name} to:`, entry.name)?.trim();
		if (!requestedName || requestedName === entry.name) return;
		try {
			const result = await renameFileSystemItem(entry.path, requestedName);
			syncPathsAfterMutation(entry.path, result);
			pushToast('Item renamed', `${entry.name} was renamed to ${result.name}.`, 'info');
			await loadDirectory(listing.currentPath);
		} catch (error) {
			handleApiFailure('Rename failed', error, 'Unable to rename item');
		}
	}

	async function moveEntry(entry: FileEntry) {
		const destinationPath = window.prompt(`Move ${entry.name} to absolute destination folder:`, listing.currentPath)?.trim();
		if (!destinationPath) return;
		try {
			const result = await moveFileSystemItem(entry.path, destinationPath);
			syncPathsAfterMutation(entry.path, result);
			pushToast('Item moved', `${entry.name} was moved to ${destinationPath}.`, 'info');
			await loadDirectory(listing.currentPath);
		} catch (error) {
			handleApiFailure('Move failed', error, 'Unable to move item');
		}
	}

	async function deleteEntry(entry: FileEntry) {
		if (!window.confirm(`Delete ${entry.name}? This cannot be undone.`)) return;
		try {
			await deleteFileSystemItem(entry.path);
			clearDeletedPath(entry.path);
			pushToast('Item deleted', `${entry.name} was removed.`, 'info');
			await loadDirectory(listing.currentPath);
		} catch (error) {
			handleApiFailure('Delete failed', error, 'Unable to delete item');
		}
	}

	function getContextActions(entry: FileEntry) {
		const baseActions = [
			{ id: 'open', label: entry.type === 'directory' ? 'Open folder' : 'Open' },
			{ id: 'download', label: entry.type === 'directory' ? 'Download folder (.zip)' : 'Download file' },
			{ id: 'rename', label: 'Rename' },
			{ id: 'move', label: 'Move' },
			{ id: 'delete', label: 'Delete' }
		];
		if (entry.type === 'directory') {
			return [...baseActions, { id: 'terminal', label: 'Open terminal here' }, { id: 'upload-files', label: 'Upload files here' }, { id: 'upload-folder', label: 'Upload folder here' }];
		}
		const fileType = getFileType(entry.path);
		const extraActions: Array<{ id: string; label: string }> = [];
		if (fileType !== 'other' && fileType !== 'editor') extraActions.push({ id: 'preview', label: 'Preview' });
		if (fileType === 'editor') extraActions.push({ id: 'open-editor', label: 'Open in editor tab' });
		return [...baseActions, ...extraActions, { id: 'upload-files', label: 'Upload files to current folder' }];
	}

	async function handleContextAction(actionId: string) {
		const entry = contextMenu.entry;
		closeContextMenu();
		if (!entry) return;
		switch (actionId) {
			case 'open':
			case 'open-editor':
				await openEntry(entry);
				return;
			case 'preview':
				await openPreview(entry);
				return;
			case 'download':
				downloadItem(entry.path);
				return;
			case 'terminal':
				openTerminalHere(entry.path);
				return;
			case 'upload-files':
				triggerUploadFiles(entry.type === 'directory' ? entry.path : listing.currentPath);
				return;
			case 'upload-folder':
				triggerUploadFolder(entry.type === 'directory' ? entry.path : listing.currentPath);
				return;
			case 'rename':
				await renameEntry(entry);
				return;
			case 'move':
				await moveEntry(entry);
				return;
			case 'delete':
				await deleteEntry(entry);
				return;
		}
	}

	function openContextMenu(event: MouseEvent, entry: FileEntry) {
		event.preventDefault();
		contextMenu = { isOpen: true, x: event.clientX, y: event.clientY, entry };
	}

	function closeContextMenu() {
		contextMenu = { isOpen: false, x: 0, y: 0, entry: null };
	}

	$: activeTab = openTabs.find((tab) => tab.path === activeTabPath) ?? null;
	$: breadcrumbs = getPathSegments(listing.currentPath);
	$: filteredEntries = listing.entries.filter((entry) => {
		const query = filterQuery.trim().toLowerCase();
		return !query || entry.name.toLowerCase().includes(query);
	});
	$: selectedEntry = listing.entries.find((entry) => entry.path === selectedFilePath) ?? null;
	$: contextActions = contextMenu.entry ? getContextActions(contextMenu.entry) : [];

	onMount(() => {
		const handleWindowClick = () => closeContextMenu();
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				closeContextMenu();
				previewState = { ...previewState, isOpen: false };
				isEditorModalOpen = false;
			}
		};
		window.addEventListener('click', handleWindowClick);
		window.addEventListener('keydown', handleEscape);
		window.addEventListener('dragend', clearDragState);
		window.addEventListener('drop', clearDragState);
		void hydrateSession();
		return () => {
			window.removeEventListener('click', handleWindowClick);
			window.removeEventListener('keydown', handleEscape);
			window.removeEventListener('dragend', clearDragState);
			window.removeEventListener('drop', clearDragState);
		};
	});
</script>

<svelte:head>
	<title>Node Explorer</title>
	<meta name="description" content="Authenticated explorer workspace with registration, login, role-based access, permission management, typed file opening, and terminal access." />
</svelte:head>

<div class="app-shell">
	<ToastStack items={toasts} onDismiss={dismissToast} />

	{#if isAuthLoading}
		<section class="auth-shell panel">
			<div class="auth-copy">
				<p class="eyebrow">Node Explorer</p>
				<h1>Loading session</h1>
				<p class="meta">Checking your saved token and available workspace permissions.</p>
			</div>
		</section>
	{:else if !currentUser}
		<section class="auth-shell panel">
			<div class="auth-copy">
				<p class="eyebrow">Node Explorer</p>
				<h1>{authMode === 'register' ? 'Create your account' : 'Sign in to the server'}</h1>
				<p class="meta">The first registered account becomes the administrator. Administrators can grant per-path read or write access to other users.</p>
			</div>
			<form class="auth-form" onsubmit={(event) => {
				event.preventDefault();
				void handleAuthSubmit();
			}}>
				<label class="field-block">
					<span>Username</span>
					<input bind:value={authUsername} class="text-input" placeholder="admin" autocomplete="username" />
				</label>
				<label class="field-block">
					<span>Password</span>
					<input bind:value={authPassword} class="text-input" type="password" placeholder="At least 8 characters" autocomplete={authMode === 'login' ? 'current-password' : 'new-password'} />
				</label>
				<div class="auth-actions">
					<button type="submit" class="compact" disabled={isAuthenticating}>
						<LockKeyhole size={15} />
						{isAuthenticating ? 'Working...' : authMode === 'register' ? 'Register' : 'Login'}
					</button>
					<button type="button" class="ghost compact" onclick={() => (authMode = authMode === 'login' ? 'register' : 'login')}>
						{authMode === 'login' ? 'Need an account?' : 'Already have an account?'}
					</button>
				</div>
			</form>
		</section>
	{:else}
		<input bind:this={fileUploadInput} type="file" multiple hidden onchange={handleFileInputChange} />
		<input bind:this={folderUploadInput} type="file" multiple hidden webkitdirectory onchange={handleFolderInputChange} />

		<FileContextMenu isOpen={contextMenu.isOpen} x={contextMenu.x} y={contextMenu.y} title={contextMenu.entry?.name ?? ''} actions={contextActions} onSelect={handleContextAction} />
		<FilePreviewModal isOpen={previewState.isOpen} title={previewState.title} kind={previewState.kind} src={previewState.src} archiveEntries={previewState.archiveEntries} onClose={() => (previewState = { ...previewState, isOpen: false })} />

		<header class="topbar">
			<div class="brand-block">
				<div class="brand-icon">
					<LayoutPanelLeft size={18} />
				</div>
				<div>
					<p class="eyebrow">Node Explorer</p>
					<h1>Server workspace</h1>
				</div>
			</div>
			<div class="topbar-actions">
				<div class="user-pill">
					<UserRound size={15} />
					<span>{currentUser.username}</span>
					<strong>{currentUser.role}</strong>
				</div>
				{#if currentUser.role === 'admin'}
					<button type="button" class="ghost compact" onclick={() => {
						isAdminPanelOpen = !isAdminPanelOpen;
						if (isAdminPanelOpen) {
							void refreshAdminUsers();
						}
					}}>
						<Shield size={15} />
						{isAdminPanelOpen ? 'Hide access panel' : 'Show access panel'}
					</button>
				{/if}
				<button type="button" class="ghost compact" onclick={() => handleLogout()}>
					<LogOut size={15} />
					Logout
				</button>
			</div>
		</header>

		<section class="workspace-frame">
			<aside class="sidebar panel">
				<div class="sidebar-top">
					<div>
						<p class="label">Location</p>
						<div class="location-chip">
							<HardDrive size={16} />
							<strong>{listing.currentPath}</strong>
						</div>
					</div>
					<div class="sidebar-actions">
						<button type="button" class="ghost compact" onclick={() => loadDirectory(listing.currentPath)}>
							<RefreshCw size={15} />
							Refresh
						</button>
						<button type="button" class="ghost compact" disabled={!listing.parentPath} onclick={() => loadDirectory(listing.parentPath ?? '/')}>
							<ChevronUp size={15} />
							Up
						</button>
					</div>
				</div>

				<div class="permission-summary">
					<p class="label">Permissions</p>
					<p class="meta">{currentUser.role === 'admin' ? 'Administrator access grants full control across all paths.' : currentPermissions.length > 0 ? `${currentPermissions.length} explicit path permission${currentPermissions.length === 1 ? '' : 's'} assigned.` : 'No explicit path access has been assigned yet.'}</p>
				</div>

				{#if currentUser.role === 'admin' && isAdminPanelOpen}
					<section class="admin-panel">
						<div class="admin-header">
							<div>
								<p class="label">Access control</p>
								<h2>Users and path rules</h2>
							</div>
							<button type="button" class="ghost compact" onclick={() => refreshAdminUsers()}>
								<RefreshCw size={15} />
								Reload
							</button>
						</div>

						<div class="permission-form">
							<select bind:value={permissionDraftUserId} class="text-input select-input">
								<option value="">Select user</option>
								{#each adminUsers as user (user.id)}
									<option value={String(user.id)}>{user.username} ({user.role})</option>
								{/each}
							</select>
							<input bind:value={permissionDraftPath} class="text-input" placeholder="D:/node/project" />
							<select bind:value={permissionDraftLevel} class="text-input select-input">
								<option value="read">read</option>
								<option value="write">write</option>
							</select>
							<button type="button" class="compact" onclick={handlePermissionSave}>Save rule</button>
						</div>

						{#if isAdminLoading}
							<p class="notice slim">Loading users and permissions...</p>
						{:else}
							<div class="admin-user-list">
								{#each adminUsers as user (user.id)}
									<div class="admin-user-card">
										<div class="admin-user-heading">
											<div>
												<strong>{user.username}</strong>
												<span>{user.role}</span>
											</div>
											<small>{new Date(user.createdAt).toLocaleDateString()}</small>
										</div>
										{#if user.permissions.length === 0}
											<p class="meta">No explicit paths assigned.</p>
										{:else}
											<div class="permission-list">
												{#each user.permissions as permission (permission.id)}
													<div class="permission-pill">
														<div>
															<strong>{permission.level}</strong>
															<span>{permission.path}</span>
														</div>
														<button type="button" class="ghost compact danger" onclick={() => handlePermissionDelete(permission.id)}>Remove</button>
													</div>
												{/each}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</section>
				{/if}

				<nav class="breadcrumbs" aria-label="Breadcrumbs">
					{#each breadcrumbs as crumb, index (crumb.path)}
						<button type="button" class="crumb" onclick={() => loadDirectory(crumb.path)}>{crumb.label}</button>
						{#if index < breadcrumbs.length - 1}
							<span class="crumb-separator">/</span>
						{/if}
					{/each}
				</nav>

				<label class="search-shell">
					<Search size={15} />
					<input bind:value={filterQuery} placeholder="Filter current folder" />
				</label>

				{#if isLoading}
					<p class="notice">Loading directory contents...</p>
				{:else if filteredEntries.length === 0}
					<p class="notice" class:drop-target={dragTargetPath === listing.currentPath} ondragover={(event) => handleDragOver(event, listing.currentPath)} ondragleave={(event) => handleDragLeave(event, listing.currentPath)} ondrop={(event) => handleDropUpload(event, listing.currentPath)}>
						{filterQuery ? 'No items match the current filter.' : 'This directory is empty.'}
					</p>
				{:else}
					<div class="explorer-list" class:drop-target={dragTargetPath === listing.currentPath} role="list" ondragover={(event) => handleDragOver(event, listing.currentPath)} ondragleave={(event) => handleDragLeave(event, listing.currentPath)} ondrop={(event) => handleDropUpload(event, listing.currentPath)}>
						{#each filteredEntries as entry (entry.path)}
							<button type="button" class="item-card" class:selected={entry.path === selectedFilePath} class:directory={entry.type === 'directory'} class:drop-target={entry.type === 'directory' && dragTargetPath === entry.path} class:restricted={!entry.isAccessible} onclick={() => openEntry(entry)} oncontextmenu={(event) => openContextMenu(event, entry)} ondragover={(event) => entry.type === 'directory' && handleDragOver(event, entry.path)} ondragleave={(event) => entry.type === 'directory' && handleDragLeave(event, entry.path)} ondrop={(event) => entry.type === 'directory' && handleDropUpload(event, entry.path)}>
								<div class="item-main">
									<div class="item-icon">
										{#if entry.type === 'directory'}
											<Folder size={16} />
										{:else if getFileType(entry.path) === 'image'}
											<ImageIcon size={16} />
										{:else if getFileType(entry.path) === 'video'}
											<Video size={16} />
										{:else if getFileType(entry.path) === 'audio'}
											<Music4 size={16} />
										{:else if getFileType(entry.path) === 'archive'}
											<FileArchive size={16} />
										{:else if getFileType(entry.path) === 'document'}
											<FileText size={16} />
										{:else if getFileType(entry.path) === 'editor'}
											<FileCode2 size={16} />
										{:else}
											<File size={16} />
										{/if}
									</div>
									<div class="item-copy">
										<strong>{entry.name}</strong>
										<span>{#if !entry.isAccessible}Restricted item{:else if entry.type === 'directory'}Folder{:else}{formatBytes(entry.size)}{/if}</span>
									</div>
								</div>
								<time>{new Date(entry.modifiedAt).toLocaleDateString()}</time>
							</button>
						{/each}
					</div>
				{/if}
			</aside>

			<section class="content-area">
				<div class="content-toolbar panel compact-panel">
					<div class="toolbar-copy">
						<p class="label">Focused item</p>
						<h2>{activeTab?.name ?? selectedEntry?.name ?? 'No item open'}</h2>
						<p class="meta">{activeTab?.path ?? selectedEntry?.path ?? 'Open code or text files into tabs. Media, PDF, and zip files open in preview overlays.'}</p>
					</div>
					<div class="toolbar-actions">
						{#if selectedEntry}
							<button type="button" class="ghost compact" onclick={() => downloadItem(selectedEntry.path)}><Download size={15} />Download</button>
							<button type="button" class="ghost compact" onclick={() => renameEntry(selectedEntry)}>Rename</button>
							<button type="button" class="ghost compact" onclick={() => moveEntry(selectedEntry)}>Move</button>
							<button type="button" class="ghost compact danger" onclick={() => deleteEntry(selectedEntry)}>Delete</button>
						{/if}
						<button type="button" class="ghost compact" onclick={() => triggerUploadFiles(listing.currentPath)}><Upload size={15} />Upload files</button>
						<button type="button" class="ghost compact" onclick={() => triggerUploadFolder(listing.currentPath)}><FolderUp size={15} />Upload folder</button>
						{#if activeTab}
							<button type="button" class="ghost compact" onclick={() => (isEditorModalOpen = true)}><FileCode2 size={15} />Pop out editor</button>
							<button type="button" class="compact" disabled={!activeTab.isDirty} onclick={saveActiveTab}><Save size={15} />Save</button>
						{/if}
						<button type="button" class:active-toggle={isTerminalVisible} class="ghost compact" onclick={toggleTerminal}><SquareTerminal size={15} />{isTerminalVisible ? 'Hide terminal' : 'Show terminal'}</button>
					</div>
				</div>

				<section class="editor-panel panel">
					{#if activeTab}
						<div class="editor-stack">
							<div class="tab-strip">
								<div class="tabs-row">
									{#each openTabs as tab (tab.path)}
										<button type="button" class="editor-tab" class:active={tab.path === activeTabPath} onclick={() => {
											activeTabPath = tab.path;
											selectedFilePath = tab.path;
										}}>
											<FileCode2 size={14} />
											<span>{tab.name}</span>
											{#if tab.isDirty}<em>edited</em>{/if}
											<span class="close-tab" role="button" tabindex="0" onclick={(event) => {
												event.stopPropagation();
												closeTab(tab.path);
											}} onkeydown={(event) => {
												if (event.key === 'Enter' || event.key === ' ') {
													event.preventDefault();
													closeTab(tab.path);
												}
											}}>×</span>
										</button>
									{/each}
								</div>
								<div class="editor-stats">
									<span>{activeTab.language}</span>
									<span>{formatBytes(activeTab.size)}</span>
									<span>{new Date(activeTab.modifiedAt).toLocaleString()}</span>
								</div>
							</div>
							<div class="editor-frame attached-editor">
								<CodeEditor value={activeTab.draftContent} language={activeTab.language} onChange={handleEditorChange} />
							</div>
						</div>
					{:else if isLoadingArchive}
						<p class="notice">Loading archive preview...</p>
					{:else}
						<div class="empty-state">
							<FileCode2 size={28} />
							<h3>Permission-aware workspace</h3>
							<p>Your visible roots and file operations are governed by the current account role and assigned path permissions.</p>
						</div>
					{/if}
				</section>
			</section>
		</section>

		{#if isTerminalVisible}
			<section class="terminal-tray panel">
				<header class="tray-header">
					<div>
						<p class="label">Terminal</p>
						<h2>Attached console</h2>
						<p class="meta">Connected to the current folder with cmd.exe on Windows.</p>
					</div>
					<div class="toolbar-actions">
						<button type="button" class="ghost compact" onclick={() => openTerminalHere(listing.currentPath)}><RefreshCw size={15} />Reconnect here</button>
						<button type="button" class="ghost compact" onclick={toggleTerminal}><X size={15} />Hide</button>
					</div>
				</header>
				{#key terminalSessionKey}
					<Terminal cwd={terminalCwd} onError={handleTerminalError} />
				{/key}
			</section>
		{/if}

		{#if isEditorModalOpen && activeTab}
			<div class="modal-backdrop" role="button" tabindex="0" aria-label="Close editor overlay" onclick={() => (isEditorModalOpen = false)} onkeydown={(event) => event.key === 'Escape' && (isEditorModalOpen = false)}>
				<div class="modal-panel" role="dialog" tabindex="-1" aria-modal="true" aria-label="Editor popout" onclick={(event) => event.stopPropagation()} onkeydown={(event) => event.stopPropagation()}>
					<header class="modal-header">
						<div>
							<p class="label">Editor popout</p>
							<h2>{activeTab.name}</h2>
							<p class="meta">{activeTab.path}</p>
						</div>
						<div class="toolbar-actions">
							<button type="button" class="ghost compact" onclick={() => (isEditorModalOpen = false)}><X size={15} />Close overlay</button>
							<button type="button" class="compact" disabled={!activeTab.isDirty} onclick={saveActiveTab}><Save size={15} />Save</button>
						</div>
					</header>
					<div class="editor-frame modal-editor">
						<CodeEditor value={activeTab.draftContent} language={activeTab.language} onChange={handleEditorChange} />
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
		min-height: 100vh;
		background:
			radial-gradient(circle at top left, rgba(91, 150, 255, 0.14), transparent 28%),
			radial-gradient(circle at bottom right, rgba(53, 196, 143, 0.08), transparent 24%),
			linear-gradient(180deg, #08111d 0%, #0b1524 100%);
		font-family: 'Inter Variable', 'Segoe UI', sans-serif;
	}

	:global(*) {
		box-sizing: border-box;
	}

	h1,
	h2,
	h3,
	p {
		margin: 0;
	}

	button,
	input,
	select {
		font: inherit;
	}

	.app-shell {
		max-width: 1520px;
		margin: 0 auto;
		padding: 18px;
		color: #edf3ff;
	}

	.auth-shell {
		max-width: 780px;
		margin: 8vh auto 0;
		padding: 28px;
		display: grid;
		gap: 22px;
	}

	.auth-copy {
		display: grid;
		gap: 10px;
	}

	.auth-form,
	.permission-form {
		display: grid;
		gap: 12px;
	}

	.auth-actions {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	.field-block {
		display: grid;
		gap: 8px;
		font-size: 0.9rem;
		color: #dbe8ff;
	}

	.text-input {
		width: 100%;
		padding: 11px 13px;
		border-radius: 12px;
		border: 1px solid rgba(136, 167, 219, 0.18);
		background: rgba(16, 28, 46, 0.9);
		color: #edf3ff;
	}

	.select-input {
		appearance: none;
	}

	.topbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 18px;
		margin-bottom: 14px;
	}

	.brand-block {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.brand-icon {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 14px;
		background: linear-gradient(145deg, #93caf9, #5c9cff);
		color: #05101d;
	}

	.eyebrow,
	.label {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: #89aee6;
	}

	h1 {
		font-size: 1.2rem;
		font-weight: 700;
	}

	h2 {
		font-size: 1.05rem;
		font-weight: 650;
	}

	.panel {
		border: 1px solid rgba(136, 167, 219, 0.16);
		border-radius: 22px;
		background: rgba(9, 18, 31, 0.84);
		box-shadow: 0 22px 44px rgba(4, 10, 20, 0.28);
		backdrop-filter: blur(16px);
	}

	.compact-panel,
	.sidebar,
	.editor-panel,
	.terminal-tray {
		padding: 16px;
	}

	.workspace-frame {
		display: grid;
		grid-template-columns: 400px minmax(0, 1fr);
		gap: 14px;
		min-height: calc(100vh - 170px);
	}

	.sidebar {
		display: flex;
		flex-direction: column;
		gap: 14px;
		min-height: 0;
	}

	.sidebar-top,
	.content-toolbar,
	.tray-header,
	.modal-header,
	.admin-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 14px;
	}

	.location-chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		max-width: 100%;
		padding: 10px 12px;
		margin-top: 8px;
		border-radius: 14px;
		background: rgba(107, 143, 204, 0.12);
		color: #dfe8fa;
	}

	.location-chip strong,
	.meta {
		word-break: break-all;
	}

	.permission-summary,
	.admin-panel {
		padding: 14px;
		border-radius: 18px;
		background: rgba(16, 28, 46, 0.72);
		border: 1px solid rgba(136, 167, 219, 0.12);
	}

	.admin-panel {
		display: grid;
		gap: 14px;
	}

	.admin-user-list,
	.permission-list {
		display: grid;
		gap: 10px;
	}

	.admin-user-card {
		padding: 12px;
		border-radius: 14px;
		background: rgba(8, 18, 32, 0.72);
		border: 1px solid rgba(136, 167, 219, 0.12);
		display: grid;
		gap: 10px;
	}

	.admin-user-heading {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		align-items: center;
	}

	.admin-user-heading strong,
	.permission-pill strong {
		display: block;
		color: #edf3ff;
	}

	.admin-user-heading span,
	.permission-pill span,
	.admin-user-heading small {
		color: #9fb5dc;
		font-size: 0.82rem;
	}

	.permission-pill {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		align-items: center;
		padding: 10px 12px;
		border-radius: 12px;
		background: rgba(16, 28, 46, 0.9);
	}

	.user-pill {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border-radius: 999px;
		background: rgba(16, 28, 46, 0.9);
		border: 1px solid rgba(136, 167, 219, 0.12);
	}

	.user-pill strong {
		padding: 4px 8px;
		border-radius: 999px;
		background: rgba(95, 160, 255, 0.18);
		text-transform: uppercase;
		font-size: 0.75rem;
	}

	.sidebar-actions,
	.topbar-actions,
	.toolbar-actions {
		display: flex;
		gap: 10px;
		align-items: center;
		flex-wrap: wrap;
	}

	button {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		border: 0;
		border-radius: 12px;
		padding: 11px 14px;
		background: linear-gradient(145deg, #95d3ff 0%, #6f9bff 100%);
		color: #08101d;
		font-weight: 650;
		cursor: pointer;
	}

	button.ghost {
		background: rgba(118, 151, 212, 0.12);
		border: 1px solid rgba(136, 167, 219, 0.16);
		color: #e4eeff;
	}

	button.compact {
		padding: 9px 12px;
		border-radius: 10px;
		font-size: 0.92rem;
	}

	button.active-toggle {
		background: rgba(65, 188, 132, 0.18);
		border-color: rgba(65, 188, 132, 0.22);
	}

	button.danger {
		color: #ffd9d6;
		background: rgba(138, 39, 39, 0.2);
		border: 1px solid rgba(220, 98, 98, 0.24);
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.breadcrumbs {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		padding: 12px 14px;
		border-radius: 16px;
		background: rgba(16, 28, 46, 0.78);
	}

	.crumb {
		padding: 0;
		border: 0;
		background: transparent;
		color: #dce7fa;
		font-weight: 600;
	}

	.crumb-separator {
		color: #6f88b6;
	}

	.search-shell {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border-radius: 14px;
		background: rgba(16, 28, 46, 0.78);
		color: #89aee6;
	}

	.search-shell input {
		width: 100%;
		border: 0;
		outline: 0;
		background: transparent;
		color: #edf3ff;
	}

	.explorer-list {
		display: grid;
		gap: 8px;
		overflow: auto;
		padding-right: 4px;
		min-height: 240px;
	}

	.explorer-list.drop-target,
	.notice.drop-target {
		outline: 2px dashed rgba(111, 213, 171, 0.75);
		outline-offset: 6px;
	}

	.item-card {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		padding: 12px 13px;
		border-radius: 16px;
		background: rgba(16, 28, 46, 0.72);
		border: 1px solid transparent;
		text-align: left;
		color: #edf3ff;
	}

	.item-card:hover,
	.item-card.selected {
		border-color: rgba(126, 181, 255, 0.38);
		background: rgba(20, 38, 63, 0.95);
	}

	.item-card.directory {
		background: linear-gradient(145deg, rgba(20, 47, 85, 0.95), rgba(17, 30, 48, 0.95));
	}

	.item-card.drop-target {
		border-color: rgba(111, 213, 171, 0.8);
		box-shadow: inset 0 0 0 1px rgba(111, 213, 171, 0.3);
	}

	.item-card.restricted {
		opacity: 0.8;
		border-style: dashed;
	}

	.item-main {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}

	.item-icon {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 11px;
		background: rgba(135, 169, 224, 0.12);
	}

	.item-copy {
		display: grid;
		gap: 3px;
		min-width: 0;
	}

	.item-copy strong,
	.item-copy span,
	.location-chip strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.item-copy span,
	.item-card time,
	.meta,
	.notice {
		font-size: 0.88rem;
		color: #aebfdf;
	}

	.notice {
		padding: 16px;
		border-radius: 16px;
		background: rgba(16, 28, 46, 0.9);
	}

	.notice.slim {
		padding: 10px 12px;
	}

	.content-area {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: 14px;
		min-width: 0;
	}

	.toolbar-copy {
		display: grid;
		gap: 6px;
		min-width: 0;
	}

	.editor-panel {
		min-height: 0;
		display: grid;
	}

	.editor-stack {
		display: grid;
		gap: 12px;
		height: 100%;
	}

	.tab-strip {
		display: grid;
		gap: 12px;
	}

	.tabs-row {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.editor-tab {
		padding: 10px 12px;
		border-radius: 12px;
		background: rgba(18, 34, 56, 0.88);
		color: #edf3ff;
	}

	.editor-tab.active {
		background: rgba(35, 72, 121, 0.96);
	}

	.editor-tab em {
		font-style: normal;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #6ce0a7;
	}

	.close-tab {
		font-size: 1rem;
		line-height: 1;
		opacity: 0.8;
	}

	.editor-stats {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		font-size: 0.84rem;
		color: #9fb5dc;
	}

	.editor-stats span {
		padding: 8px 10px;
		border-radius: 999px;
		background: rgba(118, 151, 212, 0.12);
	}

	.editor-frame {
		overflow: hidden;
		border-radius: 18px;
		border: 1px solid rgba(136, 167, 219, 0.16);
		background: #07111f;
	}

	.attached-editor {
		height: min(70vh, 760px);
	}

	.empty-state {
		display: grid;
		place-items: center;
		align-content: center;
		gap: 12px;
		text-align: center;
		min-height: 420px;
		color: #b8cae8;
	}

	.empty-state h3 {
		font-size: 1.25rem;
		color: #edf3ff;
	}

	.terminal-tray {
		margin-top: 14px;
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 24px;
		background: rgba(3, 8, 15, 0.72);
		backdrop-filter: blur(10px);
		z-index: 20;
	}

	.modal-panel {
		width: min(1100px, 100%);
		max-height: calc(100vh - 48px);
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: 14px;
		padding: 18px;
		border-radius: 24px;
		border: 1px solid rgba(136, 167, 219, 0.18);
		background: rgba(9, 18, 31, 0.96);
		box-shadow: 0 28px 72px rgba(0, 0, 0, 0.45);
	}

	.modal-editor {
		height: calc(100vh - 220px);
	}

	@media (max-width: 1180px) {
		.workspace-frame {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 760px) {
		.app-shell {
			padding: 12px;
		}

		.topbar,
		.sidebar-top,
		.content-toolbar,
		.tray-header,
		.modal-header,
		.admin-header,
		.permission-pill,
		.admin-user-heading {
			flex-direction: column;
		}

		.attached-editor {
			height: 54vh;
		}

		.modal-backdrop {
			padding: 12px;
		}

		.modal-editor {
			height: 58vh;
		}
	}
</style>

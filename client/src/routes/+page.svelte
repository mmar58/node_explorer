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
		Music4,
		RefreshCw,
		Save,
		Search,
		SquareTerminal,
		Upload,
		Video,
		X
	} from '@lucide/svelte';

	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import FileContextMenu from '$lib/components/FileContextMenu.svelte';
	import FilePreviewModal from '$lib/components/FilePreviewModal.svelte';
	import Terminal from '$lib/components/Terminal.svelte';
	import ToastStack from '$lib/components/ToastStack.svelte';
	import {
		DirectoryRequestError,
		getArchivePreview,
		getDirectoryListing,
		getDownloadUrl,
		getFileBlobUrl,
		getTextFileContent,
		saveTextFileContent,
		uploadFilesToDirectory,
		type ArchiveEntry,
		type FileContent,
		type FileEntry,
		type UploadItem
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

	let listing: FileListingState = {
		currentPath: '/',
		parentPath: null,
		entries: []
	};
	let isLoading = true;
	let selectedFilePath = '';
	let filterQuery = '';
	let terminalCwd: string | undefined = undefined;
	let terminalSessionKey = 0;
	let isTerminalVisible = false;
	let isEditorModalOpen = false;
	let isLoadingArchive = false;
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
	let fileUploadInput: HTMLInputElement;
	let folderUploadInput: HTMLInputElement;
	let uploadTargetPath = '/';

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

	function getExtension(filePath: string) {
		const fileName = filePath.split('/').at(-1) ?? filePath;
		const index = fileName.lastIndexOf('.');

		if (index <= 0) {
			return '';
		}

		return fileName.slice(index + 1).toLowerCase();
	}

	function getFileType(filePath: string): 'editor' | 'image' | 'video' | 'audio' | 'archive' | 'document' | 'other' {
		const fileName = filePath.split('/').at(-1)?.toLowerCase() ?? '';
		const extension = getExtension(filePath);

		if (textExtensions.has(extension) || textFileNames.has(fileName)) {
			return 'editor';
		}

		if (imageExtensions.has(extension)) {
			return 'image';
		}

		if (videoExtensions.has(extension)) {
			return 'video';
		}

		if (audioExtensions.has(extension)) {
			return 'audio';
		}

		if (archiveExtensions.has(extension)) {
			return 'archive';
		}

		if (documentExtensions.has(extension)) {
			return 'document';
		}

		return 'other';
	}

	function getLanguageFromPath(filePath: string) {
		const normalizedPath = filePath.toLowerCase();

		if (normalizedPath.endsWith('.ts') || normalizedPath.endsWith('.tsx')) {
			return 'typescript';
		}

		if (normalizedPath.endsWith('.js') || normalizedPath.endsWith('.mjs') || normalizedPath.endsWith('.cjs')) {
			return 'javascript';
		}

		if (normalizedPath.endsWith('.json')) {
			return 'json';
		}

		if (normalizedPath.endsWith('.svelte') || normalizedPath.endsWith('.html')) {
			return 'html';
		}

		if (normalizedPath.endsWith('.md')) {
			return 'markdown';
		}

		if (normalizedPath.endsWith('.css')) {
			return 'css';
		}

		if (normalizedPath.endsWith('.yml') || normalizedPath.endsWith('.yaml')) {
			return 'yaml';
		}

		if (normalizedPath.endsWith('.xml')) {
			return 'xml';
		}

		if (normalizedPath.endsWith('.sh') || normalizedPath.endsWith('.ps1') || normalizedPath.endsWith('.bat')) {
			return 'shell';
		}

		return 'plaintext';
	}

	function formatBytes(value: number) {
		if (value < 1024) {
			return `${value} B`;
		}

		const units = ['KB', 'MB', 'GB', 'TB'];
		let size = value / 1024;
		let index = 0;

		while (size >= 1024 && index < units.length - 1) {
			size /= 1024;
			index += 1;
		}

		return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[index]}`;
	}

	function getPathSegments(currentPath: string) {
		if (currentPath === '/') {
			return [{ label: 'This device', path: '/' }];
		}

		const parts = currentPath.split('/').filter(Boolean);
		let accumulator = '';

		return [
			{ label: 'This device', path: '/' },
			...parts.map((part, index) => {
				accumulator = index === 0 ? part : `${accumulator}/${part}`;
				return {
					label: part,
					path: accumulator.includes(':') ? accumulator : `/${accumulator}`
				};
			})
		];
	}

	async function loadDirectory(path = '/') {
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
					pushToast(
						'Directory unavailable',
						'Requested directory is unavailable. Returned to the root directory.'
					);
					return;
				} catch (rootError) {
					pushToast(
						'Unable to load root',
						rootError instanceof Error ? rootError.message : 'Unable to load root directory'
					);
					return;
				}
			}

			pushToast(
				'Unable to load directory',
				error instanceof Error ? error.message : 'Unable to load directory'
			);
		} finally {
			isLoading = false;
		}
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
			const tab: EditorTab = {
				...file,
				language: getLanguageFromPath(file.path),
				draftContent: file.content,
				isDirty: false
			};

			openTabs = [...openTabs, tab];
			activeTabPath = tab.path;
			isEditorModalOpen = false;
		} catch (error) {
			pushToast('Unable to open file', error instanceof Error ? error.message : 'Unable to load file');
		}
	}

	async function openPreview(entry: FileEntry) {
		selectedFilePath = entry.path;
		const fileType = getFileType(entry.path);

		if (fileType === 'archive') {
			isLoadingArchive = true;
			try {
				const preview = await getArchivePreview(entry.path);
				previewState = {
					isOpen: true,
					title: preview.name,
					kind: 'archive',
					src: '',
					archiveEntries: preview.entries
				};
			} catch (error) {
				pushToast(
					'Unable to preview archive',
					error instanceof Error ? error.message : 'Unable to inspect archive'
				);
			} finally {
				isLoadingArchive = false;
			}
			return;
		}

		if (fileType === 'other') {
			pushToast(
				'No inline preview',
				'This file type is not previewed inline yet. Use download from the context menu.',
				'info'
			);
			return;
		}

		if (fileType === 'editor') {
			await openEditorFile(entry.path);
			return;
		}

		previewState = {
			isOpen: true,
			title: entry.name,
			kind: fileType,
			src: getFileBlobUrl(entry.path),
			archiveEntries: []
		};
	}

	async function openEntry(entry: FileEntry) {
		closeContextMenu();

		if (!entry.isAccessible) {
			pushToast('Permission denied', `${entry.name} cannot be opened with the current filesystem permissions.`);
			return;
		}

		if (entry.type === 'directory') {
			selectedFilePath = entry.path;
			await loadDirectory(entry.path);
			return;
		}

		const fileType = getFileType(entry.path);

		if (fileType === 'editor') {
			await openEditorFile(entry.path);
			return;
		}

		await openPreview(entry);
	}

	function handleEditorChange(value: string) {
		openTabs = openTabs.map((tab) =>
			tab.path === activeTabPath
				? {
					...tab,
					draftContent: value,
					isDirty: value !== tab.content
				}
				: tab
		);
	}

	async function saveActiveTab() {
		if (!activeTab) {
			return;
		}

		try {
			const saved = await saveTextFileContent(activeTab.path, activeTab.draftContent);
			openTabs = openTabs.map((tab) =>
				tab.path === activeTab.path
					? {
						...tab,
						content: activeTab.draftContent,
						size: saved.size,
						modifiedAt: saved.modifiedAt,
						isDirty: false
					}
					: tab
			);
			pushToast('File saved', `${activeTab.name} was saved successfully.`, 'info');
			await loadDirectory(listing.currentPath);
		} catch (error) {
			pushToast('Save failed', error instanceof Error ? error.message : 'Unable to save file');
		}
	}

	function closeTab(path: string) {
		const nextTabs = openTabs.filter((tab) => tab.path !== path);
		openTabs = nextTabs;

		if (activeTabPath === path) {
			activeTabPath = nextTabs.at(-1)?.path ?? '';
		}

		if (selectedFilePath === path && !nextTabs.some((tab) => tab.path === path)) {
			selectedFilePath = activeTabPath;
		}
	}

	function openTerminalHere(path = listing.currentPath) {
		terminalCwd = path === '/' ? undefined : path;
		terminalSessionKey += 1;
		isTerminalVisible = true;
	}

	function toggleTerminal() {
		isTerminalVisible = !isTerminalVisible;

		if (isTerminalVisible && terminalSessionKey === 0) {
			openTerminalHere();
		}
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

	async function uploadSelectedFiles(files: FileList | null, isFolderUpload: boolean) {
		if (!files || files.length === 0) {
			return;
		}

		const items: UploadItem[] = Array.from(files).map((file) => {
			const relativePath =
				isFolderUpload && (file as File & { webkitRelativePath?: string }).webkitRelativePath
					? (file as File & { webkitRelativePath?: string }).webkitRelativePath!
					: file.name;

			return {
				file,
				relativePath
			};
		});

		try {
			const result = await uploadFilesToDirectory(uploadTargetPath, items);
			pushToast(
				'Upload complete',
				`${result.uploaded.length} item${result.uploaded.length === 1 ? '' : 's'} uploaded successfully.`,
				'info'
			);
			await loadDirectory(listing.currentPath);
		} catch (error) {
			pushToast('Upload failed', error instanceof Error ? error.message : 'Unable to upload files');
		}
	}

	function handleFileInputChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		void uploadSelectedFiles(input.files, false);
	}

	function handleFolderInputChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		void uploadSelectedFiles(input.files, true);
	}

	function getContextActions(entry: FileEntry) {
		const baseActions = [
			{ id: 'open', label: entry.type === 'directory' ? 'Open folder' : 'Open' },
			{ id: 'download', label: entry.type === 'directory' ? 'Download folder (.zip)' : 'Download file' }
		];

		if (entry.type === 'directory') {
			return [
				...baseActions,
				{ id: 'terminal', label: 'Open terminal here' },
				{ id: 'upload-files', label: 'Upload files here' },
				{ id: 'upload-folder', label: 'Upload folder here' }
			];
		}

		const fileType = getFileType(entry.path);
		const extraActions: Array<{ id: string; label: string }> = [];

		if (fileType !== 'other' && fileType !== 'editor') {
			extraActions.push({ id: 'preview', label: 'Preview' });
		}

		if (fileType === 'editor') {
			extraActions.push({ id: 'open-editor', label: 'Open in editor tab' });
		}

		return [...baseActions, ...extraActions, { id: 'upload-files', label: 'Upload files to current folder' }];
	}

	async function handleContextAction(actionId: string) {
		const entry = contextMenu.entry;
		closeContextMenu();

		if (!entry) {
			return;
		}

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
		}
	}

	function openContextMenu(event: MouseEvent, entry: FileEntry) {
		event.preventDefault();
		contextMenu = {
			isOpen: true,
			x: event.clientX,
			y: event.clientY,
			entry
		};
	}

	function closeContextMenu() {
		contextMenu = {
			isOpen: false,
			x: 0,
			y: 0,
			entry: null
		};
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

		void loadDirectory();
		openTerminalHere();
		isTerminalVisible = false;

		return () => {
			window.removeEventListener('click', handleWindowClick);
			window.removeEventListener('keydown', handleEscape);
		};
	});
</script>

<svelte:head>
	<title>Node Explorer</title>
	<meta
		name="description"
		content="Explorer workspace with typed file opening, editor tabs, media previews, uploads, downloads, and context actions."
	/>
</svelte:head>

<div class="app-shell">
	<input bind:this={fileUploadInput} type="file" multiple hidden onchange={handleFileInputChange} />
	<input bind:this={folderUploadInput} type="file" multiple hidden webkitdirectory onchange={handleFolderInputChange} />

	<ToastStack items={toasts} onDismiss={dismissToast} />
	<FileContextMenu
		isOpen={contextMenu.isOpen}
		x={contextMenu.x}
		y={contextMenu.y}
		title={contextMenu.entry?.name ?? ''}
		actions={contextActions}
		onSelect={handleContextAction}
	/>
	<FilePreviewModal
		isOpen={previewState.isOpen}
		title={previewState.title}
		kind={previewState.kind}
		src={previewState.src}
		archiveEntries={previewState.archiveEntries}
		onClose={() => (previewState = { ...previewState, isOpen: false })}
	/>

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
			<button type="button" class="ghost compact" onclick={() => loadDirectory(listing.currentPath)}>
				<RefreshCw size={15} />
				Refresh
			</button>
			<button type="button" class="ghost compact" onclick={() => triggerUploadFiles(listing.currentPath)}>
				<Upload size={15} />
				Upload files
			</button>
			<button type="button" class="ghost compact" onclick={() => triggerUploadFolder(listing.currentPath)}>
				<FolderUp size={15} />
				Upload folder
			</button>
			<button type="button" class:active-toggle={isTerminalVisible} class="ghost compact" onclick={toggleTerminal}>
				<SquareTerminal size={15} />
				{isTerminalVisible ? 'Hide terminal' : 'Show terminal'}
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
					<button
						type="button"
						class="ghost compact"
						disabled={!listing.parentPath}
						onclick={() => loadDirectory(listing.parentPath ?? '/')}
					>
						<ChevronUp size={15} />
						Up
					</button>
					<button type="button" class="ghost compact" onclick={() => downloadItem(listing.currentPath)}>
						<Download size={15} />
						Download
					</button>
				</div>
			</div>

			<nav class="breadcrumbs" aria-label="Breadcrumbs">
				{#each breadcrumbs as crumb, index (crumb.path)}
					<button type="button" class="crumb" onclick={() => loadDirectory(crumb.path)}>
						{crumb.label}
					</button>
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
				<p class="notice">
					{filterQuery ? 'No items match the current filter.' : 'This directory is empty.'}
				</p>
			{:else}
				<div class="explorer-list" role="list">
					{#each filteredEntries as entry (entry.path)}
						<button
							type="button"
							class="item-card"
							class:selected={entry.path === selectedFilePath}
							class:directory={entry.type === 'directory'}
							class:restricted={!entry.isAccessible}
							onclick={() => openEntry(entry)}
							oncontextmenu={(event) => openContextMenu(event, entry)}
						>
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
									<span>
										{#if !entry.isAccessible}
											Restricted item
										{:else if entry.type === 'directory'}
											Folder
										{:else}
											{formatBytes(entry.size)}
										{/if}
									</span>
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
					<p class="meta">
						{activeTab?.path ??
							selectedEntry?.path ??
							'Open code or text files into tabs. Media, PDF, and zip files open in preview overlays.'}
					</p>
				</div>
				<div class="toolbar-actions">
					{#if selectedEntry}
						<button type="button" class="ghost compact" onclick={() => downloadItem(selectedEntry.path)}>
							<Download size={15} />
							Download
						</button>
					{/if}
					{#if activeTab}
						<button type="button" class="ghost compact" onclick={() => (isEditorModalOpen = true)}>
							<FileCode2 size={15} />
							Pop out editor
						</button>
						<button type="button" class="compact" disabled={!activeTab.isDirty} onclick={saveActiveTab}>
							<Save size={15} />
							Save
						</button>
					{/if}
					<button type="button" class="ghost compact" onclick={() => openTerminalHere(listing.currentPath)}>
						<SquareTerminal size={15} />
						Terminal here
					</button>
				</div>
			</div>

			<section class="editor-panel panel">
				{#if activeTab}
					<div class="editor-stack">
						<div class="tab-strip">
							<div class="tabs-row">
								{#each openTabs as tab (tab.path)}
									<button
										type="button"
										class="editor-tab"
										class:active={tab.path === activeTabPath}
										onclick={() => {
											activeTabPath = tab.path;
											selectedFilePath = tab.path;
										}}
									>
										<FileCode2 size={14} />
										<span>{tab.name}</span>
										{#if tab.isDirty}
											<em>edited</em>
										{/if}
										<span
											class="close-tab"
											role="button"
											tabindex="0"
											onclick={(event) => {
												event.stopPropagation();
												closeTab(tab.path);
											}}
											onkeydown={(event) => {
												if (event.key === 'Enter' || event.key === ' ') {
													event.preventDefault();
													closeTab(tab.path);
												}
											}}
										>
											×
										</span>
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
						<h3>Open files by type</h3>
						<p>
							Code and text files open in editor tabs. Images, video, audio, PDF, and zip files open
							in popups. Use right click for upload, download, preview, and terminal actions.
						</p>
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
					<button type="button" class="ghost compact" onclick={() => openTerminalHere(listing.currentPath)}>
						<RefreshCw size={15} />
						Reconnect here
					</button>
					<button type="button" class="ghost compact" onclick={toggleTerminal}>
						<X size={15} />
						Hide
					</button>
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
						<button type="button" class="ghost compact" onclick={() => (isEditorModalOpen = false)}>
							<X size={15} />
							Close overlay
						</button>
						<button type="button" class="compact" disabled={!activeTab.isDirty} onclick={saveActiveTab}>
							<Save size={15} />
							Save
						</button>
					</div>
				</header>
				<div class="editor-frame modal-editor">
					<CodeEditor value={activeTab.draftContent} language={activeTab.language} onChange={handleEditorChange} />
				</div>
			</div>
		</div>
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
	input {
		font: inherit;
	}

	.app-shell {
		max-width: 1520px;
		margin: 0 auto;
		padding: 18px;
		color: #edf3ff;
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
		grid-template-columns: 360px minmax(0, 1fr);
		gap: 14px;
		min-height: calc(100vh - 170px);
	}

	.sidebar {
		display: grid;
		grid-template-rows: auto auto auto minmax(0, 1fr);
		gap: 14px;
	}

	.sidebar-top,
	.content-toolbar,
	.tray-header,
	.modal-header {
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

	.notice {
		padding: 16px;
		border-radius: 16px;
		background: rgba(16, 28, 46, 0.9);
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

	@media (max-width: 1080px) {
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
		.modal-header {
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

<svelte:options runes={false} />

<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ChevronUp,
		File,
		FileCode2,
		Folder,
		HardDrive,
		LayoutPanelLeft,
		MonitorUp,
		RefreshCw,
		Save,
		Search,
		SquareTerminal,
		X
	} from '@lucide/svelte';

	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import Terminal from '$lib/components/Terminal.svelte';
	import {
		DirectoryRequestError,
		getDirectoryListing,
		getTextFileContent,
		saveTextFileContent,
		type FileContent,
		type FileEntry
	} from '$lib/api';

	type FileListingState = {
		currentPath: string;
		parentPath: string | null;
		entries: FileEntry[];
	};

	let listing: FileListingState = {
		currentPath: '/',
		parentPath: null,
		entries: []
	};
	let isLoading = true;
	let errorMessage = '';
	let selectedFile: FileContent | null = null;
	let selectedFilePath = '';
	let editorValue = '';
	let isLoadingFile = false;
	let fileErrorMessage = '';
	let isSaving = false;
	let saveMessage = '';
	let terminalCwd: string | undefined = undefined;
	let terminalSessionKey = 0;
	let isTerminalVisible = false;
	let isEditorModalOpen = false;
	let filterQuery = '';

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
			errorMessage = '';
		} catch (error) {
			const isRecoverableDirectoryError =
				error instanceof DirectoryRequestError &&
				path !== '/' &&
				(error.statusCode === 400 || error.statusCode === 404);

			if (isRecoverableDirectoryError) {
				try {
					listing = await getDirectoryListing('/');
					errorMessage = 'Requested directory is unavailable. Returned to the root directory.';
					return;
				} catch (rootError) {
					errorMessage =
						rootError instanceof Error ? rootError.message : 'Unable to load root directory';
					return;
				}
			}

			errorMessage = error instanceof Error ? error.message : 'Unable to load directory';
		} finally {
			isLoading = false;
		}
	}

	async function loadFile(path: string) {
		selectedFilePath = path;
		selectedFile = null;
		isLoadingFile = true;
		fileErrorMessage = '';
		saveMessage = '';

		try {
			selectedFile = await getTextFileContent(path);
			editorValue = selectedFile.content;
			isEditorModalOpen = false;
		} catch (error) {
			fileErrorMessage = error instanceof Error ? error.message : 'Unable to load file';
		} finally {
			isLoadingFile = false;
		}
	}

	function handleEntryClick(entry: FileEntry) {
		if (entry.type === 'directory') {
			void loadDirectory(entry.path);
			return;
		}

		void loadFile(entry.path);
	}

	function handleEditorChange(value: string) {
		editorValue = value;
		saveMessage = '';
	}

	async function saveFile() {
		if (!selectedFile) {
			return;
		}

		isSaving = true;
		fileErrorMessage = '';

		try {
			const updatedFile = await saveTextFileContent(selectedFile.path, editorValue);
			selectedFile = {
				...selectedFile,
				content: editorValue,
				size: updatedFile.size,
				modifiedAt: updatedFile.modifiedAt
			};
			saveMessage = 'Saved just now';
			await loadDirectory(listing.currentPath);
		} catch (error) {
			fileErrorMessage = error instanceof Error ? error.message : 'Unable to save file';
		} finally {
			isSaving = false;
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

	function closeEditor() {
		selectedFile = null;
		selectedFilePath = '';
		editorValue = '';
		fileErrorMessage = '';
		saveMessage = '';
		isEditorModalOpen = false;
	}

	function openEditorModal() {
		if (!selectedFile) {
			return;
		}

		isEditorModalOpen = true;
	}

	$: isDirty = selectedFile ? editorValue !== selectedFile.content : false;
	$: filteredEntries = listing.entries.filter((entry) => {
		const query = filterQuery.trim().toLowerCase();

		if (!query) {
			return true;
		}

		return entry.name.toLowerCase().includes(query);
	});
	$: breadcrumbs = getPathSegments(listing.currentPath);

	onMount(() => {
		void loadDirectory();
		openTerminalHere();
		isTerminalVisible = false;
	});
</script>

<svelte:head>
	<title>Node Explorer</title>
	<meta
		name="description"
		content="Compact server explorer with attached editor, popout editing, and a hideable terminal tray."
	/>
</svelte:head>

<div class="app-shell">
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
					<button type="button" class="ghost compact" onclick={() => loadDirectory('/')}>
						This device
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

			{#if errorMessage}
				<p class="notice error">{errorMessage}</p>
			{:else if isLoading}
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
							onclick={() => handleEntryClick(entry)}
						>
							<div class="item-main">
								<div class="item-icon">
									{#if entry.type === 'directory'}
										<Folder size={16} />
									{:else}
										<File size={16} />
									{/if}
								</div>
								<div class="item-copy">
									<strong>{entry.name}</strong>
									<span>{entry.type === 'directory' ? 'Folder' : formatBytes(entry.size)}</span>
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
					<h2>{selectedFile?.name ?? 'No file open'}</h2>
					<p class="meta">
						{selectedFile
							? selectedFile.path
							: 'Open a text file from the explorer to attach it here. Use popout for a temporary overlay editor.'}
					</p>
				</div>
				<div class="toolbar-actions">
					{#if selectedFile}
						<button type="button" class="ghost compact" onclick={openEditorModal}>
							<MonitorUp size={15} />
							Pop out
						</button>
						<button type="button" class="ghost compact" onclick={() => openTerminalHere(listing.currentPath)}>
							<SquareTerminal size={15} />
							Terminal here
						</button>
						<button type="button" class="ghost compact" onclick={closeEditor}>
							<X size={15} />
							Close
						</button>
						<button type="button" class="compact" disabled={!isDirty || isSaving} onclick={saveFile}>
							<Save size={15} />
							{isSaving ? 'Saving...' : 'Save'}
						</button>
					{/if}
				</div>
			</div>

			<section class="editor-panel panel">
				{#if fileErrorMessage}
					<p class="notice error">{fileErrorMessage}</p>
				{:else if isLoadingFile}
					<p class="notice">Loading file contents...</p>
				{:else if selectedFile}
					<div class="editor-stack">
						<div class="tab-strip">
							<div class="tab active-tab">
								<FileCode2 size={15} />
								<span>{selectedFile.name}</span>
								{#if isDirty}
									<em>edited</em>
								{/if}
							</div>
							<div class="editor-stats">
								<span>{getLanguageFromPath(selectedFile.path)}</span>
								<span>{formatBytes(selectedFile.size)}</span>
								<span>{new Date(selectedFile.modifiedAt).toLocaleString()}</span>
								{#if saveMessage}
									<span class="saved-state">{saveMessage}</span>
								{/if}
							</div>
						</div>

						<div class="editor-frame attached-editor">
							<CodeEditor
								value={editorValue}
								language={getLanguageFromPath(selectedFile.path)}
								onChange={handleEditorChange}
							/>
						</div>
					</div>
				{:else}
					<div class="empty-state">
						<FileCode2 size={28} />
						<h3>Open a text file to attach an editor</h3>
						<p>
							The file opens directly in this workspace. Use the popout action when you want a
							temporary overlay while keeping the explorer visible underneath.
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
				<Terminal cwd={terminalCwd} />
			{/key}
		</section>
	{/if}

	{#if isEditorModalOpen && selectedFile}
		<div class="modal-backdrop" role="presentation" onclick={() => (isEditorModalOpen = false)}>
			<section
				class="modal-panel"
				role="dialog"
				aria-modal="true"
				aria-label="Editor popout"
				onclick={(event) => event.stopPropagation()}
			>
				<header class="modal-header">
					<div>
						<p class="label">Popout editor</p>
						<h2>{selectedFile.name}</h2>
						<p class="meta">{selectedFile.path}</p>
					</div>
					<div class="toolbar-actions">
						<button type="button" class="ghost compact" onclick={() => (isEditorModalOpen = false)}>
							<X size={15} />
							Close overlay
						</button>
						<button type="button" class="compact" disabled={!isDirty || isSaving} onclick={saveFile}>
							<Save size={15} />
							{isSaving ? 'Saving...' : 'Save'}
						</button>
					</div>
				</header>
				<div class="editor-frame modal-editor">
					<CodeEditor
						value={editorValue}
						language={getLanguageFromPath(selectedFile.path)}
						onChange={handleEditorChange}
					/>
				</div>
			</section>
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
		max-width: 1480px;
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
		grid-template-columns: 340px minmax(0, 1fr);
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
		display: flex;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		align-items: center;
	}

	.tab {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border-radius: 14px;
		background: rgba(18, 34, 56, 0.88);
		color: #edf3ff;
	}

	.tab em,
	.saved-state {
		font-style: normal;
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #6ce0a7;
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

	.notice.error {
		background: rgba(94, 28, 28, 0.58);
		color: #ffd9d9;
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

		.sidebar {
			grid-template-rows: auto auto auto auto;
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

		.brand-block {
			align-items: flex-start;
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

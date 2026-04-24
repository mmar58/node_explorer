<svelte:options runes={false} />

<script lang="ts">
	import { onMount } from 'svelte';
	import {
		File,
		FileCode2,
		Folder,
		HardDrive,
		RefreshCw,
		Save,
		SquareTerminal
	} from '@lucide/svelte';

	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import Terminal from '$lib/components/Terminal.svelte';
	import {
		DirectoryRequestError,
		FileContentRequestError,
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

		if (normalizedPath.endsWith('.svelte')) {
			return 'html';
		}

		if (normalizedPath.endsWith('.md')) {
			return 'markdown';
		}

		if (normalizedPath.endsWith('.css')) {
			return 'css';
		}

		if (normalizedPath.endsWith('.html')) {
			return 'html';
		}

		if (normalizedPath.endsWith('.yml') || normalizedPath.endsWith('.yaml')) {
			return 'yaml';
		}

		if (normalizedPath.endsWith('.xml')) {
			return 'xml';
		}

		if (normalizedPath.endsWith('.sh') || normalizedPath.endsWith('.ps1')) {
			return 'shell';
		}

		return 'plaintext';
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
			saveMessage = 'Saved';
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
	}

	$: isDirty = selectedFile ? editorValue !== selectedFile.content : false;

	onMount(() => {
		void loadDirectory();
		openTerminalHere();
	});
</script>

<svelte:head>
	<title>Node Explorer</title>
	<meta
		name="description"
		content="Node Explorer now browses directories, opens UTF-8 text files for editing, and runs terminal sessions from the browser."
	/>
</svelte:head>

<div class="shell">
	<section class="hero">
		<div>
			<p class="eyebrow">Node Explorer</p>
			<h1>Browser, editor, terminal</h1>
			<p class="intro">
				Browse the server filesystem, open UTF-8 text files for live editing, and launch a real
				PTY-backed terminal with shell completion directly from the current workspace.
			</p>
		</div>

		<div class="hero-card">
			<div class="stat">
				<HardDrive size={18} />
				<span>Current location</span>
			</div>
			<strong>{listing.currentPath}</strong>
			<div class="hero-actions">
				<button type="button" class="refresh" onclick={() => loadDirectory(listing.currentPath)}>
					<RefreshCw size={16} />
					Refresh
				</button>
				<button type="button" class="ghost" onclick={() => openTerminalHere(listing.currentPath)}>
					<SquareTerminal size={16} />
					Open terminal here
				</button>
			</div>
		</div>
	</section>

	<div class="workspace-grid">
		<section class="browser panel">
			<header class="browser-header">
				<div>
					<p class="label">Path</p>
					<h2>{listing.currentPath}</h2>
				</div>
				<div class="actions">
					<button
						type="button"
						disabled={!listing.parentPath}
						onclick={() => loadDirectory(listing.parentPath ?? '/')}
					>
						Up one level
					</button>
					<button type="button" class="ghost" onclick={() => loadDirectory('/')}>
						Go to device root
					</button>
				</div>
			</header>

			{#if errorMessage}
				<p class="error">{errorMessage}</p>
			{:else if isLoading}
				<p class="status">Loading directory contents...</p>
			{:else if listing.entries.length === 0}
				<p class="status">This directory is empty.</p>
			{:else}
				<div class="table">
					<div class="table-head">
						<span>Name</span>
						<span>Type</span>
						<span>Size</span>
						<span>Modified</span>
					</div>

					{#each listing.entries as entry (entry.path)}
						<button
							type="button"
							class:selected={entry.path === selectedFilePath}
							class:directory={entry.type === 'directory'}
							class="row"
							onclick={() => handleEntryClick(entry)}
						>
							<span class="name-cell">
								{#if entry.type === 'directory'}
									<Folder size={18} />
								{:else}
									<File size={18} />
								{/if}
								<strong>{entry.name}</strong>
							</span>
							<span>{entry.type}</span>
							<span>{entry.type === 'directory' ? '—' : formatBytes(entry.size)}</span>
							<span>{new Date(entry.modifiedAt).toLocaleString()}</span>
						</button>
					{/each}
				</div>
			{/if}
		</section>

		<section class="editor-panel panel">
			<header class="editor-header">
				<div>
					<p class="label">Editor</p>
					<h2>{selectedFile?.name ?? 'Select a text file'}</h2>
					{#if selectedFile}
						<p class="meta">{selectedFile.path}</p>
					{/if}
				</div>
				<div class="actions">
					{#if selectedFile}
						<button type="button" class="ghost" onclick={() => openTerminalHere(listing.currentPath)}>
							<SquareTerminal size={16} />
							Terminal in folder
						</button>
						<button type="button" disabled={!isDirty || isSaving} onclick={saveFile}>
							<Save size={16} />
							{isSaving ? 'Saving...' : isDirty ? 'Save changes' : 'Saved'}
						</button>
					{/if}
				</div>
			</header>

			{#if fileErrorMessage}
				<p class="error">{fileErrorMessage}</p>
			{:else if isLoadingFile}
				<p class="status">Loading file contents...</p>
			{:else if selectedFile}
				<div class="editor-body">
					<div class="editor-stats">
						<div class="stat-pill">
							<FileCode2 size={16} />
							<span>{getLanguageFromPath(selectedFile.path)}</span>
						</div>
						<div class="stat-pill">
							<span>{formatBytes(selectedFile.size)}</span>
						</div>
						<div class="stat-pill">
							<span>{new Date(selectedFile.modifiedAt).toLocaleString()}</span>
						</div>
						{#if saveMessage}
							<div class="stat-pill success-pill">
								<span>{saveMessage}</span>
							</div>
						{/if}
					</div>
					<div class="editor-frame">
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
					<h3>Open a text file to inspect or edit it</h3>
					<p>
						The backend currently supports UTF-8 text files up to 1 MB for safe browser-based
						preview and save.
					</p>
				</div>
			{/if}
		</section>
	</div>

	<section class="terminal-panel panel">
		<header class="terminal-header">
			<div>
				<p class="label">Terminal</p>
				<h2>Interactive shell</h2>
				<p class="meta">Tab completion comes from the shell running inside the server PTY.</p>
			</div>
			<div class="actions">
				<button type="button" class="ghost" onclick={() => openTerminalHere(listing.currentPath)}>
					<SquareTerminal size={16} />
					Reconnect here
				</button>
			</div>
		</header>

		{#key terminalSessionKey}
			<Terminal cwd={terminalCwd} />
		{/key}
	</section>
</div>

<style>
	:global(body) {
		margin: 0;
		min-height: 100vh;
		background:
			radial-gradient(circle at top, rgba(78, 116, 255, 0.18), transparent 30%),
			linear-gradient(180deg, #07111f 0%, #0d1728 45%, #111c2f 100%);
	}

	.shell {
		max-width: 1120px;
		margin: 0 auto;
		padding: 48px 20px 80px;
		color: #eff5ff;
	}

	.hero {
		display: grid;
		grid-template-columns: minmax(0, 1.6fr) minmax(260px, 0.9fr);
		gap: 24px;
		align-items: end;
		margin-bottom: 28px;
	}

	.eyebrow,
	.label {
		margin: 0 0 8px;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: #8eb4ff;
	}

	h1,
	h2,
	p {
		margin: 0;
	}

	h1 {
		font-size: clamp(2.5rem, 8vw, 4.75rem);
		line-height: 0.95;
		letter-spacing: -0.04em;
	}

	.intro {
		margin-top: 16px;
		max-width: 62ch;
		font-size: 1.02rem;
		line-height: 1.6;
		color: #bfd0f5;
	}

	.hero-card,
	.browser {
		border: 1px solid rgba(147, 178, 255, 0.18);
		background: rgba(8, 16, 30, 0.72);
		backdrop-filter: blur(18px);
		box-shadow: 0 24px 60px rgba(2, 7, 18, 0.28);
		border-radius: 24px;
	}

	.hero-card {
		padding: 20px;
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.stat {
		display: flex;
		align-items: center;
		gap: 8px;
		color: #9bb8ef;
		margin-bottom: 12px;
	}

	.hero-card strong {
		display: block;
		font-size: 1.6rem;
		margin-bottom: 18px;
	}

	.panel {
		padding: 24px;
	}

	.workspace-grid {
		display: grid;
		grid-template-columns: minmax(320px, 0.95fr) minmax(0, 1.35fr);
		gap: 24px;
		margin-bottom: 24px;
	}

	.browser-header {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		align-items: center;
		margin-bottom: 18px;
	}

	.actions,
	.refresh {
		display: flex;
		gap: 10px;
		align-items: center;
	}

	button {
		border: 0;
		border-radius: 999px;
		background: linear-gradient(135deg, #79a8ff 0%, #9fd3ff 100%);
		color: #08111f;
		font: inherit;
		font-weight: 650;
		padding: 11px 16px;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	button.ghost {
		background: rgba(131, 163, 224, 0.12);
		color: #d9e6ff;
		border: 1px solid rgba(147, 178, 255, 0.18);
	}

	.table {
		display: grid;
		gap: 10px;
	}

	.table-head,
	.row {
		display: grid;
		grid-template-columns: minmax(0, 2fr) 110px 110px 180px;
		gap: 12px;
		align-items: center;
	}

	.table-head {
		padding: 0 16px;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #97aed6;
	}

	.row {
		width: 100%;
		padding: 14px 16px;
		text-align: left;
		border-radius: 18px;
		background: rgba(12, 24, 42, 0.58);
		border: 1px solid rgba(147, 178, 255, 0.1);
		color: #eff5ff;
	}

	.row:hover,
	.row.selected {
		border-color: rgba(159, 211, 255, 0.35);
		background: rgba(18, 34, 58, 0.85);
	}

	.name-cell {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}

	.name-cell strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.editor-header,
	.terminal-header {
		display: flex;
		justify-content: space-between;
		gap: 18px;
		align-items: flex-start;
		margin-bottom: 18px;
	}

	.meta {
		margin-top: 8px;
		font-size: 0.92rem;
		line-height: 1.5;
		color: #bfd0f5;
		word-break: break-all;
	}

	.editor-body {
		display: grid;
		gap: 14px;
		height: calc(100% - 84px);
	}

	.editor-frame {
		border-radius: 20px;
		overflow: hidden;
		border: 1px solid rgba(147, 178, 255, 0.14);
		background: #07111f;
	}

	.editor-panel {
		min-height: 620px;
	}

	.editor-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.stat-pill {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-radius: 999px;
		background: rgba(131, 163, 224, 0.12);
		border: 1px solid rgba(147, 178, 255, 0.14);
		color: #d9e6ff;
		font-size: 0.9rem;
	}

	.success-pill {
		border-color: rgba(111, 226, 176, 0.24);
		background: rgba(29, 74, 56, 0.55);
	}

	.empty-state {
		display: grid;
		place-items: center;
		align-content: center;
		gap: 12px;
		min-height: 460px;
		text-align: center;
		color: #bfd0f5;
	}

	.empty-state h3 {
		margin: 0;
		font-size: 1.35rem;
		color: #eff5ff;
	}

	.terminal-panel {
		margin-top: 0;
	}

	.status,
	.error {
		padding: 16px 0;
	}

	.error {
		color: #ffb4b4;
	}

	@media (max-width: 1080px) {
		.workspace-grid {
			grid-template-columns: 1fr;
		}

		.editor-panel {
			min-height: 560px;
		}
	}

	@media (max-width: 760px) {
		.shell {
			padding: 32px 16px 56px;
		}

		.hero {
			grid-template-columns: 1fr;
		}

		.browser-header,
		.editor-header,
		.terminal-header {
			flex-direction: column;
		}

		.table-head {
			display: none;
		}

		.row {
			grid-template-columns: 1fr;
			gap: 6px;
		}

		.row span:not(.name-cell) {
			font-size: 0.92rem;
			color: #bfd0f5;
		}
	}

	.row.directory {
		background: linear-gradient(135deg, rgba(26, 52, 91, 0.95), rgba(18, 32, 54, 0.95));
	}

	.name-cell {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}

	.name-cell strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.error,
	.status {
		padding: 18px;
		border-radius: 18px;
		background: rgba(20, 34, 57, 0.86);
		color: #bfd0f5;
	}

	.error {
		color: #ffd2d2;
		background: rgba(92, 26, 26, 0.55);
	}

	@media (max-width: 900px) {
		.hero,
		.browser-header,
		.table-head,
		.row {
			grid-template-columns: 1fr;
		}

		.browser-header {
			display: grid;
		}

		.actions {
			flex-wrap: wrap;
		}

		.table-head {
			display: none;
		}

		.row {
			gap: 8px;
			border-radius: 20px;
		}
	}
</style>

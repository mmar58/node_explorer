<script lang="ts">
	import { Folder, File, RefreshCw, HardDrive } from '@lucide/svelte';

	import {
		DirectoryRequestError,
		getDirectoryListing,
		type FileEntry
	} from '$lib/api';

	type FileListingState = {
		currentPath: string;
		parentPath: string | null;
		entries: FileEntry[];
	};

	let listing = $state<FileListingState>({
		currentPath: '/',
		parentPath: null,
		entries: []
	});
	let isLoading = $state(true);
	let errorMessage = $state('');

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
					errorMessage = rootError instanceof Error ? rootError.message : 'Unable to load root directory';
					return;
				}
			}

			errorMessage = error instanceof Error ? error.message : 'Unable to load directory';
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		loadDirectory();
	});
</script>

<svelte:head>
	<title>Node Explorer</title>
	<meta
		name="description"
		content="Minimal first slice of the Node Explorer file manager backed by the new Fastify API."
	/>
</svelte:head>

<div class="shell">
	<section class="hero">
		<div>
			<p class="eyebrow">Node Explorer</p>
			<h1>Server file browser</h1>
			<p class="intro">
				This first implementation slice wires the Svelte client to a real backend directory listing.
				The next slices can build auth, upload, terminal, and editing on top of this API shape.
			</p>
		</div>

		<div class="hero-card">
			<div class="stat">
				<HardDrive size={18} />
				<span>Current location</span>
			</div>
			<strong>{listing.currentPath}</strong>
			<button type="button" class="refresh" onclick={() => loadDirectory(listing.currentPath)}>
				<RefreshCw size={16} />
				Refresh
			</button>
		</div>
	</section>

	<section class="browser">
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
						class:directory={entry.type === 'directory'}
						class="row"
						onclick={() => entry.type === 'directory' && loadDirectory(entry.path)}
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

	.browser {
		padding: 24px;
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
		grid-template-columns: minmax(0, 2fr) 120px 120px 200px;
		gap: 12px;
		align-items: center;
	}

	.table-head {
		padding: 0 16px;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #88a3d8;
	}

	.row {
		width: 100%;
		text-align: left;
		padding: 16px;
		border-radius: 18px;
		background: rgba(20, 34, 57, 0.86);
		color: #eff5ff;
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

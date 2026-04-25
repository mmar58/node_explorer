<svelte:options runes={false} />

<script lang="ts">
	import type { ArchiveEntry } from '$lib/api';

	export let isOpen = false;
	export let title = '';
	export let kind: 'image' | 'video' | 'audio' | 'archive' | 'document' | 'other' = 'other';
	export let src = '';
	export let archiveEntries: ArchiveEntry[] = [];
	export let onClose: () => void = () => {};

	function stop(event: MouseEvent | KeyboardEvent) {
		event.stopPropagation();
	}
</script>

{#if isOpen}
	<div class="backdrop" role="button" tabindex="0" aria-label="Close preview" onclick={onClose} onkeydown={(event) => event.key === 'Escape' && onClose()}>
		<div class="panel" role="dialog" tabindex="-1" aria-modal="true" aria-label={title} onclick={stop} onkeydown={stop}>
			<header>
				<div>
					<p>Preview</p>
					<h2>{title}</h2>
				</div>
				<button type="button" onclick={onClose}>Close</button>
			</header>

			{#if kind === 'image'}
				<img src={src} alt={title} class="image" />
			{:else if kind === 'video'}
				<!-- svelte-ignore a11y_media_has_caption -->
				<video src={src} controls class="media"></video>
			{:else if kind === 'audio'}
				<div class="audio-shell">
					<audio src={src} controls class="audio"></audio>
				</div>
			{:else if kind === 'document'}
				<iframe src={src} title={title} class="document"></iframe>
			{:else if kind === 'archive'}
				<div class="archive-list">
					{#if archiveEntries.length === 0}
						<p class="empty">Archive is empty.</p>
					{:else}
						{#each archiveEntries as entry (entry.path)}
							<div class="archive-row">
								<div>
									<strong>{entry.path}</strong>
									<span>{entry.type}</span>
								</div>
								<span>{entry.type === 'directory' ? 'Folder' : `${entry.size} bytes`}</span>
							</div>
						{/each}
					{/if}
				</div>
			{:else}
				<div class="empty">No inline preview available for this file type yet.</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 24px;
		background: rgba(2, 9, 18, 0.74);
		backdrop-filter: blur(10px);
		z-index: 30;
	}

	.panel {
		width: min(1100px, 100%);
		max-height: calc(100vh - 48px);
		display: grid;
		gap: 16px;
		padding: 18px;
		border-radius: 24px;
		border: 1px solid rgba(136, 167, 219, 0.18);
		background: rgba(9, 18, 31, 0.96);
		color: #edf3ff;
	}

	header {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		align-items: flex-start;
	}

	p {
		margin: 0 0 4px;
		font-size: 0.74rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: #8db1ea;
	}

	h2 {
		margin: 0;
		font-size: 1.1rem;
	}

	button {
		border: 0;
		border-radius: 10px;
		padding: 10px 12px;
		background: rgba(118, 151, 212, 0.12);
		border: 1px solid rgba(136, 167, 219, 0.16);
		color: #e4eeff;
		cursor: pointer;
	}

	.image,
	.media,
	.document {
		width: 100%;
		max-height: calc(100vh - 180px);
		border: 0;
		border-radius: 18px;
		background: #050c17;
	}

	.audio-shell {
		padding: 24px;
		border-radius: 18px;
		background: #050c17;
	}

	.audio {
		width: 100%;
	}

	.archive-list {
		overflow: auto;
		border-radius: 18px;
		background: rgba(12, 23, 40, 0.92);
	}

	.archive-row {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 14px 16px;
		border-bottom: 1px solid rgba(136, 167, 219, 0.08);
	}

	.archive-row strong,
	.archive-row span,
	.empty {
		display: block;
	}

	.archive-row span,
	.empty {
		font-size: 0.9rem;
		color: #afc3e8;
	}

	.empty {
		padding: 24px;
		text-align: center;
	}

	@media (max-width: 760px) {
		.backdrop {
			padding: 12px;
		}

		header {
			flex-direction: column;
		}
	}
</style>

<svelte:options runes={false} />

<script lang="ts">
	type ToastItem = {
		id: number;
		title: string;
		message: string;
		tone?: 'error' | 'info';
	};

	export let items: ToastItem[] = [];
	export let onDismiss: (id: number) => void = () => {};
</script>

{#if items.length > 0}
	<div class="toast-stack" aria-live="polite" aria-atomic="true">
		{#each items as item (item.id)}
			<section class:error={item.tone !== 'info'} class="toast">
				<div class="toast-copy">
					<p>{item.title}</p>
					<strong>{item.message}</strong>
				</div>
				<button type="button" class="dismiss" onclick={() => onDismiss(item.id)} aria-label="Dismiss notification">
					×
				</button>
			</section>
		{/each}
	</div>
{/if}

<style>
	.toast-stack {
		position: fixed;
		top: 18px;
		right: 18px;
		display: grid;
		gap: 10px;
		width: min(360px, calc(100vw - 24px));
		z-index: 40;
	}

	.toast {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 14px 14px 14px 16px;
		border-radius: 16px;
		border: 1px solid rgba(106, 201, 164, 0.18);
		background: rgba(12, 33, 31, 0.94);
		box-shadow: 0 18px 32px rgba(1, 8, 16, 0.34);
		backdrop-filter: blur(12px);
		color: #ebfff6;
	}

	.toast.error {
		border-color: rgba(255, 133, 133, 0.22);
		background: rgba(63, 17, 23, 0.96);
		color: #ffe7e7;
	}

	.toast-copy {
		display: grid;
		gap: 4px;
	}

	p {
		margin: 0;
		font-size: 0.76rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		opacity: 0.78;
	}

	strong {
		display: block;
		font-size: 0.92rem;
		font-weight: 600;
		line-height: 1.45;
	}

	.dismiss {
		align-self: flex-start;
		border: 0;
		background: transparent;
		color: inherit;
		font-size: 1.1rem;
		line-height: 1;
		cursor: pointer;
		padding: 0;
	}

	@media (max-width: 760px) {
		.toast-stack {
			top: auto;
			bottom: 12px;
			right: 12px;
			left: 12px;
			width: auto;
		}
	}
</style>
<svelte:options runes={false} />

<script lang="ts">
	type ContextAction = {
		id: string;
		label: string;
		disabled?: boolean;
	};

	export let isOpen = false;
	export let x = 0;
	export let y = 0;
	export let title = '';
	export let actions: ContextAction[] = [];
	export let onSelect: (id: string) => void = () => {};
</script>

{#if isOpen}
	<div class="menu" style={`left:${x}px; top:${y}px;`}>
		{#if title}
			<p>{title}</p>
		{/if}
		{#each actions as action (action.id)}
			<button type="button" disabled={action.disabled} onclick={() => onSelect(action.id)}>
				{action.label}
			</button>
		{/each}
	</div>
{/if}

<style>
	.menu {
		position: fixed;
		min-width: 210px;
		padding: 10px;
		border-radius: 16px;
		border: 1px solid rgba(136, 167, 219, 0.18);
		background: rgba(8, 18, 32, 0.98);
		box-shadow: 0 18px 36px rgba(2, 10, 18, 0.4);
		backdrop-filter: blur(10px);
		z-index: 35;
	}

	p {
		margin: 0 0 8px;
		font-size: 0.74rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: #8db1ea;
	}

	button {
		display: block;
		width: 100%;
		padding: 10px 12px;
		border: 0;
		border-radius: 10px;
		background: transparent;
		color: #edf3ff;
		text-align: left;
		cursor: pointer;
	}

	button:hover:not(:disabled) {
		background: rgba(108, 158, 248, 0.14);
	}

	button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	@media (max-width: 760px) {
		.menu {
			left: 12px !important;
			right: 12px;
			top: auto !important;
			bottom: 12px;
			min-width: auto;
		}
	}
</style>

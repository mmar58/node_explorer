<svelte:options runes={false} />

<script lang="ts">
	import { onMount } from 'svelte';
	import '@xterm/xterm/css/xterm.css';

	import { getTerminalSocketUrl } from '$lib/api';

	type XTermTerminal = import('@xterm/xterm').Terminal;
	type FitAddon = import('@xterm/addon-fit').FitAddon;

	export let cwd: string | undefined = undefined;

	let container: HTMLDivElement;
	let status = 'Connecting';
	let connectedCwd = cwd ?? 'server default';
	let errorMessage = '';

	onMount(() => {
		let disposed = false;
		let terminal: XTermTerminal | null = null;
		let fitAddon: FitAddon | null = null;
		let socket: WebSocket | null = null;
		let resizeObserver: ResizeObserver | null = null;

		const start = async () => {
			const [{ Terminal }, { FitAddon }] = await Promise.all([
				import('@xterm/xterm'),
				import('@xterm/addon-fit')
			]);

			if (disposed) {
				return;
			}

			terminal = new Terminal({
				cursorBlink: true,
				fontFamily: 'Consolas, "Cascadia Code", monospace',
				fontSize: 14,
				theme: {
					background: '#07111f',
					foreground: '#eff5ff',
					cursor: '#9fd3ff',
					selectionBackground: 'rgba(159, 211, 255, 0.25)'
				}
			});
			fitAddon = new FitAddon();
			terminal.loadAddon(fitAddon);
			terminal.open(container);
			fitAddon.fit();

			socket = new WebSocket(getTerminalSocketUrl({ cwd }));

			terminal.onData((data) => {
				if (socket?.readyState === WebSocket.OPEN) {
					socket.send(JSON.stringify({ type: 'input', data }));
				}
			});

			const sendResize = () => {
				if (!terminal || !fitAddon || socket?.readyState !== WebSocket.OPEN) {
					return;
				}

				fitAddon.fit();
				socket.send(
					JSON.stringify({
						type: 'resize',
						cols: terminal.cols,
						rows: terminal.rows
					})
				);
			};

			resizeObserver = new ResizeObserver(sendResize);
			resizeObserver.observe(container);

			socket.addEventListener('open', () => {
				status = 'Connected';
				sendResize();
				terminal?.focus();
			});

			socket.addEventListener('message', (event) => {
				let message: Record<string, unknown>;

				try {
					message = JSON.parse(String(event.data)) as Record<string, unknown>;
				} catch {
					return;
				}

				if (message.type === 'ready') {
					connectedCwd = typeof message.cwd === 'string' ? message.cwd : connectedCwd;
					return;
				}

				if (message.type === 'output' && typeof message.data === 'string') {
					terminal?.write(message.data);
					return;
				}

				if (message.type === 'error' && typeof message.error === 'string') {
					errorMessage = message.error;
					status = 'Disconnected';
					return;
				}

				if (message.type === 'exit') {
					status = 'Exited';
				}
			});

			socket.addEventListener('close', () => {
				if (status !== 'Exited') {
					status = errorMessage ? 'Disconnected' : 'Closed';
				}
			});

			socket.addEventListener('error', () => {
				errorMessage = 'Terminal connection failed';
				status = 'Disconnected';
			});
		};

		void start();

		return () => {
			disposed = true;
			resizeObserver?.disconnect();
			socket?.close();
			terminal?.dispose();
		};
	});
</script>

<div class="terminal-shell">
	<div class="terminal-meta">
		<div>
			<p class="label">Session</p>
			<strong>{status}</strong>
		</div>
		<div>
			<p class="label">Working directory</p>
			<strong>{connectedCwd}</strong>
		</div>
	</div>
	<div bind:this={container} class="terminal"></div>
	{#if errorMessage}
		<p class="error">{errorMessage}</p>
	{/if}
</div>

<style>
	.terminal-shell {
		display: grid;
		gap: 14px;
	}

	.terminal-meta {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16px;
	}

	.label {
		margin: 0 0 6px;
		font-size: 0.74rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #8eb4ff;
	}

	strong {
		font-size: 0.95rem;
		font-weight: 650;
		color: #eff5ff;
	}

	.terminal {
		height: 320px;
		border-radius: 18px;
		padding: 14px;
		background: #07111f;
		overflow: hidden;
	}

	.error {
		margin: 0;
		color: #ffb4b4;
	}

	@media (max-width: 720px) {
		.terminal-meta {
			grid-template-columns: 1fr;
		}

		.terminal {
			height: 260px;
		}
	}
</style>
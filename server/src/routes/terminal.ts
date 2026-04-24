import websocket from '@fastify/websocket';
import type { FastifyPluginAsync } from 'fastify';

import { FileServiceError } from '../services/fs.js';
import {
	createTerminalSession,
	parseTerminalDimension
} from '../services/terminal.js';

type TerminalClientMessage =
	| { type: 'input'; data: string }
	| { type: 'resize'; cols: number; rows: number };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

export const terminalRoutes: FastifyPluginAsync = async (app) => {
	await app.register(websocket);

	app.get('/api/terminal/socket', { websocket: true }, async (socket, request) => {
		let closed = false;
		let killTerminal: (() => void) | null = null;

		const closeConnection = () => {
			if (closed) {
				return;
			}

			closed = true;
			killTerminal?.();
		};

		try {
			const query = isRecord(request.query) ? request.query : {};
			const session = await createTerminalSession({
				cwd: typeof query.cwd === 'string' ? query.cwd : undefined,
				cols: parseTerminalDimension(query.cols, 120),
				rows: parseTerminalDimension(query.rows, 32)
			});

			killTerminal = () => {
				try {
					session.terminal.kill();
				} catch {
					// Ignore terminal shutdown races on socket close.
				}
			};

			socket.send(
				JSON.stringify({
					type: 'ready',
					cwd: session.cwd,
					shell: session.shell
				})
			);

			session.terminal.onData((data) => {
				if (socket.readyState === 1) {
					socket.send(JSON.stringify({ type: 'output', data }));
				}
			});

			session.terminal.onExit(({ exitCode, signal }) => {
				if (socket.readyState === 1) {
					socket.send(JSON.stringify({ type: 'exit', exitCode, signal }));
					socket.close();
				}
			});

			socket.on('message', (rawMessage: Buffer) => {
				let parsedMessage: TerminalClientMessage | null = null;

				try {
					parsedMessage = JSON.parse(rawMessage.toString()) as TerminalClientMessage;
				} catch {
					return;
				}

				if (!parsedMessage || typeof parsedMessage !== 'object' || !('type' in parsedMessage)) {
					return;
				}

				if (parsedMessage.type === 'input' && typeof parsedMessage.data === 'string') {
					session.terminal.write(parsedMessage.data);
					return;
				}

				if (
					parsedMessage.type === 'resize' &&
					typeof parsedMessage.cols === 'number' &&
					typeof parsedMessage.rows === 'number'
				) {
					session.terminal.resize(
						parseTerminalDimension(String(parsedMessage.cols), 120),
						parseTerminalDimension(String(parsedMessage.rows), 32)
					);
				}
			});

			socket.on('close', closeConnection);
			socket.on('error', closeConnection);
		} catch (error) {
			const message =
				error instanceof FileServiceError
					? error.message
					: error instanceof Error
						? error.message
						: 'Unable to open terminal';

			app.log.error(error);

			if (socket.readyState === 1) {
				socket.send(JSON.stringify({ type: 'error', error: message }));
				socket.close();
			}

			closeConnection();
		}
	});
};
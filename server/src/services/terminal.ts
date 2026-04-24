import { promises as fs } from 'node:fs';
import path from 'node:path';

import pty from 'node-pty';

import { FileServiceError } from './fs.js';

const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 32;

function getDefaultCwd() {
	return process.cwd();
}

function normalizeDirectoryPath(requestedPath?: string) {
	if (!requestedPath || requestedPath === '/') {
		return getDefaultCwd();
	}

	if (process.platform === 'win32') {
		const windowsPath = requestedPath.replaceAll('/', '\\');

		if (!path.win32.isAbsolute(windowsPath)) {
			throw new FileServiceError('Requested terminal path must be an absolute path', 400);
		}

		return path.win32.normalize(windowsPath);
	}

	if (!path.posix.isAbsolute(requestedPath)) {
		throw new FileServiceError('Requested terminal path must be an absolute path', 400);
	}

	return path.posix.normalize(requestedPath);
}

function getShellCommand() {
	if (process.platform === 'win32') {
		return {
			command: 'cmd.exe',
			args: ['/q']
		};
	}

	return {
		command: process.env.SHELL || 'bash',
		args: []
	};
}

export function parseTerminalDimension(value: unknown, fallback: number) {
	const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;

	if (!Number.isFinite(parsed)) {
		return fallback;
	}

	return Math.min(300, Math.max(20, parsed));
}

export async function resolveTerminalCwd(requestedPath?: string) {
	const absolutePath = normalizeDirectoryPath(requestedPath);

	let stats;

	try {
		stats = await fs.stat(absolutePath);
	} catch (error) {
		if (typeof error === 'object' && error && 'code' in error) {
			if (error.code === 'ENOENT') {
				throw new FileServiceError('Requested terminal path does not exist', 404);
			}

			if (error.code === 'EACCES' || error.code === 'EPERM') {
				throw new FileServiceError('Permission denied for requested terminal path', 403);
			}
		}

		throw error;
	}

	if (!stats.isDirectory()) {
		throw new FileServiceError('Requested terminal path is not a directory', 400);
	}

	return absolutePath;
}

export async function createTerminalSession(options: {
	cwd?: string;
	cols?: number;
	rows?: number;
}) {
	const cwd = await resolveTerminalCwd(options.cwd);
	const shell = getShellCommand();
	const terminal = pty.spawn(shell.command, shell.args, {
		name: 'xterm-256color',
		cwd,
		cols: options.cols ?? DEFAULT_COLS,
		rows: options.rows ?? DEFAULT_ROWS,
		env: {
			...process.env,
			TERM: 'xterm-256color'
		}
	});

	return {
		cwd,
		shell: shell.command,
		terminal
	};
}
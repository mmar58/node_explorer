import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

import multipart from '@fastify/multipart';
import archiver from 'archiver';
import type { FastifyPluginAsync } from 'fastify';
import mime from 'mime-types';

import {
	deletePath,
	FileServiceError,
	getArchivePreview,
	getDownloadTarget,
	getFileStreamTarget,
	listDirectory,
	movePath,
	readTextFile,
	renamePath,
	resolveUploadDestination,
	writeTextFile
} from '../services/fs.js';
import { ensurePathPermission, listPermissionRoots } from '../services/permission.js';

export const fileRoutes: FastifyPluginAsync = async (app) => {
	await app.register(multipart);
	app.addHook('preHandler', app.authenticate);

	app.get<{ Querystring: { path?: string } }>('/api/files', async (request, reply) => {
		try {
			if ((!request.query.path || request.query.path === '/') && request.authUser.role !== 'admin') {
				return await listPermissionRoots(request.authUser.id);
			}

			await ensurePathPermission(request.authUser, request.query.path ?? '/', 'read');
			const payload = await listDirectory(request.query.path);
			return payload;
		} catch (error) {
			if (error instanceof FileServiceError) {
				return reply.code(error.statusCode).send({ error: error.message });
			}

			const message = error instanceof Error ? error.message : 'Unable to list directory';
			return reply.code(500).send({ error: message });
		}
	});

	app.get<{ Querystring: { path?: string } }>('/api/files/content', async (request, reply) => {
		try {
			const requestedPath = request.query.path;

			if (!requestedPath) {
				return reply.code(400).send({ error: 'The path query parameter is required' });
			}

			await ensurePathPermission(request.authUser, requestedPath, 'read');

			return await readTextFile(requestedPath);
		} catch (error) {
			if (error instanceof FileServiceError) {
				return reply.code(error.statusCode).send({ error: error.message });
			}

			const message = error instanceof Error ? error.message : 'Unable to read file';
			return reply.code(500).send({ error: message });
		}
	});

	app.put<{ Body: { path?: string; content?: string } }>('/api/files/content', async (request, reply) => {
		try {
			const requestedPath = request.body.path;

			if (!requestedPath) {
				return reply.code(400).send({ error: 'The path field is required' });
			}

			if (typeof request.body.content !== 'string') {
				return reply.code(400).send({ error: 'The content field must be a string' });
			}

			await ensurePathPermission(request.authUser, requestedPath, 'write');

			return await writeTextFile(requestedPath, request.body.content);
		} catch (error) {
			if (error instanceof FileServiceError) {
				return reply.code(error.statusCode).send({ error: error.message });
			}

			const message = error instanceof Error ? error.message : 'Unable to save file';
			return reply.code(500).send({ error: message });
		}
	});

	app.get<{ Querystring: { path?: string } }>('/api/files/blob', async (request, reply) => {
		try {
			const requestedPath = request.query.path;

			if (!requestedPath) {
				return reply.code(400).send({ error: 'The path query parameter is required' });
			}

			await ensurePathPermission(request.authUser, requestedPath, 'read');

			const target = await getFileStreamTarget(requestedPath);
			const contentType = mime.lookup(target.name) || 'application/octet-stream';
			const rangeHeader = request.headers.range;

			reply.header('Accept-Ranges', 'bytes');
			reply.header('Content-Type', contentType);
			reply.header('Content-Disposition', `inline; filename="${encodeURIComponent(target.name)}"`);

			if (rangeHeader) {
				const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);

				if (!match) {
					return reply.code(416).send({ error: 'Invalid range header' });
				}

				const start = match[1] ? Number.parseInt(match[1], 10) : 0;
				const end = match[2] ? Number.parseInt(match[2], 10) : target.size - 1;

				if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= target.size) {
					return reply.code(416).send({ error: 'Requested range is not satisfiable' });
				}

				reply.code(206);
				reply.header('Content-Range', `bytes ${start}-${end}/${target.size}`);
				reply.header('Content-Length', String(end - start + 1));
				return reply.send(createReadStream(target.absolutePath, { start, end }));
			}

			reply.header('Content-Length', String(target.size));
			return reply.send(createReadStream(target.absolutePath));
		} catch (error) {
			if (error instanceof FileServiceError) {
				return reply.code(error.statusCode).send({ error: error.message });
			}

			const message = error instanceof Error ? error.message : 'Unable to stream file';
			return reply.code(500).send({ error: message });
		}
	});

	app.get<{ Querystring: { path?: string } }>('/api/files/download', async (request, reply) => {
		try {
			const requestedPath = request.query.path;

			if (!requestedPath) {
				return reply.code(400).send({ error: 'The path query parameter is required' });
			}

			await ensurePathPermission(request.authUser, requestedPath, 'read');

			const target = await getDownloadTarget(requestedPath);

			if (!target.isDirectory) {
				reply.header('Content-Type', mime.lookup(target.name) || 'application/octet-stream');
				reply.header('Content-Length', String(target.size));
				reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(target.name)}"`);
				return reply.send(createReadStream(target.absolutePath));
			}

			reply.header('Content-Type', 'application/zip');
			reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(target.name)}.zip"`);

			const archive = archiver('zip', { zlib: { level: 9 } });
			archive.on('error', (archiveError: Error) => {
				throw archiveError;
			});

			archive.directory(target.absolutePath, false);
			void archive.finalize();
			return reply.send(archive);
		} catch (error) {
			if (error instanceof FileServiceError) {
				return reply.code(error.statusCode).send({ error: error.message });
			}

			const message = error instanceof Error ? error.message : 'Unable to download item';
			return reply.code(500).send({ error: message });
		}
	});

	app.get<{ Querystring: { path?: string } }>('/api/files/archive', async (request, reply) => {
		try {
			const requestedPath = request.query.path;

			if (!requestedPath) {
				return reply.code(400).send({ error: 'The path query parameter is required' });
			}

			await ensurePathPermission(request.authUser, requestedPath, 'read');

			return await getArchivePreview(requestedPath);
		} catch (error) {
			if (error instanceof FileServiceError) {
				return reply.code(error.statusCode).send({ error: error.message });
			}

			const message = error instanceof Error ? error.message : 'Unable to inspect archive';
			return reply.code(500).send({ error: message });
		}
	});

	app.post<{ Querystring: { path?: string } }>('/api/files/upload', async (request, reply) => {
		try {
			const destinationPath = request.query.path;

			if (!destinationPath) {
				return reply.code(400).send({ error: 'The path query parameter is required' });
			}

			await ensurePathPermission(request.authUser, destinationPath, 'write');

			const uploaded: Array<{ path: string; name: string }> = [];

			for await (const part of request.parts()) {
				if (part.type !== 'file') {
					continue;
				}

				const relativeName = part.filename || part.fieldname;
				const destination = await resolveUploadDestination(destinationPath, relativeName);
				await pipeline(part.file, createWriteStream(destination.absolutePath));
				uploaded.push({ path: destination.path, name: destination.name });
			}

			if (uploaded.length === 0) {
				return reply.code(400).send({ error: 'At least one file upload is required' });
			}

			return { uploaded };
		} catch (error) {
			if (error instanceof FileServiceError) {
				return reply.code(error.statusCode).send({ error: error.message });
			}

			const message = error instanceof Error ? error.message : 'Unable to upload files';
			return reply.code(500).send({ error: message });
		}
	});

	app.delete<{ Querystring: { path?: string } }>('/api/files', async (request, reply) => {
		try {
			const requestedPath = request.query.path;

			if (!requestedPath) {
				return reply.code(400).send({ error: 'The path query parameter is required' });
			}

			await ensurePathPermission(request.authUser, requestedPath, 'write');

			return await deletePath(requestedPath);
		} catch (error) {
			if (error instanceof FileServiceError) {
				return reply.code(error.statusCode).send({ error: error.message });
			}

			const message = error instanceof Error ? error.message : 'Unable to delete item';
			return reply.code(500).send({ error: message });
		}
	});

	app.patch<{ Body: { path?: string; name?: string } }>('/api/files/rename', async (request, reply) => {
		try {
			const requestedPath = request.body.path;

			if (!requestedPath) {
				return reply.code(400).send({ error: 'The path field is required' });
			}

			if (typeof request.body.name !== 'string') {
				return reply.code(400).send({ error: 'The name field must be a string' });
			}

			await ensurePathPermission(request.authUser, requestedPath, 'write');

			return await renamePath(requestedPath, request.body.name);
		} catch (error) {
			if (error instanceof FileServiceError) {
				return reply.code(error.statusCode).send({ error: error.message });
			}

			const message = error instanceof Error ? error.message : 'Unable to rename item';
			return reply.code(500).send({ error: message });
		}
	});

	app.patch<{ Body: { path?: string; destinationPath?: string } }>('/api/files/move', async (request, reply) => {
		try {
			const requestedPath = request.body.path;

			if (!requestedPath) {
				return reply.code(400).send({ error: 'The path field is required' });
			}

			if (typeof request.body.destinationPath !== 'string') {
				return reply.code(400).send({ error: 'The destinationPath field must be a string' });
			}

			await ensurePathPermission(request.authUser, requestedPath, 'write');
			await ensurePathPermission(request.authUser, request.body.destinationPath, 'write');

			return await movePath(requestedPath, request.body.destinationPath);
		} catch (error) {
			if (error instanceof FileServiceError) {
				return reply.code(error.statusCode).send({ error: error.message });
			}

			const message = error instanceof Error ? error.message : 'Unable to move item';
			return reply.code(500).send({ error: message });
		}
	});
};
# Architecture

## Overview

Node Explorer is planned as a split frontend and backend system:

- `client/`: browser UI built with SvelteKit
- `server/`: backend API and realtime services built with Fastify and TypeScript

The system is intended to grow in thin vertical slices rather than large isolated scaffolding phases.

## Current Implemented Architecture

### Client

The client currently has:

- A top-level Svelte layout
- A home page that combines directory browsing, editor tabs, popup previews, context menus, uploads/downloads, and an embedded terminal
- A small typed API wrapper in `client/src/lib/api.ts`
- A Monaco-based code editor component for UTF-8 text files
- An xterm.js terminal component connected to the backend websocket
- Popup preview and context-menu components for file-type-specific actions

### Server

The server currently has:

- `src/index.ts`: app bootstrap and route registration
- `src/config.ts`: runtime host, JWT, and MySQL configuration loaded from `server/.env`
- `src/db/knex.ts`: Knex client setup and schema bootstrap/repair for `users` and `permissions`
- `src/routes/health.ts`: liveness endpoint
- `src/routes/auth.ts`: register, login, and current-session endpoints
- `src/routes/admin.ts`: admin user/permission endpoints
- `src/routes/files.ts`: directory listing plus preview, upload, download, archive, and text-file edit endpoints
- `src/routes/terminal.ts`: websocket route for terminal sessions
- `src/plugins/auth.ts`: JWT verification and route hooks (`authenticate`, `requireAdmin`)
- `src/services/fs.ts`: host-filesystem directory reads, Windows drive discovery, parent-path calculation, upload-path validation, archive inspection, and text-file read/write helpers
- `src/services/terminal.ts`: PTY session setup and working-directory validation
- `src/services/auth.ts`: user registration/login, permission CRUD, and admin-facing listings
- `src/services/permission.ts`: path normalization and per-path authorization checks

The server also ships `server/schema.sql` for manual database bootstrap in environments where schema creation is preferred outside runtime startup.

The current files API exposes the host filesystem. On Windows, the API uses a virtual `/` that lists available drive roots and then navigates using absolute paths such as `C:/Users`.

The current browser slice routes file opening by type on the client: known text/code files open in Monaco tabs, images/video/audio/PDFs open through the streamed blob endpoint, and zip files use an archive-inspection endpoint for inline previews.

The terminal slice currently uses `@fastify/websocket` and `node-pty` directly. Each websocket connection creates one PTY process, streams output back to the browser, and accepts input and resize events from the client.

## Planned Architecture

### Frontend

Target frontend areas:

- Login
- File browser with route-based path navigation
- Upload and remote-fetch dialogs
- Terminal view
- Editor view
- Media preview
- Admin views for users, permissions, and access requests

### Backend

Target backend layers:

- Auth plugin and JWT verification
- File routes and services
- Upload and download services
- Remote fetch job manager with pause and resume
- Terminal service via node-pty
- Permission resolution service
- Archive service for zip and unzip
- Socket.IO namespaces for terminal, file watch, and transfer progress

## Data Layer Plan

- MySQL via Knex for users and path permissions
- SQLite for local, high-frequency, resumable state such as transfer jobs and chunk offsets

## Security Model

Core rules:

- Normalize all filesystem paths server-side
- Validate requested paths as absolute host paths before file operations
- Add per-folder permission checks before enabling mutations or shell access
- Limit public links to short-lived signed download tokens

## Implementation Approach

The current codebase is following this sequence:

1. Safe read-only backend slices
2. Client integration for those slices
3. Narrow mutations that keep validation in the filesystem service
4. Auth and permission boundaries
5. Transfer workflows, richer terminal/editor flows, and admin features
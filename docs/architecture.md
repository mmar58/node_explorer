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
- A home page that fetches directory listings from the backend
- A small typed API wrapper in `client/src/lib/api.ts`

### Server

The server currently has:

- `src/index.ts`: app bootstrap and route registration
- `src/config.ts`: runtime host and port configuration
- `src/routes/health.ts`: liveness endpoint
- `src/routes/files.ts`: directory listing endpoint
- `src/services/fs.ts`: host-filesystem directory reads, Windows drive discovery, and parent-path calculation

The current files API exposes the host filesystem. On Windows, the API uses a virtual `/` that lists available drive roots and then navigates using absolute paths such as `C:/Users`.

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

- MySQL via Knex for durable application data
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
3. Auth and permission boundaries
4. Mutations and transfer workflows
5. Terminal, editor, and admin features
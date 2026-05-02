# Architecture

This document describes the current Node Explorer architecture in detail, plus the near-term extension points. It is written to help with deep technical explanations in demos and interviews.

## 1) System Summary

Node Explorer is a split web application:

- `client/`: SvelteKit browser application (single-page workspace shell)
- `server/`: Fastify + TypeScript backend (REST + websocket terminal)
- MySQL (via Knex): users and per-path permissions
- Host filesystem: source of truth for files and directories

Current scope is a production-style vertical slice: authentication, permission-aware filesystem operations, browser previews and editing, and PTY-backed terminal access.

## 2) High-Level Component View

```text
Browser (SvelteKit UI)
	-> Typed API client
	-> REST calls (auth, files, admin)
	-> WebSocket (terminal)

Fastify Server
	-> Plugins (CORS, JWT auth decorators, websocket)
	-> Route modules (health, auth, admin, files, terminal)
	-> Service layer (auth, permission, fs, terminal)
	-> Knex/MySQL for identity + policy
	-> Host filesystem + node-pty for file and shell operations
```

## 3) Why Fastify In This Project

Fastify is used instead of Express mainly for:

- Performance-focused JSON API handling
- Strong TypeScript ergonomics for route typing
- Plugin and encapsulation model that matches this codebase
- Official plugin ecosystem used here: `@fastify/cors`, `@fastify/jwt`, `@fastify/multipart`, `@fastify/websocket`

In practical terms, this project benefits from Fastify's plugin/decorator model for auth (`authenticate`, `requireAdmin`, `verifyAuth`) and composable route registration.

## 4) Runtime Boot Sequence

Server startup flow:

1. Create Fastify app with logging.
2. Register CORS plugin.
3. Register auth plugin (adds JWT and auth decorators).
4. Ensure database schema exists for users/permissions.
5. Register route modules: health, auth, admin, files, terminal.
6. Start listening on configured host/port.

This flow lives in `server/src/index.ts` and keeps startup deterministic and easy to reason about.

## 5) Backend Layering

### 5.1 Entry + Plugins

- `server/src/index.ts`: application composition root
- `server/src/plugins/auth.ts`: JWT registration and app decorators for authorization

The auth plugin exposes three core decorators used across routes:

- `verifyAuth(request)`: parse token and decode identity
- `authenticate(request, reply)`: block unauthenticated requests
- `requireAdmin(request, reply)`: block non-admin requests

### 5.2 Route Modules

- `server/src/routes/health.ts`: health probe
- `server/src/routes/auth.ts`: register, login, session restore (`/api/auth/me`)
- `server/src/routes/admin.ts`: list users, create/update/delete permissions
- `server/src/routes/files.ts`: listing, content read/write, preview stream, upload, download, archive listing, delete, rename, move
- `server/src/routes/terminal.ts`: websocket endpoint backed by PTY

Route handlers are intentionally thin: they validate HTTP-level input, call services, and map service errors to stable HTTP responses.

### 5.3 Service Modules

- `server/src/services/auth.ts`
	- user registration/login
	- role assignment (first user becomes admin)
	- user and permission admin operations
- `server/src/services/permission.ts`
	- normalize and validate absolute paths
	- determine best matching permission path
	- enforce read/write policy per authenticated user
	- list non-admin permission roots at virtual `/`
- `server/src/services/fs.ts`
	- safe absolute-path normalization
	- cross-platform path conversion (Windows and POSIX)
	- directory listing and parent path calculations
	- text file read/write with UTF-8 + size checks
	- blob streaming with range support
	- upload destination validation (prevent traversal)
	- rename/move/delete with root-path protections
	- zip entry inspection
- `server/src/services/terminal.ts`
	- PTY creation and shell/cwd validation
	- terminal dimension parsing and lifecycle helpers

This separation keeps policy and filesystem safety out of route glue code.

### 5.4 Data Access

- `server/src/db/knex.ts`: Knex initialization and schema assurance
- `server/schema.sql`: SQL bootstrap option for external DB setup workflows

Current persistent model is MySQL-only for authentication and permissions.

## 6) Client Architecture

### 6.1 UI Composition

The main workspace UI currently lives in `client/src/routes/+page.svelte` and composes:

- file browser state
- tabbed editor state
- modal preview state
- context-menu state
- terminal panel state
- auth/admin panel state
- toast notifications
- bookmark state (folders, shortcuts, active folder, last-saved folder)

### 6.2 Client Utilities and Components

- `client/src/lib/api.ts`: typed API wrapper and shared DTO types
- `client/src/lib/components/CodeEditor.svelte`: Monaco-backed editor integration
- `client/src/lib/components/Terminal.svelte`: xterm-based terminal connected to backend websocket
- `client/src/lib/components/FilePreviewModal.svelte`: media/archive/document previews
- `client/src/lib/components/FileContextMenu.svelte`: contextual file actions
- `client/src/lib/components/ToastStack.svelte`: feedback and error messages

Bookmarks are stored per-user in `localStorage` under the key `node-explorer.bookmarks.<username>`, with the last-used folder tracked separately under `node-explorer.bookmarks.last-folder.<username>`. The bookmark UI includes:

- A **top-navbar dropdown** listing all bookmarks grouped by folder, with quick-open on click and actions to bookmark the current location or open the manager.
- A **save-bookmark dialog** with editable name, path, and a folder `<select>` that defaults to the last folder used for saving.
- A **manage-bookmarks popup** for creating and renaming folders, moving bookmarks between folders, and removing bookmarks or whole folders.

The client chooses behavior by file type:

- text/code: open editable tab
- media/document: open preview modal via blob endpoint
- zip: fetch archive listing for inspection

## 7) Data Model (Current)

Core MySQL tables:

- `users`
	- identity credentials and role (`admin` or `user`)
- `permissions`
	- user-scoped absolute path grants with level (`read` or `write`)

Authorization model:

- Admin users bypass path-level restrictions.
- Non-admin users require a matching permission path.
- Most-specific path match wins (longest matching prefix).
- Required level must satisfy operation (`read` for listing/preview, `write` for mutate/terminal cwd).

## 8) Security and Safety Boundaries

The server enforces safety at multiple points:

- Path normalization for all incoming filesystem paths
- Absolute-path requirement for host operations
- Filesystem-root mutation protections (for delete/rename/move)
- Upload relative-path normalization to block `..` traversal
- Permission checks before file mutation and terminal session setup
- JWT auth enforced for protected APIs and websocket terminal access

This reduces risk from malformed inputs and limits blast radius for non-admin users.

## 9) Core Runtime Flows

### 9.1 Login and Session

1. User submits credentials.
2. Auth route validates via auth service.
3. Server signs JWT and returns token + user payload.
4. Client stores token and uses it on future calls.
5. `/api/auth/me` restores user + permission state.

### 9.2 Directory Listing

1. Client requests `/api/files?path=...`.
2. Route pre-handler verifies auth.
3. Permission service enforces read access.
4. FS service lists entries and computes `parentPath`.
5. Client renders entries and navigation.

### 9.3 Text Editing

1. Client loads file with `/api/files/content`.
2. FS service validates it is a text file and within size limit.
3. User edits in Monaco tab.
4. Client saves via `PUT /api/files/content`.
5. Permission and fs services enforce write safety.

### 9.4 Preview and Download

- Inline preview: `/api/files/blob` streams file; supports byte ranges for media seek.
- Download:
	- files stream directly as attachment
	- directories stream as generated zip archive

### 9.5 Upload

1. Client sends multipart upload to `/api/files/upload?path=...`.
2. Server iterates parts as streams.
3. FS service resolves safe destination paths.
4. Files are piped to disk without in-memory buffering.

### 9.6 Terminal Session

1. Client opens websocket `/api/terminal/socket` (with token).
2. Server validates auth and `cwd` permission.
3. PTY session is created with node-pty.
4. Output streams to client as websocket messages.
5. Client sends input and resize events.
6. PTY exits and server closes socket.

## 10) Observability and Error Handling

- Fastify logger is enabled at app level.
- Services throw typed domain errors with status codes.
- Routes consistently convert domain errors into HTTP responses.
- Unknown errors return controlled 500 responses.

This keeps behavior predictable for the client while preserving server-side logs for debugging.

## 11) Current Constraints and Tradeoffs

- Main client view is feature-rich but concentrated in a single route file, which increases cognitive load.
- Route-level validation is currently mostly manual rather than schema-driven.
- Realtime is currently websocket-only for terminal; broader event channels are still planned.

These are acceptable for the current vertical-slice stage and are clear refactoring opportunities.

## 12) Planned Extensions (Not Yet Implemented)

Roadmap-aligned architecture additions:

- Remote fetch from URL with pause/resume and progress tracking
- More admin lifecycle flows and access-request workflows
- Broader archive operations (for example extract)
- Potential richer realtime channels and transfer orchestration state

Planned items should be treated as target architecture, not current behavior.

## 13) Interview Talk Track (Short Version)

Use this structure for detailed explanation:

1. Define the system boundary: browser UI + API server + MySQL + host filesystem.
2. Explain Fastify choice: plugin architecture, TS fit, performance profile.
3. Walk startup: register plugins, ensure schema, mount routes.
4. Explain layered backend: routes for transport, services for policy and filesystem logic.
5. Deep dive permission model: absolute path normalization and most-specific grant matching.
6. Walk one read flow and one write flow end-to-end.
7. Explain terminal websocket security and PTY lifecycle.
8. Close with roadmap gaps and why they are staged next.
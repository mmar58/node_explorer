# Node Explorer

Node Explorer is a self-hosted server file manager built with SvelteKit and Node.js. The target product includes file browsing, upload and download, resumable remote fetch from URL, terminal access, code editing, zip and unzip, and per-folder access control.

The repository currently contains the first end-to-end slice:

- A Svelte client in `client/`
- A Fastify server in `server/`
- Working filesystem browsing plus UTF-8 text-file read and save endpoints
- A browser workspace UI with file browsing, code editing, and an embedded terminal

## Current Status

Implemented now:

- Fastify server scaffold with TypeScript
- `GET /api/health`
- `GET /api/files?path=/...`
- `GET /api/files/content?path=/...`
- `PUT /api/files/content`
- `GET /api/terminal/socket` websocket endpoint backed by a PTY
- Absolute-path browsing across the serving machine
- Windows drive listing at `/` with parent-path aware navigation
- Browser UI on the client home page with directory navigation, text editing, and terminal access

Planned next:

- Auth and permissions
- File actions: stat, mkdir, rename, move, copy, delete
- Upload, download, and resumable remote fetch from URL
- Media preview, admin panel, archive operations, and richer permission-aware terminal/editor workflows

## Tech Stack

- Frontend: SvelteKit 5, Tailwind CSS v4, shadcn-svelte, Lucide
- Backend: Node.js, TypeScript, Fastify
- Current browser tools: Monaco Editor, xterm.js, node-pty, Fastify websocket
- Database plan: MySQL via Knex, plus SQLite for instant job and transfer state
- Realtime plan: Socket.IO
- File transfer plan: busboy, tus, range-aware downloads
- Terminal plan: permission-aware sessions and richer multi-tab management on top of the current PTY slice

## Repository Layout

```text
node_explorer/
├── client/         # SvelteKit frontend
├── server/         # Fastify backend
├── docs/           # Project documentation
├── Instructions.md # Product and implementation plan
├── README.md
└── AGENTS.md
```

## Quick Start

### Prerequisites

- Node.js 22+ recommended
- pnpm 10+

### Install

```bash
pnpm --dir client install
pnpm --dir server install
```

### Run

In one terminal:

```bash
pnpm dev:server
```

In another terminal:

```bash
pnpm dev:client
```

### Check

```bash
pnpm check:server
pnpm check:client
```

## Configuration

The backend currently supports these environment variables:

- `PORT`: backend port, defaults to `3001`
- `HOST`: backend host, defaults to `127.0.0.1`
- `PUBLIC_API_BASE_URL`: optional client-side API base URL, defaults to `http://127.0.0.1:3001`

## Documentation

- [docs/setup.md](docs/setup.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/api.md](docs/api.md)
- [docs/roadmap.md](docs/roadmap.md)
- [Instructions.md](Instructions.md)

## Notes

- The current implementation is still intentionally narrow: directory browsing, UTF-8 text-file editing up to 1 MB, and one PTY-backed terminal view, validated end to end.
- The broader product scope is tracked in `Instructions.md` and summarized in `docs/roadmap.md`.
- Use pnpm only. Do not mix npm or yarn into this workspace.
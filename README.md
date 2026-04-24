# Node Explorer

Node Explorer is a self-hosted server file manager built with SvelteKit and Node.js. The target product includes file browsing, upload and download, resumable remote fetch from URL, terminal access, code editing, zip and unzip, and per-folder access control.

The repository currently contains the first end-to-end slice:

- A Svelte client in `client/`
- A Fastify server in `server/`
- A working `GET /api/files` endpoint that can browse the host filesystem
- A minimal frontend file browser wired to the backend

## Current Status

Implemented now:

- Fastify server scaffold with TypeScript
- `GET /api/health`
- `GET /api/files?path=/...`
- Absolute-path browsing across the serving machine
- Windows drive listing at `/` with parent-path aware navigation
- Minimal browser UI on the client home page

Planned next:

- Auth and permissions
- File actions: stat, mkdir, rename, move, copy, delete
- Upload, download, and resumable remote fetch from URL
- Terminal, code editor, media preview, admin panel, archive operations

## Tech Stack

- Frontend: SvelteKit 5, Tailwind CSS v4, shadcn-svelte, Lucide
- Backend: Node.js, TypeScript, Fastify
- Database plan: MySQL via Knex, plus SQLite for instant job and transfer state
- Realtime plan: Socket.IO
- File transfer plan: busboy, tus, range-aware downloads
- Terminal plan: node-pty

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

- The current implementation is intentionally narrow: one backend route and one client view, validated end to end.
- The broader product scope is tracked in `Instructions.md` and summarized in `docs/roadmap.md`.
- Use pnpm only. Do not mix npm or yarn into this workspace.
# Setup

## Requirements

- Node.js 22+ recommended
- pnpm 10+

## Install Dependencies

From the repository root:

```bash
pnpm --dir client install
pnpm --dir server install
```

## Start Development

Backend:

```bash
pnpm dev:server
```

Frontend:

```bash
pnpm dev:client
```

## Type Checks

```bash
pnpm check:server
pnpm check:client
```

## Environment Variables

### Server

- `PORT`: backend port, default `3001`
- `HOST`: backend host, default `127.0.0.1`

### Client

- `PUBLIC_API_BASE_URL`: backend origin used by the browser client; defaults to `http://127.0.0.1:3001`

## First Verification

After starting the backend, these checks should succeed:

- `GET http://127.0.0.1:3001/api/health`
- `GET http://127.0.0.1:3001/api/files?path=/`

On Windows, the `/api/files?path=/` response should list available drives such as `C:/` and `D:/`.

After starting the frontend, the home page should render a file browser that lists the device root contents and allows navigation into absolute paths.

## Current Limitations

- No auth yet
- No database wiring yet
- No file mutations yet
- No upload/download workflows yet

Those are planned and tracked in `Instructions.md` and `docs/roadmap.md`.
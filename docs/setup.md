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
- `JWT_SECRET`: JWT signing secret used for login tokens
- `DB_HOST`: MySQL host, default `127.0.0.1`
- `DB_PORT`: MySQL port, default `3306`
- `DB_USER`: MySQL user, default `root`
- `DB_PASSWORD`: MySQL password, default empty
- `DB_NAME`: MySQL database name, default `node_explorer`

### Client

- `PUBLIC_API_BASE_URL`: backend origin used by the browser client; defaults to `http://127.0.0.1:3001`

## First Verification

Before starting the backend, create the MySQL database named by `DB_NAME`. You can either run `server/schema.sql` manually or let the server create the `users` and `permissions` tables automatically on boot.

After starting the backend, these checks should succeed:

- `GET http://127.0.0.1:3001/api/health`
- `POST http://127.0.0.1:3001/api/auth/register`

Registering the first user creates the administrator account. After login, all file, preview, upload, download, editor, and terminal requests require the bearer token returned by the auth endpoints.

After starting the frontend, the home page should first render the login or registration screen. After login, the workspace should render only the roots available to the current user. Administrators can assign per-path `read` or `write` access from the built-in access panel.

## Current Limitations

- Permissions are path-based and explicit; non-admin users do not automatically inherit global root access
- The first registered user becomes the administrator automatically
- Auth currently uses bearer tokens stored in browser local storage rather than httpOnly cookies

Those are planned and tracked in `Instructions.md` and `docs/roadmap.md`.
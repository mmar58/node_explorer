# About
A self-hosted server file manager. Users browse server directories, manage files, run terminal commands, edit code, and upload/download files — all governed by a per-folder permission system.

---

# Tech Stack

| Layer | Choice |
|---|---|
| Package manager | pnpm |
| Frontend | SvelteKit 5 + Tailwind CSS v4 + shadcn-svelte + Lucide |
| Backend | Node.js + TypeScript (`tsx` for running, `tsc` for build) |
| HTTP server | Fastify (fast, schema-first, good streaming support) |
| Real-time | Socket.IO (terminal output, file-watch events) |
| Database | MySQL via Knex |
| Instant/cache data | better-sqlite3 (session tokens, temp state, upload chunks metadata) |
| Auth | JWT (access token) + bcrypt (password hashing) |
| File upload | Busboy (streaming, avoids temp files) + tus-node-server for resumable uploads |
| File download | Native HTTP Range requests (no extra package, enables resume/pause in browser) |
| Zip / Unzip | archiver (create) + unzipper (extract) |
| Terminal | node-pty (pseudo-terminal, real PTY, not just child_process) |
| File watching | chokidar (live directory updates pushed via Socket.IO) |
| Code editing | Monaco Editor (loaded in client via CDN or npm) |
| Media preview | Native browser `<video>`, `<audio>`, `<img>` with a signed URL |
| Remote fetch (upload from link) | got-scraping (follows redirects, spoofs UA) + SQLite for job state + Socket.IO for live progress |

---

# Project Structure

```
node_explorer/
├── client/               # SvelteKit frontend (already initialized)
│   └── src/
│       ├── routes/
│       │   ├── +layout.svelte          # App shell (sidebar, topbar)
│       │   ├── +page.svelte            # Redirect to /files
│       │   ├── login/+page.svelte
│       │   ├── files/
│       │   │   ├── +page.svelte        # Root file browser
│       │   │   └── [...path]/+page.svelte  # Deep path browser
│       │   ├── terminal/+page.svelte   # Embedded terminal tab
│       │   ├── editor/+page.svelte     # Monaco code editor
│       │   └── admin/
│       │       ├── users/+page.svelte  # User management
│       │       └── permissions/+page.svelte
│       └── lib/
│           ├── api.ts         # Typed fetch wrapper (base URL, auth headers)
│           ├── socket.ts      # Socket.IO client singleton
│           ├── stores/        # Svelte stores (auth, current path, clipboard)
│           └── components/
│               ├── ui/        # shadcn-svelte primitives (already here)
│               ├── FileGrid.svelte
│               ├── FileRow.svelte
│               ├── ContextMenu.svelte
│               ├── UploadDropzone.svelte
│               ├── RemoteFetchDialog.svelte
│               ├── ProgressBar.svelte
│               ├── Terminal.svelte
│               ├── MediaViewer.svelte
│               └── PermissionBadge.svelte
│
└── server/               # Backend (to be created)
    ├── src/
    │   ├── index.ts           # Fastify app entry, register plugins
    │   ├── config.ts          # Env vars (DB, JWT secret, root paths)
    │   ├── db/
    │   │   ├── knex.ts        # Knex instance (MySQL)
    │   │   ├── sqlite.ts      # better-sqlite3 instance
    │   │   └── migrations/    # Knex migration files
    │   ├── plugins/
    │   │   ├── auth.ts        # JWT verify hook, fastify-plugin
    │   │   └── socket.ts      # Socket.IO attach to Fastify server
    │   ├── routes/
    │   │   ├── auth.ts        # POST /auth/login, POST /auth/logout
    │   │   ├── files.ts       # GET/POST/PUT/DELETE /files/*
    │   │   ├── upload.ts      # POST /upload (busboy streaming)
    │   │   ├── download.ts    # GET /download (range-aware streaming)
    │   │   ├── terminal.ts    # Socket.IO namespace /terminal
    │   │   ├── zip.ts         # POST /zip, POST /unzip
    │   │   └── admin.ts       # Users + permissions CRUD
    │   └── services/
    │       ├── fs.ts          # All fs operations (stat, list, rename, etc.)
    │       ├── permission.ts  # Permission resolution (inheritance logic)
    │       ├── transfer.ts    # Upload/download, chunk tracking in SQLite
    │       └── archive.ts     # Zip/unzip wrappers
    └── package.json
```

---

# Database Schema (MySQL via Knex)

### `users`
| column | type | notes |
|---|---|---|
| id | int PK AI | |
| username | varchar(64) unique | |
| password_hash | varchar(255) | bcrypt |
| role | enum('admin','user') | |
| created_at | timestamp | |

### `permissions`
| column | type | notes |
|---|---|---|
| id | int PK AI | |
| user_id | int FK | |
| path | varchar(1024) | absolute server path |
| level | enum('none','read','write') | |
| created_at | timestamp | |

### `access_requests`
| column | type | notes |
|---|---|---|
| id | int PK AI | |
| user_id | int FK | |
| path | varchar(1024) | |
| status | enum('pending','approved','denied') | |
| requested_at | timestamp | |

### `remote_fetch_jobs` (SQLite — instant state, no MySQL needed)
| column | type | notes |
|---|---|---|
| id | text PK | nanoid |
| user_id | int | |
| url | text | original remote URL |
| dest_path | text | absolute server destination path |
| filename | text | resolved filename |
| total_bytes | int | -1 if unknown (no Content-Length) |
| downloaded_bytes | int | bytes written so far |
| status | text | `queued` \| `downloading` \| `paused` \| `done` \| `error` |
| error | text | last error message if any |
| created_at | text | ISO timestamp |
| updated_at | text | ISO timestamp |

**Permission resolution rule:** Walk up the path tree, use the most specific matching row. If no row exists, deny. Admins bypass all checks.

---

# API Design

```
Auth
  POST   /api/auth/login          { username, password } → { token }
  POST   /api/auth/logout

Files
  GET    /api/files?path=...       List directory contents + metadata
  GET    /api/files/stat?path=...  Single item stat (size, mtime, type)
  POST   /api/files/rename        { from, to }
  POST   /api/files/move          { src, dest }
  POST   /api/files/copy          { src, dest }
  DELETE /api/files               { path }
  POST   /api/files/mkdir         { path }

Download
  GET    /api/download?path=...    Supports Range header (resume/pause)
  POST   /api/download/link       { path, expiresIn } → { token, url }
  GET    /api/download/link/:token (public, no auth — uses signed token)

Upload
  POST   /api/upload?path=...      Multipart stream via busboy
  PATCH  /api/upload/tus/:id       Resumable upload (tus protocol)
  HEAD   /api/upload/tus/:id       Check upload offset

Remote Fetch (upload from URL)
  POST   /api/fetch                { url, destPath } → { jobId }  Start server-side download
  GET    /api/fetch/:jobId         → job state (status, progress, filename)
  POST   /api/fetch/:jobId/pause   Pause an in-progress job
  POST   /api/fetch/:jobId/resume  Resume a paused job
  DELETE /api/fetch/:jobId         Cancel + delete partial file
  GET    /api/fetch                List all jobs for current user

Zip
  POST   /api/zip                 { paths[], dest }
  POST   /api/unzip               { path, dest }

Admin
  GET    /api/admin/users
  POST   /api/admin/users
  DELETE /api/admin/users/:id
  GET    /api/admin/permissions?userId=...
  PUT    /api/admin/permissions
  GET    /api/admin/requests       Pending access requests
  PUT    /api/admin/requests/:id   Approve/deny

Access Requests (user-facing)
  POST   /api/access/request       { path }
  GET    /api/access/requests      My requests + status
```

Socket.IO events:
```
/terminal  → client sends: { cols, rows } on connect; input strings
           ← server sends: output chunks, exit code
/files     ← server pushes: { event: 'add'|'change'|'unlink', path } (chokidar)
/fetch     ← server pushes: { jobId, downloadedBytes, totalBytes, status, speed }
             emitted every ~500 ms while downloading; final emit on done/error/pause
```

---

# Features Checklist

### Phase 1 — Core File Browser
- [ ] Server: Fastify + Auth (JWT + bcrypt)
- [ ] Server: `GET /api/files` listing with permission check
- [ ] Server: rename, move, copy, delete, mkdir
- [ ] Client: login page, JWT stored in httpOnly cookie
- [ ] Client: `FileGrid`/`FileRow` components with icons by type
- [ ] Client: breadcrumb navigation, keyboard shortcuts (Enter, Backspace, F2)
- [ ] Client: right-click context menu (ContextMenu.svelte)

### Phase 2 — Upload & Download
- [ ] Server: streaming upload via busboy
- [ ] Server: resumable download with Range header support
- [ ] Server: signed download links (JWT with path + expiry)
- [ ] Server: resumable upload via tus protocol, chunk offsets in SQLite
- [ ] Client: drag-and-drop upload zone with progress bars
- [ ] Client: shareable download link button

### Phase 2b — Remote Fetch (Upload from URL)
- [ ] Server: `remoteFetch` service — HTTP GET with Range support, writes to temp file, tracks progress in SQLite
- [ ] Server: pause via `AbortController`, resume by appending with `Range: bytes=N-`
- [ ] Server: resolve filename from `Content-Disposition` header or URL basename
- [ ] Server: Socket.IO `/fetch` namespace pushes `{ jobId, downloadedBytes, totalBytes, status, speed }` every 500 ms
- [ ] Server: job queue (max N concurrent downloads, configurable)
- [ ] Client: `RemoteFetchDialog.svelte` — URL input + destination path picker, starts job
- [ ] Client: live progress bar per job, pause/resume/cancel buttons, speed indicator
- [ ] Client: jobs list panel (badge on sidebar showing active count)

### Phase 3 — Terminal
- [ ] Server: node-pty spawns shell, Socket.IO `/terminal` namespace
- [ ] Server: restrict shell to allowed paths based on permission
- [ ] Client: `Terminal.svelte` using xterm.js (fits in Monaco-style tab)

### Phase 4 — Code Editor & Media Viewer
- [ ] Client: `editor/+page.svelte` loads Monaco, GET file content, PUT save
- [ ] Client: `MediaViewer.svelte` renders image/video/audio via signed URL
- [ ] Server: `GET /api/files/content?path=...` (text) + `GET /api/download` (binary)

### Phase 5 — Permissions & Admin
- [ ] Server: permission inheritance resolution service
- [ ] Client: admin panel — user list, permission matrix per path
- [ ] Client: user "request access" flow with notification badge for admins
- [ ] Client: `PermissionBadge.svelte` overlaid on locked folders

### Phase 6 — Zip / Unzip
- [ ] Server: archiver streams zip into response or saves to disk
- [ ] Server: unzipper extracts to destination
- [ ] Client: right-click → "Compress" / "Extract here"

---

# Build Order (recommended)

1. **`server/` scaffold** — init package.json, install deps, `src/index.ts` with Fastify, config, MySQL + SQLite connections
2. **Knex migrations** — create all tables
3. **Auth routes** — login/logout, JWT plugin
4. **File service + routes** — list, stat, rename, delete, mkdir
5. **Permission service** — wire into all file routes
6. **Client auth** — login page, token storage, API wrapper
7. **Client file browser** — grid/list view, context menu, breadcrumb
8. **Upload** — busboy route + client dropzone
9. **Download** — range-aware stream + signed link
10. **Remote fetch** — `remoteFetch` service, SQLite job table, `/fetch` routes, Socket.IO progress, client dialog
11. **Terminal** — node-pty + xterm.js
12. **Code editor** — Monaco + file content route
13. **Media viewer**
14. **Resumable upload** (tus)
15. **Admin panel** — users + permissions + access requests
16. **Zip/Unzip**

---

# Key Packages to Install

### server/
```
pnpm add fastify @fastify/cors @fastify/cookie socket.io
pnpm add knex mysql2 better-sqlite3
pnpm add jsonwebtoken bcrypt
pnpm add busboy archiver unzipper
pnpm add node-pty chokidar mime-types
pnpm add got nanoid   # got for HTTP requests with Range support; nanoid for job IDs
pnpm add -D typescript tsx @types/node @types/better-sqlite3 @types/bcrypt @types/jsonwebtoken @types/archiver @types/node-pty
```

### client/ (additions)
```
pnpm add socket.io-client
pnpm add @xterm/xterm @xterm/addon-fit
```
Monaco Editor: load via `@monaco-editor/loader` or CDN in the editor route.

---

# Package Manager
Use `pnpm` exclusively. Never use `npm` or `yarn`.

# Notes
- All file paths sent in API requests must be validated and normalized server-side before any filesystem operation.
- Upload tmp files live in SQLite until confirmed complete.
- Signed download links use a short-lived JWT (`{ path, exp }`) verified without DB lookup.
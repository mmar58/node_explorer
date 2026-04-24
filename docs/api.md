# API

## Implemented Endpoints

### `GET /api/health`

Returns backend health status.

Response:

```json
{
  "status": "ok"
}
```

### `GET /api/files?path=/...`

Lists a directory on the host filesystem.

Query parameters:

- `path`: requested absolute path. `/` means the virtual device root.

Behavior notes:

- On Windows, `path=/` returns the available drive roots, for example `C:/` and `D:/`
- On Windows, child directory requests use absolute paths such as `C:/Users`
- The response includes `parentPath` so the client can navigate upward safely

Success response:

```json
{
  "currentPath": "/",
  "parentPath": null,
  "entries": [
    {
      "name": "C:",
      "path": "C:/",
      "type": "directory",
      "size": 0,
      "modifiedAt": "1970-01-01T00:00:00.000Z"
    }
  ]
}
```

Error behavior:

- Returns `400` for invalid non-absolute paths
- Returns `400` if the requested path is not a directory
- Returns `403` when the process lacks permission to read the directory
- Returns `404` when the requested path does not exist
- Returns `500` for other unexpected failures

### `GET /api/files/content?path=/...`

Reads a UTF-8 text file from the host filesystem.

Query parameters:

- `path`: requested absolute file path

Behavior notes:

- The endpoint rejects directories with `400`
- The endpoint rejects non-text files that contain null bytes with `415`
- The endpoint limits previews to 1 MB and returns `413` when exceeded

Success response:

```json
{
  "path": "D:/node/node_explorer/README.md",
  "name": "README.md",
  "content": "# Node Explorer\n",
  "encoding": "utf8",
  "size": 14,
  "modifiedAt": "2026-04-25T08:15:00.000Z"
}
```

Error behavior:

- Returns `400` for invalid or non-file paths
- Returns `403` when the process lacks permission to read the file
- Returns `404` when the requested path does not exist
- Returns `413` when the file exceeds the 1 MB text preview limit
- Returns `415` when the file is not treated as UTF-8 text
- Returns `500` for other unexpected failures

### `PUT /api/files/content`

Writes UTF-8 text content back to an existing file.

Request body:

```json
{
  "path": "D:/node/node_explorer/README.md",
  "content": "# Node Explorer\n\nUpdated content"
}
```

Behavior notes:

- The endpoint writes only existing files; it does not create new files yet
- The endpoint limits saved content to 1 MB and returns `413` when exceeded

Success response:

```json
{
  "path": "D:/node/node_explorer/README.md",
  "name": "README.md",
  "size": 33,
  "modifiedAt": "2026-04-25T08:20:00.000Z"
}
```

Error behavior:

- Returns `400` for invalid request bodies or non-file paths
- Returns `403` when the process lacks permission to write the file
- Returns `404` when the requested path does not exist
- Returns `413` when the updated file exceeds the 1 MB text save limit
- Returns `500` for other unexpected failures

### `GET /api/terminal/socket`

Opens a websocket-backed PTY terminal session.

Query parameters:

- `cwd`: optional absolute directory path used as the initial working directory
- `cols`: optional initial terminal width, clamped server-side
- `rows`: optional initial terminal height, clamped server-side

Behavior notes:

- Each websocket connection gets its own PTY session
- On Windows, the server currently starts `cmd.exe /q`
- Shell completion comes from the shell running inside the PTY, not from a separate API

Server-to-client messages:

```json
{ "type": "ready", "cwd": "D:/node/node_explorer", "shell": "cmd.exe" }
{ "type": "output", "data": "PS D:\\node\\node_explorer> " }
{ "type": "exit", "exitCode": 0, "signal": 0 }
{ "type": "error", "error": "Requested terminal path is not a directory" }
```

Client-to-server messages:

```json
{ "type": "input", "data": "dir\r" }
{ "type": "resize", "cols": 120, "rows": 32 }
```

## Planned Endpoints

These are part of the intended product design but are not implemented yet.

### Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`

### File Operations

- `GET /api/files/stat`
- `POST /api/files/rename`
- `POST /api/files/move`
- `POST /api/files/copy`
- `DELETE /api/files`
- `POST /api/files/mkdir`

### Transfer

- `POST /api/upload`
- `PATCH /api/upload/tus/:id`
- `HEAD /api/upload/tus/:id`
- `GET /api/download`
- `POST /api/download/link`
- `GET /api/download/link/:token`

### Remote Fetch

- `POST /api/fetch`
- `GET /api/fetch`
- `GET /api/fetch/:jobId`
- `POST /api/fetch/:jobId/pause`
- `POST /api/fetch/:jobId/resume`
- `DELETE /api/fetch/:jobId`

### Admin

- `GET /api/admin/users`
- `POST /api/admin/users`
- `DELETE /api/admin/users/:id`
- `GET /api/admin/permissions`
- `PUT /api/admin/permissions`
- `GET /api/admin/requests`
- `PUT /api/admin/requests/:id`

### Access Requests

- `POST /api/access/request`
- `GET /api/access/requests`

### Realtime Namespaces Planned

- `/files`
- `/fetch`

Refer to `Instructions.md` for the broader target shape and payload details.
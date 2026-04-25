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
      "modifiedAt": "1970-01-01T00:00:00.000Z",
      "isAccessible": true
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

Behavior detail:

- Child entries that cannot be `stat`ed due to permission errors are still listed with `isAccessible: false` instead of aborting the whole directory response

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

### `GET /api/files/blob?path=/...`

Streams a single file for inline preview.

Behavior notes:

- Supports `Range` requests for media playback and seeking
- Returns an inline `Content-Disposition` header
- Intended for images, video, audio, PDFs, and other browser previews

Error behavior:

- Returns `400` for invalid or non-file paths
- Returns `403` when the process lacks permission to read the file
- Returns `404` when the requested path does not exist
- Returns `416` for invalid byte-range requests

### `GET /api/files/download?path=/...`

Downloads a file directly or downloads a directory as a generated zip archive.

Behavior notes:

- Files are streamed with an attachment disposition
- Directories are zipped on demand in the response stream

### `GET /api/files/archive?path=/...`

Lists the entries inside a zip archive.

Success response:

```json
{
  "path": "D:/node/node_explorer/archive.zip",
  "name": "archive.zip",
  "entries": [
    {
      "path": "folder/readme.txt",
      "type": "file",
      "size": 120,
      "compressedSize": 78
    }
  ]
}
```

### `POST /api/files/upload?path=/...`

Uploads one or more files into the requested destination directory using multipart form data.

Behavior notes:

- Folder uploads are supported by sending relative file names such as `photos/2026/a.jpg`
- The server rejects relative paths that escape the requested destination directory

### `DELETE /api/files?path=/...`

Deletes a file or directory from the host filesystem.

Behavior notes:

- Directories are removed recursively
- Filesystem roots such as `/` or `C:/` are rejected and cannot be deleted

Success response:

```json
{
  "path": "D:/node/node_explorer/tmp/example.txt",
  "deleted": true
}
```

Error behavior:

- Returns `400` for invalid paths or attempts to delete filesystem roots
- Returns `403` when the process lacks permission to remove the item
- Returns `404` when the requested path does not exist
- Returns `500` for other unexpected failures

### `PATCH /api/files/rename`

Renames a file or directory within its current parent directory.

Request body:

```json
{
  "path": "D:/node/node_explorer/tmp/example.txt",
  "name": "renamed.txt"
}
```

Behavior notes:

- The `name` field must be a single basename, not a path
- The endpoint rejects collisions when another item already exists with the requested name

Success response:

```json
{
  "path": "D:/node/node_explorer/tmp/renamed.txt",
  "name": "renamed.txt",
  "type": "file",
  "size": 128,
  "modifiedAt": "2026-04-25T10:20:00.000Z"
}
```

Error behavior:

- Returns `400` for invalid request bodies, invalid names, or attempts to rename filesystem roots
- Returns `403` when the process lacks permission to rename the item
- Returns `404` when the requested path does not exist
- Returns `409` when the destination name already exists
- Returns `500` for other unexpected failures

### `PATCH /api/files/move`

Moves a file or directory into another existing directory.

Request body:

```json
{
  "path": "D:/node/node_explorer/tmp/example.txt",
  "destinationPath": "D:/node/node_explorer/archive"
}
```

Behavior notes:

- `destinationPath` must be an existing absolute directory path
- The moved item keeps its current basename in the destination directory
- The endpoint rejects moves into the same path, into descendants of the source directory, or into an occupied destination path

Success response:

```json
{
  "path": "D:/node/node_explorer/archive/example.txt",
  "name": "example.txt",
  "type": "file",
  "size": 128,
  "modifiedAt": "2026-04-25T10:22:00.000Z"
}
```

Error behavior:

- Returns `400` for invalid request bodies, invalid destination directories, protected root paths, or self/descendant moves
- Returns `403` when the process lacks permission to move the item
- Returns `404` when the source path does not exist
- Returns `409` when the destination path already exists
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

- `PATCH /api/upload/tus/:id`
- `HEAD /api/upload/tus/:id`
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
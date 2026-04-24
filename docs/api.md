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
- `GET /api/files/content`

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

- `/terminal`
- `/files`
- `/fetch`

Refer to `Instructions.md` for the broader target shape and payload details.
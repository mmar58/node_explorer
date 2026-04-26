# Roadmap

## Status Snapshot

Completed:

- Backend scaffold in `server/`
- Health endpoint
- Safe directory listing endpoint
- Text-file read and save endpoints for UTF-8 files up to 1 MB
- Blob preview, upload, download, and zip-inspection endpoints
- Delete, rename, and move file-system endpoints
- PTY-backed terminal websocket endpoint
- User registration, login, JWT auth hooks, and admin permission endpoints
- Client workspace page with browser, editor tabs, media/archive previews, context menus, upload/download actions, and terminal panels
- Root workspace scripts for running and checking both apps
- Root server test script and focused unit tests for auth/permission helpers
- `server/schema.sql` for manual MySQL bootstrap

In progress direction:

- Expanding from the current single-page shell into richer multi-view workflows and transfer orchestration

Not started yet:

- Remote fetch from URL with resume support
- Broader admin tools (user lifecycle, access requests)
- Archive extraction and broader archive operations

## Recommended Build Order

1. Auth routes and token handling
2. Permission service wired into file routes
3. File operations: stat, mkdir, copy
4. Route-based file browsing UI
5. Upload and download flows
6. Remote fetch job system with pause, resume, and progress tracking
7. Terminal and editor workflow polish (tabs, multiplexing, persistence)
8. Admin views for users, permissions, and requests
10. Zip and unzip

## Milestones

### Milestone 1: Safe File Browser

Goal:

- Browse host directories safely with normalized absolute paths

Current state:

- Implemented

### Milestone 2: Authenticated File Management

Goal:

- Add login plus permission-aware file actions

Current state:

- In progress: login/register, JWT auth, path permission checks, delete/rename/move, and admin permission updates are implemented; remaining operations are still planned

### Milestone 3: Transfers

Goal:

- Add upload, download, resumable links, and upload-from-link job handling

Current state:

- In progress: direct upload and download are implemented; resumable transfers and remote fetch are not started

### Milestone 4: Interactive Tools

Goal:

- Add terminal, editor, and media preview

Current state:

- In progress: terminal, editor tabs, media preview, and zip preview are implemented; session persistence and richer multi-terminal workflows are still not started

### Milestone 5: Admin and Policy

Goal:

- Add users, permissions, and access-request management

Current state:

- In progress: user listing and per-path permission assignment are implemented; access-request workflows and broader user lifecycle operations are not started
# Roadmap

## Status Snapshot

Completed:

- Backend scaffold in `server/`
- Health endpoint
- Safe directory listing endpoint
- Text-file read and save endpoints for UTF-8 files up to 1 MB
- Blob preview, upload, download, and zip-inspection endpoints
- PTY-backed terminal websocket endpoint
- Client workspace page with browser, editor tabs, media/archive previews, context menus, upload/download actions, and terminal panels
- Root workspace scripts for running and checking both apps

In progress direction:

- Converting the browser from a single page into the full file-management shell

Not started yet:

- Auth and permissions
- File mutations
- Remote fetch from URL with resume support
- Admin tools
- Archive extraction and broader archive operations

## Recommended Build Order

1. Auth routes and token handling
2. Permission service wired into file routes
3. File operations: stat, mkdir, rename, move, copy, delete
4. Route-based file browsing UI
5. Upload and download flows
6. Remote fetch job system with pause, resume, and progress tracking
7. Terminal integration
8. Editor and media viewer
9. Admin views for users and permissions
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

- Not started

### Milestone 3: Transfers

Goal:

- Add upload, download, resumable links, and upload-from-link job handling

Current state:

- In progress: direct upload and download are implemented; resumable transfers and remote fetch are not started

### Milestone 4: Interactive Tools

Goal:

- Add terminal, editor, and media preview

Current state:

- In progress: terminal, editor tabs, media preview, and zip preview are implemented; broader file actions are still not started

### Milestone 5: Admin and Policy

Goal:

- Add users, permissions, and access-request management

Current state:

- Not started
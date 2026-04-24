# Roadmap

## Status Snapshot

Completed:

- Backend scaffold in `server/`
- Health endpoint
- Safe directory listing endpoint
- Minimal client browser page using the API
- Root workspace scripts for running and checking both apps

In progress direction:

- Converting the browser from a single page into the full file-management shell

Not started yet:

- Auth and permissions
- File mutations
- Upload and download workflows
- Remote fetch from URL with resume support
- Terminal
- Code editor and media preview
- Admin tools
- Archive operations

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

- Not started

### Milestone 4: Interactive Tools

Goal:

- Add terminal, editor, and media preview

Current state:

- Not started

### Milestone 5: Admin and Policy

Goal:

- Add users, permissions, and access-request management

Current state:

- Not started
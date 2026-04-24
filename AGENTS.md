# AGENTS.md

This file defines repo-specific expectations for coding agents working in this workspace.

## Project Intent

Build Node Explorer as a self-hosted server file manager with:

- File browsing and metadata
- File and folder operations
- Upload, download, and upload-from-link with resume support
- Terminal access with realtime output
- Code editing and media preview
- User-based folder permissions and access requests

The source of truth for feature scope is `Instructions.md`.

## Current Implementation State

The repository is early-stage.

- `client/` contains the SvelteKit frontend
- `server/` contains the Fastify backend scaffold
- The implemented backend surface is currently limited to `GET /api/health` and `GET /api/files`
- `GET /api/files` currently browses the host filesystem and lists drives at `/` on Windows
- The client home page is a minimal file browser wired to `GET /api/files`

Do not document planned features as implemented features.

## Working Rules

- Prefer small end-to-end slices over broad scaffolding without validation
- Fix root causes rather than layering on temporary workarounds
- Keep changes minimal and aligned with the current repo style
- Use pnpm only
- Treat `Instructions.md` as the product plan, not as evidence that all pieces already exist

## Priority Order

When adding features, prefer this order unless the user asks otherwise:

1. Backend behavior and validation
2. Client integration for the same slice
3. Documentation updates
4. Broader architecture or follow-on phases

## Commands

- Root client dev: `pnpm dev:client`
- Root server dev: `pnpm dev:server`
- Root client check: `pnpm check:client`
- Root server check: `pnpm check:server`

## Documentation Expectations

- Update `README.md` when setup or capabilities change materially
- Update `docs/api.md` when routes are added, removed, or reshaped
- Update `docs/architecture.md` when structure or infrastructure decisions change
- Update `docs/roadmap.md` when implementation status changes in a meaningful way

## Safety Constraints

- Validate and normalize filesystem paths on the server
- Validate requested filesystem paths before touching the host filesystem
- Avoid claiming auth or permission enforcement exists until it is implemented
- Avoid destructive git operations unless explicitly requested
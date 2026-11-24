# Contributing to Quillvibe

Thank you for helping improve Quillvibe. Quillvibe is maintained in the open under `jhonrey-com/Quillvibe` so authors keep a dependable, offline-first studio without broken releases or surprise changes.

## Repository Branching & Protection Model

The `main` branch reflects the tested source baseline. To keep the primary codebase clean and prevent accidental breakage:

1. **Fork the repository** into your own GitHub account (`https://github.com/jhonrey-com/Quillvibe`).
2. **Create a focused feature or fix branch** from `main`:
   ```bash
   git checkout -b fix/story-graph-edge-snapping
   ```
3. **Keep changes modular and local to the issue.** Avoid bundling unrelated style rewrites, unsolicited dependencies, or config alterations into the same pull request.
4. **Preserve author privacy and build provenance.** Do not insert personal real names, credentials, API keys, or remote telemetry calls anywhere in source, documentation, or manifests.

## Required Checks Before Opening a Pull Request

Run every workspace verification step locally after your final edit:

```bash
npm run typecheck
npm test
npm run build
```

When changing desktop Rust commands (`src-tauri/src/`), also run:

```bash
cd src-tauri && cargo test
```

## Coding Conventions

- Keep all user-facing strings, documentation, tooltips, and comments direct and factual.
- Avoid DOM string injection APIs (`innerHTML`, `outerHTML`) and dynamic code evaluation (`eval`, `new Function`). Build DOM nodes with `el()` / `svgEl()` from `src/ui/dom.ts`.
- Keep every tool icon unique per switcher or toolbar button, and add matching documentation to `src/ui/icon-directory.ts`.
- Respect `prefers-reduced-motion: reduce` and responsive layouts down to `768×700`.

## Submitting Your Pull Request

- Summarize what changed and why in 2–4 plain sentences.
- List the commands you ran (`typecheck`, `test`, `build`) and confirm visual checks in Chrome DevTools / Tauri.
- Wait for maintainer review before merging.

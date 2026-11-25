# Contributing to Quillvibe

Thank you for helping improve Quillvibe. Quillvibe is developed in the open under <a href="https://github.com/jhonrey-com/Quillvibe" target="_blank" rel="noopener noreferrer"><code>jhonrey-com/Quillvibe</code></a> so writers keep a dependable, offline-first book writing studio.

## Repository Workflow

The `main` branch reflects the tested baseline. To keep releases clean:

1. **Fork the repository** into your own GitHub account (<a href="https://github.com/jhonrey-com/Quillvibe" target="_blank" rel="noopener noreferrer">https://github.com/jhonrey-com/Quillvibe</a>).
2. **Create a focused feature or fix branch** from `main`:
   ```bash
   git checkout -b fix/story-graph-edge-snapping
   ```
3. **Keep changes focused and modular.** Avoid mixing unrelated style rewrites, unnecessary dependencies, or config edits into the same pull request.
4. **Preserve author privacy and neutral naming.** Never add personal private details, credentials, API keys, remote telemetry, or third-party product/company names anywhere in source, UI copy, or documentation.

## Required Checks Before Opening a Pull Request

Run every verification step locally after your final edit:

```bash
npm run typecheck
npm test
npm run build
```

When changing desktop Rust code (`src-tauri/src/`), also run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

## Coding Conventions

- Keep all user-facing strings, error messages, tooltips, and documentation plain, direct, and easy for writers to understand.
- Avoid DOM string injection (`innerHTML`, `outerHTML`) and dynamic evaluation (`eval`, `new Function`). Build DOM elements with `el()` and `svgEl()` from `src/ui/dom.ts`.
- Keep every tool icon distinct per toolbar or switcher, and document additions in `src/ui/icon-directory.ts` and `src/views/help-page.ts`.
- Respect `prefers-reduced-motion: reduce`, the **Smooth Animations** preference, and responsive layouts from mobile (`360px`) through wide desktop screens.

## Submitting Your Pull Request

- Summarize what changed and why in 2–4 plain sentences.
- List the checks you ran (`typecheck`, `test`, `build`, and `cargo test` if applicable).
- For questions or security issues, email <a href="mailto:quillvibe@jhonrey.com" target="_blank" rel="noopener noreferrer">quillvibe@jhonrey.com</a>.

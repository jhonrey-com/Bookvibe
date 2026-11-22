# Contributing to Bookvibe

Thank you for contributing to Bookvibe.

## Engineering Principles

1. **Pure Human Writing Focus**: Bookvibe is strictly a human writing, structural editing, worldbuilding, and typesetting studio. Do not submit LLM/AI integrations or external tracking telemetry.
2. **Zero XSS Sinks**: All DOM construction uses native `document.createElement` / `createElementNS` helpers in `src/ui/dom.ts`. Never introduce `innerHTML`, `outerHTML`, `document.write`, `eval`, or `new Function`.
3. **Deterministic File Formats**: Changes to any `.bookvibe`, `.bvibe`, `.bvbook`, `.bvbible`, `.bvscene`, or `.bvstyle` payload must preserve the `"magic": "BOOKVIBE_V1"` header and validate against `schemas/bookvibe-extensions.schema.json`.
4. **Verification Gate**: Before submitting a pull request, ensure the full suite passes:
   ```bash
   npm run typecheck
   npm test
   npm run build
   cd src-tauri && cargo test
   ```

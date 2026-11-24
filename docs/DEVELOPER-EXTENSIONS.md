# Quillvibe Developer Guide: Building Extension Add-ons (`.qvext`)

Quillvibe accepts external add-ons distributed as `.qvext` (or legacy `.bvext`) files. Every extension is a declarative JSON manifest verified before installation, isolated from network access and arbitrary OS execution, and gated behind explicit author permission prompts.

---

## Security & Sandbox Boundaries

Before an external `.qvext` loads, Quillvibe validates the JSON structure and displays every requested permission to the user. External add-ons cannot:

- Execute arbitrary JavaScript (`eval`, `new Function`, or remote `<script>` loading)
- Make outbound HTTP/HTTPS requests or phone home
- Read arbitrary filesystem directories outside opened book documents
- Modify system shell settings or permanent pen-name Author Keys

---

## Manifest Schema Reference

Save any valid extension with a `.qvext` suffix (UTF-8 JSON):

```json
{
  "magic": "QUILLVIBE_EXT_V2",
  "id": "press.house-style-kit",
  "name": "House Editorial Kit",
  "version": "1.0.0",
  "author": "Your Name or Press",
  "description": "Applies house punctuation checks and provides classic publishing typography.",
  "kind": "external",
  "dataUsageSummary": "Reads prose text inside the currently active scene when triggered; installs declared font stacks into local Quillvibe settings.",
  "permissions": [
    "read:active-scene",
    "propose:proofread-marks",
    "apply:text-transform",
    "add:font-pack"
  ],
  "rules": [
    {
      "id": "double-hyphens",
      "label": "Double Hyphens to Em-Dash",
      "pattern": "--",
      "flags": "g",
      "markKind": "substitute",
      "replacement": "—",
      "note": "House style prefers closed em-dashes instead of double hyphens."
    }
  ],
  "transforms": [
    {
      "id": "trim-trailing-spaces",
      "label": "Strip Trailing Line Spaces",
      "description": "Removes invisible trailing whitespace from each line in the active scene.",
      "kind": "trim-trailing-spaces"
    }
  ],
  "fonts": [
    {
      "id": "font-crimson-editorial",
      "family": "Crimson Editorial Serif",
      "cssStack": "\"Crimson Pro\", Baskerville, Georgia, serif",
      "category": "serif"
    }
  ]
}
```

---

## Supported Permission Scopes

| Permission | Scope Granted | Data Accessed |
| :--- | :--- | :--- |
| `read:active-scene` | Read text of open scene | Title & prose of currently selected scene |
| `read:manuscript` | Read chapters & word counts | Scene headings, hierarchy, and draft text across active book |
| `read:bible` | Read Story Bible entries | Characters, locations, and lore entries in active book |
| `propose:proofread-marks` | Insert review suggestions | Appends non-destructive `ProofreadMark` annotations |
| `apply:text-transform` | Modify scene text | Replaces prose after saving a Revision Snapshot |
| `add:export-preset` | Update interior page design | Trim size, margin inches, drop caps, chapter numerals |
| `add:font-pack` | Register extension typefaces | Adds declared font families / embedded WOFF2 data URLs into Settings & Typeset |

---

## Local Testing & Verification

1. Open Quillvibe -> click the **Extensions** button in the top bar (ensure Tool Level is **Advanced** in Settings).
2. Switch to **External Sandbox** and click **Install .qvext File…**, or drag your `.qvext` file directly onto the Quillvibe window.
3. Review the calculated **SHA-256 checksum** and permission toggles in the consent panel.
4. Trigger your rule, transform, preset, or font pack installer and verify events in the **Extension Data Access Audit Log**.

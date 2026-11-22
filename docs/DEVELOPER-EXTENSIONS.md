# Bookvibe Developer Guide: Building Extension Add-ons (`.bvext`)

Bookvibe accepts external add-ons distributed as `.bvext` files. Every `.bvext` extension is a declarative JSON manifest verified before installation, isolated from network access and arbitrary OS execution, and gated behind explicit author permission prompts.

---

## Security & Sandbox Boundaries

Before an external `.bvext` loads, Bookvibe validates the JSON structure and displays every requested permission to the user. External add-ons cannot:

- Execute arbitrary JavaScript (`eval`, `new Function`, or remote `<script>` loading)
- Make outbound HTTP/HTTPS requests or phone home
- Read arbitrary filesystem directories outside opened book documents
- Modify system shell settings or author cryptographic private keys

---

## Manifest Schema Reference

Save any valid extension with a `.bvext` suffix (UTF-8 JSON):

```json
{
  "magic": "BOOKVIBE_EXT_V1",
  "id": "press.house-style-kit",
  "name": "House Editorial Kit",
  "version": "1.0.0",
  "author": "Your Name or Press",
  "description": "Applies house punctuation checks and provides classic publishing typography.",
  "kind": "external",
  "dataUsageSummary": "Reads prose text inside the currently active scene when triggered; installs declared font stacks into local Bookvibe settings.",
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

Declare only the permissions your add-on requires:

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

## Supported Built-in Capabilities in v1

### 1. Regex Editorial Rules (`rules`)
Each entry compiles a safe JavaScript regular expression capped against exponential backtracking. Matches appear inside **Manuscript -> Proofread Mode** rather than overwriting prose automatically.

Supported `markKind` values: `comment`, `highlight`, `substitute`, `delete`, `insert`, `stet`.

### 2. Snapshot-Backed Transforms (`transforms`)
Allowed deterministic operations (`kind` field):
- `smart-typography`
- `collapse-double-spaces`
- `trim-trailing-spaces`
- `strip-straight-quotes`

Bookvibe saves a snapshot automatically before applying any transform.

### 3. Typeset & Paper Presets (`presets`)
Each preset object may specify `trimSize` (`5x8`, `5.5x8.5`, `6x9`, `a5`), `fontFamily` (`garamond`, `baskerville`, `palatino`, `inter`), `fontSizePt`, `lineHeight`, `marginInches`, `dropCaps`, `smartTypography`, `runningHeader`, and `paperTheme`.

### 4. Custom Font Packs (`fonts`)
Provide `{ "id": "...", "family": "...", "cssStack": "...", "category": "serif", "dataUrl": "data:font/woff2;base64,..." }`.
Data URLs are checked for `data:font/(ttf|otf|woff|woff2)` or safe font MIME prefixes before registering in `document.fonts`.

---

## Local Testing & Verification

1. Open Bookvibe -> click the **Extensions** button in the top bar (or open **Settings -> Typefaces** for font packs).
2. Switch to **External Sandbox** (`shield` icon) and click **Install .bvext File…**, or drag your `.bvext` file directly onto the Bookvibe window.
3. Review the calculated **SHA-256 checksum** and permission toggles in the consent panel.
4. Trigger your rule, transform, preset, or font pack installer and verify events in the **Extension Data Access Audit Log**.

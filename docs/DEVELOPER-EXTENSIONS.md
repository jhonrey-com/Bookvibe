# Quillvibe Developer Guide: Building Extension Add-ons (`.qvext`)

Quillvibe accepts external add-ons distributed as **`.qvext`** packages. Every `.qvext` package is a validated UTF-8 JSON manifest gated by explicit author permission checkboxes, inspected with a short SHA-256 fingerprint before installation, and logged to a local Data Access Audit Log on every execution.

> **Developer Portal & Live Validator:** Open <a href="https://quillvibe.jhonrey.com/developer" target="_blank" rel="noopener noreferrer"><strong>https://quillvibe.jhonrey.com/developer</strong></a> (also built into the desktop app via **Extensions -> External Sandbox -> Developer Portal** and **Help Menu -> Open Developer Portal**).  
> **Companion Extension Builder App (Coming Soon):** A dedicated standalone desktop application for authoring, debugging regex rules, packaging WOFF2/TTF font bundles, and testing `.qvext` extensions against sample manuscripts is planned as a separate release.  
> **Developer Relations & Reviews:** Email <a href="mailto:quillvibe@jhonrey.com" target="_blank" rel="noopener noreferrer"><strong>quillvibe@jhonrey.com</strong></a>.

---

## 1. Security & Sandbox Boundaries

Before an external `.qvext` file can be enabled, Quillvibe parses and validates the manifest and presents every requested scope to the author. External add-ons are strictly prevented from:

- Executing arbitrary JavaScript (`<script>`, `javascript:`, inline event handlers, `eval`, or `new Function`)
- Making outbound HTTP/HTTPS network requests or opening sockets
- Reading arbitrary OS directories, modifying shell registry entries, or running child processes
- Reading private cryptographic Author Keys (`privateKeyJwk`) or accessing other closed books in the author's Library
- Claiming reserved built-in IDs starting with `core.`

---

## 2. Top-Level Manifest Schema (`QUILLVIBE_EXT_V2`)

Every `.qvext` file must parse as a single JSON object containing these fields:

| Field | Status | Constraints & Validation Rules |
| :--- | :--- | :--- |
| `magic` | **Required** | Must equal `"QUILLVIBE_EXT_V2"` (legacy `"BOOKVIBE_EXT_V1"` is accepted for backward compatibility). |
| `id` | **Required** | `3–64` characters, matching `/^[a-z0-9][a-z0-9._-]{2,63}$/`. Cannot start with `"core."`. |
| `name` | **Required** | Non-empty string, max `80` chars. Display name shown in Consent & Sandbox tabs. |
| `version` | **Required** | Non-empty string, max `24` chars. Follow semantic versioning (`X.Y.Z`). |
| `author` | **Required** | Non-empty string, max `80` chars. Publisher, pen name, or developer handle. |
| `description` | **Required** | Non-empty string, max `280` chars. Concise, plain summary of functionality. |
| `dataUsageSummary` | **Required** | Non-empty string, max `360` chars. Plain disclosure of what data is read or modified when run. |
| `permissions` | **Required** | Non-empty array containing valid permission scope names from Section 4. |
| `kind` | Optional | Set to `"external"` for distributed packages. |
| `rules` | Optional | Array of up to `30` proofreading pattern rules (requires `read:active-scene` and `propose:proofread-marks`). |
| `transforms` | Optional | Array of up to `10` deterministic text cleanup transforms (requires `read:active-scene` and `apply:text-transform`). |
| `presets` | Optional | Array of up to `10` print typeset presets (requires `add:export-preset`). |
| `fonts` | Optional | Array of up to `16` font definitions (requires `add:font-pack`). |
| `metricsReport` | Optional | Set to `"readability"` to expose local readability analysis (requires `read:active-scene`). |

---

## 3. Feature Modules in Depth

### A. Proofreading Rules (`rules`)
Each entry inside `rules` (max `30`) scans the active scene text and adds non-destructive editorial marks shown in **Proofread** mode:

- **`id`** *(max 48 chars)*: Unique rule identifier.
- **`label`** *(max 80 chars)*: Short UI description shown in results.
- **`pattern`** *(max 120 chars)*: Regular expression validated against ReDoS hazards. Lookbehinds (`(?<=...)` / `(?<!...)`), backreferences (`\1`), and nested quantifiers (`(a+)+`, `(.*){2,}`) are automatically rejected.
- **`flags`** *(optional)*: Allowed flags are `g`, `i`, `m`, `s`, `u` (`g` is always included).
- **`markKind`**: Must be one of the 15 classic proofreading mark types:
  - `delete`, `insert`, `substitute`, `comment`, `highlight`, `transpose`, `stet`, `paragraph`, `run-in`, `closeup`, `space`, `capitalize`, `lowercase`, `italic`, `bold`
- **`replacement`** *(optional, max 120 chars)*: Suggested replacement string used by `substitute`, `insert`, `capitalize`, or `lowercase` marks.
- **`note`** *(max 200 chars)*: Copyeditor explanation displayed inside the markup card.

### B. Deterministic Text Transforms (`transforms`)
Each entry inside `transforms` (max `10`) automatically saves an immutable **Revision Snapshot** before altering active scene text. The `kind` field must match one of the four built-in sandboxed transform operations:

- `"smart-typography"` — Converts straight quotes, double hyphens (`--`), and triple periods (`...`) into typographic quotes, em-dashes, and ellipses.
- `"collapse-double-spaces"` — Replaces runs of two or more horizontal spaces with single spaces.
- `"trim-trailing-spaces"` — Removes trailing whitespace from the end of each line.
- `"strip-straight-quotes"` — Normalizes curly quotes cleanly when needed.

### C. Print Typeset Presets (`presets`)
Each entry inside `presets` (max `10`) lets authors configure interior formatting in one click:

- **`paperTheme`** *(optional)*: `"ivory"`, `"parchment"`, or `"obsidian"`.
- **`typography`** *(optional)*: Any partial typography settings such as `trimSize` (`"5x8"`, `"5.5x8.5"`, `"6x9"`, `"a5"`, `"royal"`, `"letter"`), `fontFamily`, `fontSizePt`, `lineHeight`, `dropCaps`, `smartQuotes`, `marginTopIn`, `marginOuterIn`.

### D. Custom Font Packs (`fonts`)
Each entry inside `fonts` (max `16`) installs offline typefaces directly into **Settings -> Typefaces & Fonts** and **Book Cover Studio**:

- **`id`** *(max 48 chars)*, **`family`** *(max 64 chars)*, **`cssStack`** *(max 160 chars)*
- **`category`**: `"serif"`, `"sans"`, or `"mono"`
- **`dataUrl`** *(optional)*: Base64 font payload strictly matching `^data:font\/(ttf|otf|woff|woff2);base64,[A-Za-z0-9+/=]+$`.

---

## 4. Complete Example Manifest

Save with a `.qvext` extension (UTF-8 JSON):

```json
{
  "magic": "QUILLVIBE_EXT_V2",
  "id": "press.house-style-kit",
  "name": "House Editorial Kit",
  "version": "1.0.0",
  "author": "jhonrey.com Community Author",
  "description": "Applies house punctuation checks, provides trim presets, and installs classic book serif fonts.",
  "kind": "external",
  "dataUsageSummary": "Reads prose inside the active scene when triggered and adds optional font families to local Quillvibe preferences.",
  "permissions": [
    "read:active-scene",
    "propose:proofread-marks",
    "apply:text-transform",
    "add:export-preset",
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
  "presets": [
    {
      "id": "house-trade-6x9",
      "label": "House Trade 6\" x 9\" (11pt)",
      "paperTheme": "ivory",
      "typography": {
        "trimSize": "6x9",
        "fontFamily": "garamond",
        "fontSizePt": 11,
        "lineHeight": 1.55,
        "dropCaps": true
      }
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

## 5. Supported Permission Scopes

| Permission | Scope Granted | Data Accessed |
| :--- | :--- | :--- |
| `read:active-scene` | Read text of open scene | Title & prose of currently selected scene |
| `read:manuscript` | Read chapters & word counts | Scene headings, hierarchy, and draft text across active book |
| `read:bible` | Read Story Bible entries | Characters, locations, and lore entries in active book |
| `propose:proofread-marks` | Insert review suggestions | Appends non-destructive `ProofreadMark` annotations |
| `apply:text-transform` | Modify scene text | Replaces prose only after saving a Revision Snapshot |
| `add:export-preset` | Update interior page design | Trim size, margin inches, drop caps, chapter numerals |
| `add:font-pack` | Register extension typefaces | Adds declared font families or embedded fonts into local Settings & Cover Studio |

---

## 6. Local Validation, Sandbox Testing & Distribution

1. Open <a href="https://quillvibe.jhonrey.com/developer" target="_blank" rel="noopener noreferrer"><strong>https://quillvibe.jhonrey.com/developer</strong></a> (or **Extensions -> External Sandbox -> Developer Portal (`/developer`)** inside the desktop app).
2. Paste your JSON manifest into the **Interactive `.qvext` Manifest Validator** and click **Validate & Compute SHA-256** (or click **Test in Extensions Sandbox** to preview the permission consent screen immediately).
3. Click **Download `.qvext` File** to export your package with its normalized ID filename.
4. Trigger your rules, transforms, presets, and font packs against test chapters, then inspect every recorded entry in the **Extension Data Access Audit Log**.
5. Publish your `.qvext` alongside its **SHA-256 fingerprint prefix** and exact `dataUsageSummary` so authors can verify file integrity during consent review.

---

## 7. Upcoming Companion App & Developer Relations

- **Quillvibe Extension Builder App (Coming Soon):** A dedicated standalone desktop application is in planning for developers building and packaging `.qvext` extensions—including live rule match highlighting, automated ReDoS safety lint, font-to-Base64 bundling, and one-click desktop handoff into Quillvibe.
- **Developer Contact & Submissions:** Questions about schema extensions, pull requests in [CONTRIBUTING.md](../CONTRIBUTING.md), or security reports regarding extensions can be sent directly to <a href="mailto:quillvibe@jhonrey.com" target="_blank" rel="noopener noreferrer"><strong>quillvibe@jhonrey.com</strong></a>.

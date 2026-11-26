#!/usr/bin/env python3
"""Generate plain-spoken release notes for any Quillvibe git tag."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from typing import List, Optional, Tuple


OUTDATED_WARNING = """\
> [!WARNING]
> **Outdated Release — Not Recommended for Download**
> This is an older build of Quillvibe and may contain bugs that have already been fixed. Please download the newest version from the [**Latest Release**](https://github.com/jhonrey-com/Quillvibe/releases/latest) or use the web app at **https://quillvibe.jhonrey.com/**.

---
"""

HIGHLIGHT_OVERRIDES: dict[str, List[str]] = {
    "v3.1.2": [
        "Fixed Book Cover Studio artboard collapse in the workspace layout so center canvases and Full Wrap previews display at full size.",
        "Fixed Story Graph node placement (`Sync Now` and `Auto Layout`) so storyboard cards stay separated without overlap.",
        "Fixed Outline word count grammar on empty and single-word manuscripts, clipped top-bar book titles, duplicate author signatures in Interior Typeset, `/settings` horizontal overflow on mobile viewports, and stuck hover tooltips across navigation switches.",
        "Rendered GitHub release notes in **Quillvibe Software Updates** as formatted headings and lists instead of raw Markdown.",
        "Enforced locked-chapter/scene guards across manuscript edits, scene moves, proofread mark accepts, snapshots, collaborator annotations, and graph sync.",
        "Hardened SVG/image sanitization, base64 SVG payload scanning, plugin CSS font and regex validation, XML entity decoding, ECDSA-only collaborator token checks, and desktop LAN/single-instance networking.",
    ],
    "v3.1.1": [
        "Collapsed left Binder, right Inspector, and resizers cleanly across all full-page views (`/settings`, `/manual`, `/course`, `/help`, `/developer`, and **New Tab**).",
        "Removed the 50 MB size restriction and restrictive upload limits across book files (`.qv*`), LAN/sync transfers, cover artwork, scene images, and custom fonts.",
        "Fixed binary encoding and decoding when importing or exporting `.qv`, `.qvbible`, `.qvscene`, `.qvstyle`, and `.qvdesign` files in both the web app and desktop app.",
        "Fixed book deletion in the **Book Library** so removed books disappear immediately and stay deleted across reloads and open tabs.",
        "Updated **Book Library** sorting so the most recently edited or created book stays at the top of the list.",
        "Restored the original in-app header and tab-bar emblem proportions while keeping the enlarged browser favicon and desktop taskbar/dock icon scaling.",
        "Moved the `Saved` / `Saving…` indicator into the bottom-left status bar beside the word count ledger to remove awkward horizontal spacing.",
    ],
}


def parse_semver(tag: str) -> Tuple[int, int, int]:
    match = re.match(r"^v?(\d+)\.(\d+)\.(\d+)", tag.strip())
    if not match:
        return (0, 0, 0)
    return int(match.group(1)), int(match.group(2)), int(match.group(3))


def list_sorted_tags() -> List[str]:
    out = subprocess.check_output(
        ["git", "tag", "-l", "v*"],
        text=True,
    )
    tags = [line.strip() for line in out.splitlines() if line.strip()]
    tags.sort(key=parse_semver)
    return tags


def find_previous_tag(tag: str, sorted_tags: List[str]) -> Optional[str]:
    if tag in sorted_tags:
        idx = sorted_tags.index(tag)
        return sorted_tags[idx - 1] if idx > 0 else None
    target_ver = parse_semver(tag)
    candidates = [t for t in sorted_tags if parse_semver(t) < target_ver]
    return candidates[-1] if candidates else None


def get_commit_subjects(tag: str, prev_tag: Optional[str]) -> List[str]:
    rev_range = f"{prev_tag}..{tag}" if prev_tag else tag
    out = subprocess.check_output(
        ["git", "log", rev_range, "--no-merges", "--pretty=format:%s"],
        text=True,
    )
    subjects = [line.strip() for line in out.splitlines() if line.strip()]
    # Fallback to the tag commit itself if no commits sit strictly between tags
    if not subjects:
        single = subprocess.check_output(
            ["git", "log", "-1", "--pretty=format:%s", tag],
            text=True,
        ).strip()
        if single:
            subjects = [single]
    return subjects


def format_subject_as_bullets(subjects: List[str]) -> List[str]:
    bullets: List[str] = []
    seen = set()
    for subj in subjects:
        # Clean common prefixes into clear release lines
        cleaned = re.sub(r"^(feat|fix|ci|docs|release|chore)\s*:\s*", "", subj, flags=re.I).strip()
        if not cleaned or cleaned.lower() in seen:
            continue
        seen.add(cleaned.lower())
        if len(cleaned) > 1:
            cleaned = cleaned[0].upper() + cleaned[1:]
        bullets.append(cleaned)
    return bullets


def build_notes(tag: str, outdated: bool = False) -> str:
    sorted_tags = list_sorted_tags()
    prev_tag = find_previous_tag(tag, sorted_tags)
    version = tag.lstrip("v")

    if tag in HIGHLIGHT_OVERRIDES:
        bullets = HIGHLIGHT_OVERRIDES[tag]
    else:
        bullets = format_subject_as_bullets(get_commit_subjects(tag, prev_tag))

    parts: List[str] = []
    if outdated:
        parts.append(OUTDATED_WARNING)

    app_name = "Bookvibe" if parse_semver(tag) < (2, 0, 0) else "Quillvibe"
    parts.append(f"### {app_name} `{tag}`\n")
    parts.append("## What's Changed\n")
    for bullet in bullets:
        parts.append(f"- {bullet}")
    parts.append("")

    parts.append(
        "## Downloads & Platforms\n"
        f"- **Windows (x64):** `Quillvibe_{version}_x64-setup.exe` or `Quillvibe_{version}_x64_en-US.msi` "
        "(plus `jhonrey.com-Quillvibe.cer` public signing certificate where provided)\n"
        f"- **macOS (Apple Silicon & Intel Universal):** `Quillvibe_{version}_universal.dmg`\n"
        f"- **Linux:** `Quillvibe_{version}_amd64.AppImage`, `Quillvibe_{version}_amd64.deb`, or `Quillvibe-{version}-1.x86_64.rpm`\n"
        "- **Web Version (No Install Required):** [https://quillvibe.jhonrey.com/](https://quillvibe.jhonrey.com/) — runs offline in the browser without installing desktop packages\n"
    )

    if parse_semver(tag) >= (3, 1, 0):
        fmt_line = (
            "## Supported Quillvibe File Formats\n"
            "- `.qv` — Protected whole-book workspace archive (manuscript, snapshots, story bible, story graph, cover, copyright seal, and typography)\n"
            "- `.qvbible` — Shareable Story Bible database\n"
            "- `.qvscene` — Standalone scene draft and annotations\n"
            "- `.qvstyle` — Interior typeset and paper layout preset\n"
            "- `.qvdesign` — Pro Book Cover Studio vector layout and review comments package\n"
        )
    elif parse_semver(tag) >= (2, 2, 0):
        fmt_line = (
            "## Supported Quillvibe File Formats\n"
            "- `.qv` (whole book workspace), `.qvbible` (Story Bible), `.qvscene` (standalone scene), and `.qvstyle` (typeset preset)\n"
        )
    else:
        fmt_line = ""

    if fmt_line:
        parts.append(fmt_line)

    parts.append(
        "## Install Note & Support\n"
        "- Windows, Mac, or Linux may show an unrecognized-publisher warning when opening the installer because Quillvibe is a new open-source project still receiving active fixes and does not carry a paid commercial app-store certificate.\n"
        "- If you prefer to avoid desktop security prompts, use the browser app at **https://quillvibe.jhonrey.com/**.\n"
        "- Questions, bug reports, error codes, or security concerns: email **quillvibe@jhonrey.com**.\n"
    )

    if prev_tag:
        parts.append(
            f"**Full Changelog:** https://github.com/jhonrey-com/Quillvibe/compare/{prev_tag}...{tag}\n"
        )

    return "\n".join(parts).strip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Build structured release notes for a Quillvibe tag.")
    parser.add_argument("--tag", required=True, help="Git tag (e.g. v3.1.1)")
    parser.add_argument("--outdated", action="store_true", help="Include outdated/pre-release warning banner")
    parser.add_argument("--output", help="Optional output file path (defaults to stdout)")
    args = parser.parse_args()

    notes = build_notes(args.tag, outdated=args.outdated)
    if args.output:
        with open(args.output, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(notes)
    else:
        sys.stdout.write(notes)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

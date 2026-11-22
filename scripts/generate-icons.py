#!/usr/bin/env python3
"""Generate clean geometric obsidian-and-ivory native app icons for Tauri v2."""
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS_DIR = os.path.join(ROOT, "src-tauri", "icons")
os.makedirs(ICONS_DIR, exist_ok=True)


def render_icon_rgba(size: int) -> bytes:
    """Render an architectural obsidian rounded-square icon with ivory book-page geometry."""
    buf = bytearray(size * size * 4)
    cx = (size - 1) / 2.0
    cy = (size - 1) / 2.0
    radius = size * 0.22
    half = size * 0.46

    for y in range(size):
        for x in range(size):
            # Rounded-box signed distance for clean anti-aliased corner silhouette
            dx = abs(x - cx) - (half - radius)
            dy = abs(y - cy) - (half - radius)
            dist = (max(dx, 0.0) ** 2 + max(dy, 0.0) ** 2) ** 0.5 + min(max(dx, dy), 0.0) - radius

            alpha = max(0.0, min(1.0, 0.5 - dist))
            if alpha <= 0.0:
                continue

            nx = (x - cx) / size
            ny = (y - cy) / size

            # Obsidian surface gradient
            r = 11.0 + max(0.0, 1.0 - (nx * nx + ny * ny) * 2.2) * 14.0
            g = 12.0 + max(0.0, 1.0 - (nx * nx + ny * ny) * 2.2) * 15.0
            b = 17.0 + max(0.0, 1.0 - (nx * nx + ny * ny) * 2.2) * 20.0

            # Hairline inner frame
            if -1.5 <= dist <= -0.2:
                r, g, b = 56.0, 62.0, 78.0

            # Stylized architectural open-book spread + center spine in crisp ivory
            in_left_page = (-0.27 <= nx <= -0.025) and (-0.22 + abs(nx) * 0.14 <= ny <= 0.24 + abs(nx) * 0.14)
            in_right_page = (0.025 <= nx <= 0.27) and (-0.22 + abs(nx) * 0.14 <= ny <= 0.24 + abs(nx) * 0.14)
            in_spine = (-0.012 <= nx <= 0.012) and (-0.21 <= ny <= 0.25)

            if in_left_page or in_right_page:
                # Subtle page ruled ink lines
                if abs((ny + 0.12) % 0.09) < 0.014 and abs(nx) > 0.06 and abs(nx) < 0.23:
                    r, g, b = 36.0, 40.0, 50.0
                else:
                    r, g, b = 238.0, 236.0, 229.0
            elif in_spine:
                r, g, b = 152.0, 162.0, 180.0

            idx = (y * size + x) * 4
            buf[idx] = int(max(0, min(255, r)))
            buf[idx + 1] = int(max(0, min(255, g)))
            buf[idx + 2] = int(max(0, min(255, b)))
            buf[idx + 3] = int(max(0, min(255, alpha * 255.0)))

    return bytes(buf)


def encode_png(size: int, rgba: bytes) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    raw = bytearray()
    stride = size * 4
    for row in range(size):
        raw.append(0)
        raw.extend(rgba[row * stride : (row + 1) * stride])

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def encode_ico(png_32: bytes, png_256: bytes) -> bytes:
    # Modern PNG-embedded ICO container (valid on Windows Vista+ and Tauri rc/winres)
    header = struct.pack("<HHH", 0, 1, 2)
    offset1 = 6 + 32
    offset2 = offset1 + len(png_32)
    entry1 = struct.pack("<BBBBHHII", 32, 32, 0, 0, 1, 32, len(png_32), offset1)
    entry2 = struct.pack("<BBBBHHII", 0, 0, 0, 0, 1, 32, len(png_256), offset2)
    return header + entry1 + entry2 + png_32 + png_256


def main() -> None:
    png_32 = encode_png(32, render_icon_rgba(32))
    png_128 = encode_png(128, render_icon_rgba(128))
    png_256 = encode_png(256, render_icon_rgba(256))

    for name, data in [
        ("32x32.png", png_32),
        ("128x128.png", png_128),
        ("128x128@2x.png", png_256),
        ("icon.png", png_256),
        ("icon.ico", encode_ico(png_32, png_256)),
    ]:
        with open(os.path.join(ICONS_DIR, name), "wb") as fh:
            fh.write(data)
    print(f"Generated Bookvibe icons in {ICONS_DIR}")


if __name__ == "__main__":
    main()

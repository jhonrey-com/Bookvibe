#!/usr/bin/env python3
"""Generate minimalist monochrome obsidian-and-ivory icons and multi-size ICO assets for Bookvibe."""
import math
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS_DIR = os.path.join(ROOT, "src-tauri", "icons")
PUBLIC_DIR = os.path.join(ROOT, "public")
ASSETS_DIR = os.path.join(ROOT, "assets")
os.makedirs(ICONS_DIR, exist_ok=True)
os.makedirs(PUBLIC_DIR, exist_ok=True)
os.makedirs(ASSETS_DIR, exist_ok=True)


def seg_dist(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> float:
    vx = bx - ax
    vy = by - ay
    wx = px - ax
    wy = py - ay
    denom = vx * vx + vy * vy
    t = 0.0 if denom <= 1e-12 else max(0.0, min(1.0, (wx * vx + wy * vy) / denom))
    dx = px - (ax + t * vx)
    dy = py - (ay + t * vy)
    return math.hypot(dx, dy)


def sd_rounded_box(px: float, py: float, half_w: float, half_h: float, radius: float) -> float:
    qx = abs(px) - (half_w - radius)
    qy = abs(py) - (half_h - radius)
    return math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - radius


def blend(dst: tuple[float, float, float], src: tuple[float, float, float], alpha: float) -> tuple[float, float, float]:
    a = max(0.0, min(1.0, alpha))
    return (
        dst[0] * (1.0 - a) + src[0] * a,
        dst[1] * (1.0 - a) + src[1] * a,
        dst[2] * (1.0 - a) + src[2] * a,
    )


def sample_logo_pixel(nx: float, ny: float, px_scale: float) -> tuple[float, float, float, float]:
    """Sample single sub-pixel in normalized [-0.5, 0.5] coordinates."""
    squircle_dist = sd_rounded_box(nx, ny, 0.46, 0.46, 0.14)
    outer_alpha = max(0.0, min(1.0, 0.5 - squircle_dist * px_scale))
    if outer_alpha <= 0.0:
        return (0.0, 0.0, 0.0, 0.0)

    # Obsidian architectural base (#0d0e12) with subtle radial depth
    depth = max(0.0, 1.0 - (nx * nx + ny * ny) * 2.0) * 5.0
    col = (13.0 + depth, 14.0 + depth, 18.0 + depth)

    # Hairline inner frame (#2a2e39)
    border_band = abs(squircle_dist + 0.015) - 0.010
    border_a = max(0.0, min(1.0, 0.5 - border_band * px_scale))
    if border_a > 0.0:
        col = blend(col, (42.0, 46.0, 57.0), border_a)

    # Minimalist open-book geometric strokes (#f2efe8) matching bookvibe-logo.svg
    d_book = min(
        seg_dist(nx, ny, -0.265, -0.187, 0.0, -0.117),
        seg_dist(nx, ny, 0.265, -0.187, 0.0, -0.117),
        seg_dist(nx, ny, -0.265, 0.156, 0.0, 0.226),
        seg_dist(nx, ny, 0.265, 0.156, 0.0, 0.226),
        seg_dist(nx, ny, -0.265, -0.187, -0.265, 0.156),
        seg_dist(nx, ny, 0.265, -0.187, 0.265, 0.156),
        seg_dist(nx, ny, 0.0, -0.117, 0.0, 0.226),
    )
    book_stroke = max(0.019, 1.05 / px_scale)
    book_a = max(0.0, min(1.0, 0.5 - (d_book - book_stroke) * px_scale))
    if book_a > 0.0:
        col = blend(col, (242.0, 239.0, 232.0), book_a)

    # Secondary ruled folio lines in muted stone (#8c929f)
    d_rules = min(
        seg_dist(nx, ny, -0.18, -0.062, -0.07, -0.034),
        seg_dist(nx, ny, -0.18, 0.031, -0.07, 0.059),
        seg_dist(nx, ny, 0.07, -0.034, 0.18, -0.062),
        seg_dist(nx, ny, 0.07, 0.059, 0.18, 0.031),
    )
    rule_stroke = max(0.014, 0.85 / px_scale)
    rule_a = max(0.0, min(1.0, 0.5 - (d_rules - rule_stroke) * px_scale))
    if rule_a > 0.0:
        col = blend(col, (140.0, 146.0, 159.0), rule_a)

    return (col[0], col[1], col[2], outer_alpha * 255.0)


def render_icon_rgba(size: int) -> bytes:
    """Render supersampled RGBA icon."""
    buf = bytearray(size * size * 4)
    grid = 3 if size <= 64 else 2
    inv_g = 1.0 / grid
    samples = grid * grid

    for y in range(size):
        for x in range(size):
            ar = ag = ab = aa = 0.0
            for sy in range(grid):
                py = (y + (sy + 0.5) * inv_g) / size - 0.5
                for sx in range(grid):
                    px = (x + (sx + 0.5) * inv_g) / size - 0.5
                    r, g, b, a = sample_logo_pixel(px, py, float(size))
                    ar += r * a
                    ag += g * a
                    ab += b * a
                    aa += a
            idx = (y * size + x) * 4
            if aa > 0.0:
                buf[idx] = int(max(0, min(255, round(ar / aa))))
                buf[idx + 1] = int(max(0, min(255, round(ag / aa))))
                buf[idx + 2] = int(max(0, min(255, round(ab / aa))))
                buf[idx + 3] = int(max(0, min(255, round(aa / samples))))
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


def encode_multi_ico(images: list[tuple[int, bytes]]) -> bytes:
    # Multi-size PNG-embedded ICO container (16, 32, 48, 256)
    count = len(images)
    header = struct.pack("<HHH", 0, 1, count)
    offset = 6 + 16 * count
    entries = bytearray()
    blobs = bytearray()
    for sz, png_bytes in images:
        dim = 0 if sz >= 256 else sz
        entries.extend(struct.pack("<BBBBHHII", dim, dim, 0, 0, 1, 32, len(png_bytes), offset))
        blobs.extend(png_bytes)
        offset += len(png_bytes)
    return header + bytes(entries) + bytes(blobs)


def main() -> None:
    png_16 = encode_png(16, render_icon_rgba(16))
    png_32 = encode_png(32, render_icon_rgba(32))
    png_48 = encode_png(48, render_icon_rgba(48))
    png_128 = encode_png(128, render_icon_rgba(128))
    png_256 = encode_png(256, render_icon_rgba(256))
    png_512 = encode_png(512, render_icon_rgba(512))
    ico_bytes = encode_multi_ico([(16, png_16), (32, png_32), (48, png_48), (256, png_256)])

    for target_dir, files in [
        (
            ICONS_DIR,
            [
                ("32x32.png", png_32),
                ("128x128.png", png_128),
                ("128x128@2x.png", png_256),
                ("icon.png", png_512),
                ("icon.ico", ico_bytes),
            ],
        ),
        (PUBLIC_DIR, [("favicon.ico", ico_bytes)]),
        (ASSETS_DIR, [("bookvibe-icon-512.png", png_512)]),
    ]:
        for name, data in files:
            with open(os.path.join(target_dir, name), "wb") as fh:
                fh.write(data)
    print(f"Generated Bookvibe minimalist icons in {ICONS_DIR}, {PUBLIC_DIR}, and {ASSETS_DIR}")


if __name__ == "__main__":
    main()

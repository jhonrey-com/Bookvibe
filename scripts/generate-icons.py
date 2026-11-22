#!/usr/bin/env python3
"""Generate Bookvibe layered open-folio app icons (.png, .ico, .icns) matching assets/bookvibe-logo.svg."""
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


def cubic_points(
    p0: tuple[float, float],
    p1: tuple[float, float],
    p2: tuple[float, float],
    p3: tuple[float, float],
    steps: int = 24,
) -> list[tuple[float, float]]:
    pts = []
    for i in range(1, steps + 1):
        t = i / steps
        mt = 1.0 - t
        mt2 = mt * mt
        t2 = t * t
        x = mt2 * mt * p0[0] + 3.0 * mt2 * t * p1[0] + 3.0 * mt * t2 * p2[0] + t2 * t * p3[0]
        y = mt2 * mt * p0[1] + 3.0 * mt2 * t * p1[1] + 3.0 * mt * t2 * p2[1] + t2 * t * p3[1]
        pts.append((x / 64.0 - 0.5, y / 64.0 - 0.5))
    return pts


def norm_pt(x: float, y: float) -> tuple[float, float]:
    return (x / 64.0 - 0.5, y / 64.0 - 0.5)


def build_layers() -> list[tuple[list[tuple[float, float]], tuple[float, float, float, float], tuple[float, float, float]]]:
    # 1. Warm bronze back folio cradle (#7e6644)
    cradle = [norm_pt(11, 27)]
    cradle += cubic_points((11, 27), (11, 24.4), (13.1, 22.8), (15.6, 23.4))
    cradle.append(norm_pt(32, 27.6))
    cradle.append(norm_pt(48.4, 23.4))
    cradle += cubic_points((48.4, 23.4), (50.9, 22.8), (53, 24.4), (53, 27))
    cradle.append(norm_pt(53, 43.2))
    cradle += cubic_points((53, 43.2), (53, 45.8), (51.1, 47.9), (48.5, 48.6))
    cradle.append(norm_pt(34.6, 52.3))
    cradle += cubic_points((34.6, 52.3), (32.9, 52.8), (31.1, 52.8), (29.4, 52.3))
    cradle.append(norm_pt(15.5, 48.6))
    cradle += cubic_points((15.5, 48.6), (12.9, 47.9), (11, 45.8), (11, 43.2))

    # 2. Rising quill-page crest (#d9b478)
    wing = [norm_pt(33.2, 31.4)]
    wing += cubic_points((33.2, 31.4), (33.0, 21.6), (38.1, 13.8), (47.6, 12.2))
    wing += cubic_points((47.6, 12.2), (48.4, 21.8), (43.2, 28.8), (33.2, 31.4))

    # 3. Sculpted left ivory page (#f5f2eb)
    left_page = [norm_pt(13.5, 23.4)]
    left_page += cubic_points((13.5, 23.4), (13.5, 19.7), (16.1, 17.7), (19.8, 18.1))
    left_page += cubic_points((19.8, 18.1), (25.8, 18.7), (30.2, 22.8), (30.2, 29.2))
    left_page.append(norm_pt(30.2, 49.1))
    left_page += cubic_points((30.2, 49.1), (30.2, 50.7), (28.6, 51.3), (27.2, 50.1))
    left_page += cubic_points((27.2, 50.1), (23.6, 47.0), (19.9, 45.6), (17.1, 45.2))
    left_page += cubic_points((17.1, 45.2), (14.7, 44.8), (13.5, 43.1), (13.5, 40.3))

    # 4. Sculpted right ivory page (#dfd9cd)
    right_page = [norm_pt(33.8, 35.4)]
    right_page += cubic_points((33.8, 35.4), (33.8, 29.8), (38.1, 26.2), (44.2, 26.0))
    right_page.append(norm_pt(45.8, 26.0))
    right_page += cubic_points((45.8, 26.0), (48.8, 26.0), (50.8, 28.0), (50.8, 31.0))
    right_page.append(norm_pt(50.8, 40.6))
    right_page += cubic_points((50.8, 40.6), (50.8, 43.2), (49.4, 44.8), (46.8, 45.2))
    right_page += cubic_points((46.8, 45.2), (43.9, 45.6), (40.3, 47.0), (36.7, 50.1))
    right_page += cubic_points((36.7, 50.1), (35.3, 51.3), (33.8, 50.7), (33.8, 49.1))

    layers = []
    for pts, col in [
        (cradle, (126.0, 102.0, 68.0)),
        (wing, (217.0, 180.0, 120.0)),
        (left_page, (245.0, 242.0, 235.0)),
        (right_page, (223.0, 217.0, 205.0)),
    ]:
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        bbox = (min(xs), min(ys), max(xs), max(ys))
        layers.append((pts, bbox, col))
    return layers


LAYERS = build_layers()


def sd_rounded_box(px: float, py: float, half_w: float, half_h: float, radius: float) -> float:
    qx = abs(px) - (half_w - radius)
    qy = abs(py) - (half_h - radius)
    return math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - radius


def sd_polygon(px: float, py: float, pts: list[tuple[float, float]]) -> float:
    n = len(pts)
    min_d2 = 1e9
    inside = False
    j = n - 1
    for i in range(n):
        ax, ay = pts[j]
        bx, by = pts[i]
        vx = bx - ax
        vy = by - ay
        wx = px - ax
        wy = py - ay
        denom = vx * vx + vy * vy
        t = 0.0 if denom <= 1e-12 else max(0.0, min(1.0, (wx * vx + wy * vy) / denom))
        dx = px - (ax + t * vx)
        dy = py - (ay + t * vy)
        d2 = dx * dx + dy * dy
        if d2 < min_d2:
            min_d2 = d2
        if ((ay > py) != (by > py)) and (px < ax + (py - ay) * (bx - ax) / ((by - ay) or 1e-12)):
            inside = not inside
        j = i
    d = math.sqrt(min_d2)
    return -d if inside else d


def blend(dst: tuple[float, float, float], src: tuple[float, float, float], alpha: float) -> tuple[float, float, float]:
    a = max(0.0, min(1.0, alpha))
    return (
        dst[0] * (1.0 - a) + src[0] * a,
        dst[1] * (1.0 - a) + src[1] * a,
        dst[2] * (1.0 - a) + src[2] * a,
    )


def sample_logo_pixel(nx: float, ny: float, px_scale: float) -> tuple[float, float, float, float]:
    """Sample single sub-pixel in normalized [-0.5, 0.5] coordinates."""
    squircle_dist = sd_rounded_box(nx, ny, 0.495, 0.495, 0.245)
    outer_alpha = max(0.0, min(1.0, 0.5 - squircle_dist * px_scale))
    if outer_alpha <= 0.0:
        return (0.0, 0.0, 0.0, 0.0)

    col = (17.0, 19.0, 25.0)
    pad = 2.0 / px_scale

    # Subtle architectural obsidian hairline rim (#262b38)
    rim_alpha = max(0.0, min(1.0, 0.5 - abs(squircle_dist + 0.015) * px_scale)) * 0.85
    if rim_alpha > 0.0:
        col = blend(col, (38.0, 43.0, 56.0), rim_alpha)

    for pts, (min_x, min_y, max_x, max_y), layer_col in LAYERS:
        if nx < min_x - pad or nx > max_x + pad or ny < min_y - pad or ny > max_y + pad:
            continue
        sd = sd_polygon(nx, ny, pts)
        alpha = max(0.0, min(1.0, 0.5 - sd * px_scale))
        if alpha > 0.0:
            col = blend(col, layer_col, alpha)

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


def encode_icns(chunks: list[tuple[bytes, bytes]]) -> bytes:
    body = bytearray()
    for ostype, payload in chunks:
        body.extend(struct.pack(">4sI", ostype, 8 + len(payload)))
        body.extend(payload)
    return struct.pack(">4sI", b"icns", 8 + len(body)) + bytes(body)


def main() -> None:
    png_16 = encode_png(16, render_icon_rgba(16))
    png_32 = encode_png(32, render_icon_rgba(32))
    png_48 = encode_png(48, render_icon_rgba(48))
    png_128 = encode_png(128, render_icon_rgba(128))
    png_256 = encode_png(256, render_icon_rgba(256))
    png_512 = encode_png(512, render_icon_rgba(512))
    ico_bytes = encode_multi_ico([(16, png_16), (32, png_32), (48, png_48), (256, png_256)])
    icns_bytes = encode_icns([(b"ic07", png_128), (b"ic08", png_256), (b"ic09", png_512)])

    for target_dir, files in [
        (
            ICONS_DIR,
            [
                ("32x32.png", png_32),
                ("128x128.png", png_128),
                ("128x128@2x.png", png_256),
                ("icon.png", png_512),
                ("icon.ico", ico_bytes),
                ("icon.icns", icns_bytes),
            ],
        ),
        (PUBLIC_DIR, [("favicon.ico", ico_bytes)]),
        (ASSETS_DIR, [("bookvibe-icon-512.png", png_512)]),
    ]:
        for name, data in files:
            with open(os.path.join(target_dir, name), "wb") as fh:
                fh.write(data)
    print(f"Generated modern Bookvibe layered open-folio icons in {ICONS_DIR}, {PUBLIC_DIR}, and {ASSETS_DIR}")


if __name__ == "__main__":
    main()

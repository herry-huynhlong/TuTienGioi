from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "apps" / "web" / "public" / "sects" / "icons"
BG_DIR = ROOT / "apps" / "web" / "public" / "sects" / "backgrounds"


ICON_PALETTES = [
    ((252, 210, 92), (255, 243, 171), (120, 70, 14)),
    ((63, 220, 198), (200, 255, 245), (11, 91, 83)),
    ((235, 238, 242), (255, 255, 255), (80, 92, 116)),
    ((255, 105, 42), (255, 214, 130), (114, 28, 10)),
    ((89, 139, 255), (209, 232, 255), (21, 39, 88)),
    ((182, 225, 255), (255, 255, 255), (30, 76, 108)),
    ((255, 136, 79), (255, 236, 174), (118, 45, 12)),
    ((176, 255, 198), (234, 255, 220), (27, 93, 58)),
]


def ensure_dirs() -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    BG_DIR.mkdir(parents=True, exist_ok=True)


def glow(draw: ImageDraw.ImageDraw, xy: tuple[int, int, int, int], color: tuple[int, int, int], width: int = 4) -> None:
    for i in range(width, 0, -1):
        alpha = int(28 * i / width)
        draw.ellipse(xy, outline=(*color, alpha), width=i)


def polygon_points(cx: float, cy: float, radius: float, count: int, rotation: float = 0.0) -> list[tuple[float, float]]:
    return [
        (cx + math.cos(rotation + math.tau * i / count) * radius, cy + math.sin(rotation + math.tau * i / count) * radius)
        for i in range(count)
    ]


def draw_dragon(draw: ImageDraw.ImageDraw, color: tuple[int, int, int], hi: tuple[int, int, int], dark: tuple[int, int, int], idx: int) -> None:
    points = []
    for i in range(28):
        t = i / 27
        x = 50 + t * 158
        y = 132 + math.sin(t * math.tau * 1.7 + idx) * 42
        points.append((x, y))
    draw.line(points, fill=(*dark, 120), width=28, joint="curve")
    draw.line(points, fill=(*color, 235), width=18, joint="curve")
    draw.line(points, fill=(*hi, 190), width=5, joint="curve")
    hx, hy = points[-1]
    draw.ellipse((hx - 23, hy - 18, hx + 28, hy + 22), fill=(*color, 230), outline=(*hi, 230), width=3)
    draw.polygon([(hx + 14, hy - 16), (hx + 38, hy - 8), (hx + 16, hy + 3)], fill=(*hi, 220))
    draw.line((hx - 3, hy - 8, hx + 20, hy - 42), fill=(*hi, 210), width=3)
    draw.line((hx - 6, hy + 4, hx + 30, hy + 39), fill=(*hi, 210), width=3)
    for sx, sy in points[4::5]:
        draw.ellipse((sx - 5, sy - 5, sx + 5, sy + 5), fill=(*hi, 180))


def draw_phoenix(draw: ImageDraw.ImageDraw, color: tuple[int, int, int], hi: tuple[int, int, int], dark: tuple[int, int, int]) -> None:
    cx, cy = 128, 132
    draw.ellipse((105, 87, 151, 147), fill=(*color, 235), outline=(*hi, 230), width=3)
    for side in (-1, 1):
        wing = [(cx, cy - 10)]
        for i in range(7):
            wing.append((cx + side * (35 + i * 13), cy - 34 + i * 11))
        wing.append((cx + side * 26, cy + 27))
        draw.polygon(wing, fill=(*dark, 150), outline=(*hi, 190))
        for i in range(6):
            draw.line((cx + side * 16, cy - 8, cx + side * (60 + i * 16), cy - 25 + i * 10), fill=(*color, 220), width=5)
    for i in range(5):
        draw.line((cx, cy + 18, cx - 56 + i * 28, cy + 102), fill=(*hi, 180), width=4)
    draw.polygon([(cx, cy - 62), (cx - 9, cy - 34), (cx + 10, cy - 34)], fill=(*hi, 230))


def draw_sword(draw: ImageDraw.ImageDraw, color: tuple[int, int, int], hi: tuple[int, int, int]) -> None:
    draw.polygon([(128, 31), (144, 141), (128, 214), (112, 141)], fill=(*color, 230), outline=(*hi, 240))
    draw.line((128, 42, 128, 202), fill=(*hi, 210), width=3)
    draw.line((82, 146, 174, 146), fill=(*hi, 230), width=8)
    draw.ellipse((112, 132, 144, 164), outline=(*hi, 220), width=4)


def draw_lotus(draw: ImageDraw.ImageDraw, color: tuple[int, int, int], hi: tuple[int, int, int]) -> None:
    cx, cy = 128, 139
    for angle in range(0, 360, 45):
        r = math.radians(angle)
        x = cx + math.cos(r) * 38
        y = cy + math.sin(r) * 22
        draw.ellipse((x - 28, y - 45, x + 28, y + 45), fill=(*color, 150), outline=(*hi, 180), width=3)
    draw.ellipse((88, 104, 168, 184), fill=(*color, 210), outline=(*hi, 230), width=4)


def draw_pagoda(draw: ImageDraw.ImageDraw, color: tuple[int, int, int], hi: tuple[int, int, int]) -> None:
    for i, y in enumerate([73, 106, 139]):
        w = 88 - i * 16
        draw.polygon([(128, y - 30), (128 - w, y), (128 + w, y)], fill=(*color, 220), outline=(*hi, 230))
        draw.rectangle((128 - w + 12, y, 128 + w - 12, y + 20), fill=(*color, 150), outline=(*hi, 170))
    draw.rectangle((106, 159, 150, 205), fill=(*color, 190), outline=(*hi, 220))


def draw_motif(draw: ImageDraw.ImageDraw, motif: int, color: tuple[int, int, int], hi: tuple[int, int, int], dark: tuple[int, int, int]) -> None:
    if motif in (0, 1, 12):
        draw_dragon(draw, color, hi, dark, motif)
    elif motif == 2:
        draw.polygon([(45, 102), (98, 81), (128, 46), (158, 81), (211, 102), (165, 127), (186, 191), (128, 151), (70, 191), (91, 127)], fill=(*color, 210), outline=(*hi, 230))
    elif motif in (3, 15):
        draw_phoenix(draw, color, hi, dark)
    elif motif == 4:
        draw.ellipse((72, 76, 184, 188), fill=(*dark, 160), outline=(*hi, 230), width=4)
        draw.polygon([(128, 54), (153, 119), (128, 207), (103, 119)], fill=(*color, 190), outline=(*hi, 220))
    elif motif == 5:
        draw_sword(draw, color, hi)
    elif motif == 6:
        draw_lotus(draw, color, hi)
    elif motif in (10, 19):
        draw_pagoda(draw, color, hi)
    elif motif == 16:
        draw.polygon(polygon_points(128, 128, 82, 6, math.pi / 6), fill=(*color, 130), outline=(*hi, 230))
        draw.polygon(polygon_points(128, 128, 48, 6, 0), fill=(*hi, 145))
    elif motif == 18:
        draw.line((128, 56, 128, 204), fill=(*color, 230), width=12)
        for y in [76, 104, 132, 160]:
            draw.ellipse((92, y, 164, y + 46), outline=(*hi, 200), width=5)
    else:
        points = polygon_points(128, 128, 74, 3 + motif % 5, math.radians(motif * 13))
        draw.polygon(points, fill=(*color, 170), outline=(*hi, 230))
        draw.ellipse((86, 86, 170, 170), outline=(*hi, 220), width=5)


def make_icon(idx: int) -> Image.Image:
    color, hi, dark = ICON_PALETTES[idx % len(ICON_PALETTES)]
    base = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    aura = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    ad = ImageDraw.Draw(aura, "RGBA")
    for radius, alpha in [(108, 28), (82, 42), (58, 55)]:
        ad.ellipse((128 - radius, 128 - radius, 128 + radius, 128 + radius), fill=(*color, alpha))
    aura = aura.filter(ImageFilter.GaussianBlur(9))
    base.alpha_composite(aura)
    draw = ImageDraw.Draw(base, "RGBA")
    glow(draw, (39, 39, 217, 217), color, 5)
    draw.ellipse((56, 56, 200, 200), outline=(*hi, 170), width=3)
    draw_motif(draw, idx, color, hi, dark)
    for i in range(12):
        ang = math.tau * (i / 12) + idx * 0.11
        x = 128 + math.cos(ang) * random.Random(idx * 100 + i).randint(86, 112)
        y = 128 + math.sin(ang) * random.Random(idx * 200 + i).randint(86, 112)
        draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(*hi, 150))
    return base


def make_background(idx: int) -> Image.Image:
    rng = random.Random(9000 + idx)
    palettes = [
        ((10, 23, 18), (27, 93, 78), (214, 178, 94)),
        ((16, 19, 26), (77, 66, 112), (218, 188, 112)),
        ((8, 18, 34), (32, 88, 128), (180, 230, 255)),
        ((13, 20, 18), (45, 80, 64), (199, 226, 170)),
        ((26, 17, 10), (116, 68, 27), (239, 191, 76)),
        ((10, 21, 34), (44, 95, 138), (190, 230, 255)),
        ((31, 13, 10), (123, 42, 24), (255, 133, 67)),
        ((8, 25, 18), (32, 104, 73), (167, 234, 177)),
    ]
    top, mid, accent = palettes[idx % len(palettes)]
    img = Image.new("RGB", (1600, 500), top)
    px = img.load()
    for y in range(img.height):
        mix = y / img.height
        for x in range(img.width):
            haze = int(18 * math.sin((x / 180) + idx) * (1 - mix))
            px[x, y] = tuple(max(0, min(255, int(top[c] * (1 - mix) + mid[c] * mix) + haze)) for c in range(3))
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer, "RGBA")
    for m in range(7):
        base_y = 360 - m * 24
        points = [(0, 500)]
        for x in range(-80, 1700, 120):
            y = base_y - math.sin((x + idx * 70 + m * 30) / 155) * (48 + m * 8) - rng.randint(0, 35)
            points.append((x, y))
        points.append((1600, 500))
        alpha = 75 + m * 18
        draw.polygon(points, fill=(3, 9, 8, alpha))
    for i in range(18):
        x = rng.randint(100, 1500)
        y = rng.randint(70, 315)
        w = rng.randint(60, 180)
        h = rng.randint(16, 36)
        draw.ellipse((x - w, y - h, x + w, y + h), fill=(*accent, rng.randint(10, 28)))
    for x in [1180, 1260, 1340]:
        draw.polygon([(x, 185), (x - 110, 250), (x + 110, 250)], fill=(*accent, 82), outline=(*accent, 125))
        draw.rectangle((x - 75, 250, x + 75, 318), fill=(8, 13, 12, 138), outline=(*accent, 100))
    for i in range(140):
        x = rng.randint(0, 1599)
        y = rng.randint(0, 430)
        r = rng.choice([1, 1, 2])
        draw.ellipse((x - r, y - r, x + r, y + r), fill=(*accent, rng.randint(20, 95)))
    layer = layer.filter(ImageFilter.GaussianBlur(0.35))
    img = Image.alpha_composite(img.convert("RGBA"), layer)
    vignette = Image.new("RGBA", img.size, (0, 0, 0, 0))
    vd = ImageDraw.Draw(vignette, "RGBA")
    vd.rectangle((0, 0, 480, 500), fill=(0, 0, 0, 130))
    vd.rectangle((1180, 0, 1600, 500), fill=(0, 0, 0, 108))
    img = Image.alpha_composite(img, vignette)
    return img


def main() -> None:
    ensure_dirs()
    for idx in range(20):
        make_icon(idx).save(ICON_DIR / f"sect-icon-{idx + 1:02d}.webp", "WEBP", quality=92, method=6)
    for idx in range(8):
        make_background(idx).save(BG_DIR / f"sect-bg-{idx + 1:02d}.webp", "WEBP", quality=86, method=6)


if __name__ == "__main__":
    main()

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable

import imageio.v2 as imageio
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps


WIDTH = 1920
HEIGHT = 480
FPS = 24
DURATION = 8
FRAMES = FPS * DURATION

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "apps" / "web" / "public" / "leaderboard"
CINEMATICS = PUBLIC / "cinematics"
POSTERS = PUBLIC / "posters"
SOURCE_ART = ROOT / "scripts" / "leaderboard_source_art"


Color = tuple[int, int, int, int]


@dataclass(frozen=True)
class Palette:
    name: str
    deep: tuple[int, int, int]
    mid: tuple[int, int, int]
    accent: tuple[int, int, int]
    bright: tuple[int, int, int]
    shadow: tuple[int, int, int]


GOLD = Palette("gold", (9, 9, 6), (42, 27, 8), (220, 153, 35), (255, 229, 130), (0, 0, 0))
ICE = Palette("ice", (4, 12, 22), (8, 39, 72), (94, 178, 238), (213, 245, 255), (0, 3, 10))
FIRE = Palette("fire", (13, 5, 4), (63, 17, 8), (226, 82, 24), (255, 181, 72), (0, 0, 0))


def clamp(value: float, low: int = 0, high: int = 255) -> int:
    return int(max(low, min(high, value)))


def rgba(rgb: tuple[int, int, int], alpha: int) -> Color:
    return (rgb[0], rgb[1], rgb[2], alpha)


def add_layer(base: Image.Image, layer: Image.Image, blur: float = 0) -> None:
    if blur:
        layer = layer.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(layer)


def draw_glow_line(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]], color: Color, width: int) -> None:
    for scale, alpha in ((3.6, 25), (2.2, 45), (1.35, 75)):
        c = (color[0], color[1], color[2], min(color[3], alpha))
        draw.line(points, fill=c, width=max(1, int(width * scale)), joint="curve")
    draw.line(points, fill=color, width=width, joint="curve")


def gradient_background(palette: Palette, t: float) -> Image.Image:
    x = np.linspace(0, 1, WIDTH, dtype=np.float32)
    y = np.linspace(0, 1, HEIGHT, dtype=np.float32)[:, None]

    center_glow = np.exp(-((x - 0.54) ** 2) / 0.035)[None, :] * 0.34
    right_glow = np.exp(-((x - 0.78) ** 2) / 0.018)[None, :] * 0.14
    vertical = 0.72 + 0.28 * np.cos((y - 0.5) * math.pi)
    pulse = 0.88 + 0.12 * math.sin(t * math.tau)

    deep = np.array(palette.deep, dtype=np.float32)
    mid = np.array(palette.mid, dtype=np.float32)
    accent = np.array(palette.accent, dtype=np.float32)

    field = deep + (mid - deep) * (center_glow * vertical * pulse)[..., None]
    field += (accent - deep) * (right_glow * vertical)[..., None]

    quiet_left = np.clip((0.30 - x) / 0.30, 0, 1)[None, :]
    quiet_right = np.clip((x - 0.75) / 0.25, 0, 1)[None, :]
    field *= (1 - 0.46 * quiet_left[..., None])
    field *= (1 - 0.35 * quiet_right[..., None])

    vignette = 1 - 0.55 * np.maximum(np.abs(x - 0.5)[None, :] * 1.28, np.abs(y - 0.5) * 1.65)
    field *= np.clip(vignette, 0.42, 1)[..., None]

    image = np.zeros((HEIGHT, WIDTH, 4), dtype=np.uint8)
    image[..., :3] = np.clip(field, 0, 255).astype(np.uint8)
    image[..., 3] = 255
    return Image.fromarray(image, "RGBA")


def draw_clouds(base: Image.Image, palette: Palette, t: float, seed: int, density: int = 32) -> None:
    rng = random.Random(seed)
    layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer, "RGBA")
    for i in range(density):
        bx = 410 + rng.random() * 930
        by = 120 + rng.random() * 240
        drift = math.sin(t * math.tau + i * 0.7) * 42 + t * (18 + rng.random() * 28)
        x = ((bx + drift - 300) % 1220) + 300
        y = by + math.sin(t * math.tau * 2 + i) * 7
        w = 120 + rng.random() * 260
        h = 22 + rng.random() * 62
        alpha = int(14 + rng.random() * 34)
        color = tuple(clamp(c + 18) for c in palette.mid)
        draw.ellipse((x - w / 2, y - h / 2, x + w / 2, y + h / 2), fill=rgba(color, alpha))
    add_layer(base, layer, blur=12)


def draw_particles(base: Image.Image, palette: Palette, t: float, seed: int, count: int = 140) -> None:
    rng = random.Random(seed)
    layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer, "RGBA")
    for i in range(count):
        x0 = 360 + rng.random() * 1060
        y0 = 48 + rng.random() * 370
        speed = 24 + rng.random() * 90
        x = 300 + ((x0 - 300 + t * speed) % 1180)
        y = y0 + math.sin(t * math.tau + i * 1.9) * (6 + rng.random() * 10)
        r = 1 + rng.random() * 2.2
        alpha = int(45 + rng.random() * 110)
        draw.ellipse((x - r, y - r, x + r, y + r), fill=rgba(palette.bright, alpha))
    add_layer(base, layer, blur=0.45)


def dragon_spine(t: float, palette: Palette, phase: float, icy: bool = False) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    for i in range(72):
        u = i / 71
        x = 520 + u * 850
        wave = math.sin(u * math.tau * 2.05 + t * math.tau + phase)
        wave2 = math.sin(u * math.tau * 4.1 - t * math.tau * 1.2 + phase)
        amp = 52 if not icy else 44
        y = 236 + wave * amp + wave2 * 14 + math.sin(t * math.tau * 2 + phase) * 7
        points.append((x, y))
    return points


def draw_dragon(base: Image.Image, palette: Palette, t: float, phase: float = 0, icy: bool = False) -> None:
    spine = dragon_spine(t, palette, phase, icy)
    glow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow, "RGBA")
    draw_glow_line(gd, spine, rgba(palette.accent, 120), 17 if icy else 20)
    add_layer(base, glow, blur=4)

    body = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    bd = ImageDraw.Draw(body, "RGBA")
    for i, (x, y) in enumerate(spine):
        u = i / max(1, len(spine) - 1)
        radius = 17 + 7 * math.sin(u * math.pi) + 2 * math.sin(t * math.tau * 2 + i * 0.32)
        shade = 0.62 + 0.38 * math.sin(i * 0.55 + t * math.tau * 1.5)
        c = tuple(clamp(palette.accent[j] * shade + palette.bright[j] * (1 - shade) * 0.8) for j in range(3))
        bd.ellipse((x - radius, y - radius * 0.72, x + radius, y + radius * 0.72), fill=rgba(c, 128), outline=rgba(palette.bright, 120), width=1)
        if i % 3 == 0:
            bd.line((x - radius * 0.5, y, x + radius * 0.48, y + math.sin(i) * 5), fill=rgba(palette.bright, 70), width=1)

    hx, hy = spine[-1]
    head_shift = math.sin(t * math.tau * 1.25 + phase) * 12
    hx += 22 + head_shift
    hy += math.cos(t * math.tau * 1.1 + phase) * 10
    bd.ellipse((hx - 48, hy - 30, hx + 62, hy + 34), fill=rgba(palette.accent, 190), outline=rgba(palette.bright, 190), width=3)
    bd.polygon([(hx + 26, hy - 25), (hx + 86, hy - 6), (hx + 24, hy + 18)], fill=rgba(palette.bright, 150))
    bd.polygon([(hx - 18, hy - 29), (hx - 2, hy - 72), (hx + 10, hy - 26)], fill=rgba(palette.bright, 155))
    bd.polygon([(hx + 10, hy - 27), (hx + 42, hy - 68), (hx + 34, hy - 18)], fill=rgba(palette.bright, 140))
    for side in (-1, 1):
        whisker = []
        for k in range(22):
            q = k / 21
            whisker.append((hx + 30 + q * 150, hy + side * (8 + q * 48 + math.sin(q * math.tau * 2 + t * math.tau * 2) * 12)))
        bd.line(whisker, fill=rgba(palette.bright, 160), width=3)
    eye = rgba((255, 255, 230), 210) if not icy else rgba((215, 250, 255), 220)
    bd.ellipse((hx + 23, hy - 7, hx + 31, hy + 1), fill=eye)

    tx, ty = spine[0]
    tail_phase = math.sin(t * math.tau * 1.4 + phase) * 20
    bd.polygon([(tx - 8, ty), (tx - 98, ty - 32 + tail_phase), (tx - 54, ty + 26 - tail_phase)], fill=rgba(palette.bright, 110))
    add_layer(base, body, blur=0.3)


def draw_phoenix(base: Image.Image, t: float) -> None:
    layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer, "RGBA")
    cx = 965 + math.sin(t * math.tau) * 16
    cy = 242 + math.cos(t * math.tau * 1.15) * 10
    wing = 78 + math.sin(t * math.tau * 1.7) * 20

    for side in (-1, 1):
        for i in range(18):
            u = i / 17
            length = 310 - u * 120 + math.sin(t * math.tau * 2 + i) * 13
            angle = side * (0.28 + u * 0.9 + math.sin(t * math.tau + i) * 0.05)
            root = (cx + side * (35 + u * 70), cy - 12 + u * wing * 0.25)
            tip = (root[0] + math.cos(angle) * length * side, root[1] - math.sin(abs(angle)) * length * 0.55 + u * 70)
            mid = ((root[0] + tip[0]) / 2 + side * 32, (root[1] + tip[1]) / 2 - 58 - math.sin(t * math.tau * 1.5 + i) * 18)
            color = tuple(clamp(FIRE.accent[j] * (0.7 + u * 0.2) + FIRE.bright[j] * (0.34 - u * 0.12)) for j in range(3))
            draw.line([root, mid, tip], fill=rgba(color, int(82 + u * 80)), width=max(4, int(14 - u * 8)), joint="curve")
            draw.line([mid, tip], fill=rgba(FIRE.bright, int(72 + u * 50)), width=max(1, int(4 - u * 2)))

    draw.ellipse((cx - 40, cy - 28, cx + 46, cy + 34), fill=rgba(FIRE.accent, 205), outline=rgba(FIRE.bright, 190), width=3)
    draw.polygon([(cx + 34, cy - 12), (cx + 86, cy - 3), (cx + 36, cy + 12)], fill=rgba(FIRE.bright, 190))
    draw.polygon([(cx - 6, cy - 28), (cx + 12, cy - 72), (cx + 22, cy - 24)], fill=rgba(FIRE.bright, 160))
    for i in range(8):
        q = i / 7
        sway = math.sin(t * math.tau * 1.4 + i) * 32
        start = (cx - 24 + i * 7, cy + 24)
        end = (cx - 210 + q * 120 + sway, cy + 145 + i * 18)
        mid = ((start[0] + end[0]) / 2 - 90, (start[1] + end[1]) / 2 + math.sin(t * math.tau + i) * 30)
        draw.line([start, mid, end], fill=rgba(FIRE.bright, 120), width=7, joint="curve")
        draw.line([start, end], fill=rgba(FIRE.accent, 80), width=16)

    add_layer(base, layer, blur=0.45)


def frame_gold(t: float) -> Image.Image:
    img = gradient_background(GOLD, t)
    draw_clouds(img, GOLD, t, 101, 38)
    draw_dragon(img, GOLD, t, phase=0.2)
    draw_particles(img, GOLD, t, 102, 155)
    return finish_frame(img, GOLD)


def frame_ice(t: float) -> Image.Image:
    img = gradient_background(ICE, t)
    draw_clouds(img, ICE, t, 201, 34)
    draw_dragon(img, ICE, t, phase=1.1, icy=True)
    draw_particles(img, ICE, t, 202, 125)
    return finish_frame(img, ICE)


def frame_fire(t: float) -> Image.Image:
    img = gradient_background(FIRE, t)
    draw_clouds(img, FIRE, t, 301, 26)
    draw_phoenix(img, t)
    draw_particles(img, FIRE, t, 302, 150)
    return finish_frame(img, FIRE)


def finish_frame(img: Image.Image, palette: Palette) -> Image.Image:
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    draw.rectangle((0, 0, int(WIDTH * 0.3), HEIGHT), fill=(0, 0, 0, 86))
    draw.rectangle((int(WIDTH * 0.75), 0, WIDTH, HEIGHT), fill=(0, 0, 0, 68))
    draw.rectangle((0, 0, WIDTH, HEIGHT), outline=rgba(palette.bright, 82), width=2)
    add_layer(img, overlay)
    return img.convert("RGB")


def load_source_art(name: str) -> Image.Image | None:
    path = SOURCE_ART / f"{name}-source.png"
    if not path.exists():
        return None
    source = Image.open(path).convert("RGB")
    return ImageOps.fit(source, (WIDTH, HEIGHT), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5)).convert("RGBA")


def source_motion_frame(source: Image.Image, palette: Palette, t: float, seed: int, intensity: float) -> Image.Image:
    rgb = np.asarray(source.convert("RGB"))
    h, w = rgb.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = xx / w
    safe_mask = np.clip((nx - 0.30) / 0.08, 0, 1) * np.clip((0.75 - nx) / 0.08, 0, 1)
    vertical_mask = 0.35 + 0.65 * np.sin(np.clip(yy / h, 0, 1) * math.pi)
    mask = safe_mask * vertical_mask
    dx = (
        np.sin(yy / 36.0 + t * math.tau * 1.15 + seed) * 9.0
        + np.sin(xx / 92.0 - t * math.tau * 1.55) * 5.5
        + np.sin((xx + yy) / 70.0 + t * math.tau * 0.75) * 4.0
    ) * mask * intensity
    dy = (
        np.sin(xx / 68.0 + t * math.tau * 1.05 + seed * 0.3) * 7.0
        + np.cos(yy / 58.0 - t * math.tau * 1.35) * 3.5
    ) * mask * intensity
    warped = cv2.remap(rgb, xx + dx, yy + dy, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    img = Image.fromarray(warped, "RGB").convert("RGBA")

    sweep = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sweep, "RGBA")
    band_x = 350 + ((t * 920 + seed * 37) % 1200)
    sd.polygon(
        [(band_x - 260, 0), (band_x - 130, 0), (band_x + 160, HEIGHT), (band_x + 20, HEIGHT)],
        fill=rgba(palette.bright, 22),
    )
    add_layer(img, sweep, blur=18)

    draw_clouds(img, palette, t, seed + 50, 22)
    draw_particles(img, palette, t, seed + 80, 120)
    return finish_frame(img, palette)


def write_video(frames: Iterable[np.ndarray], path: Path, fps: int, codec: str, params: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with imageio.get_writer(path, fps=fps, codec=codec, macro_block_size=1, output_params=params) as writer:
        for frame in frames:
            writer.append_data(frame)


def render_asset(name: str, render: Callable[[float], Image.Image], poster_name: str) -> None:
    print(f"Rendering {name}")
    cache: list[np.ndarray] = []
    poster: Image.Image | None = None
    poster_index = FRAMES // 4
    for index in range(FRAMES):
        t = index / FRAMES
        image = render(t)
        if index == poster_index:
            poster = image.copy()
        cache.append(np.asarray(image))
        if index % 24 == 0:
            print(f"  frame {index + 1}/{FRAMES}")

    if poster is None:
        poster = Image.fromarray(cache[0])
    POSTERS.mkdir(parents=True, exist_ok=True)
    poster.save(POSTERS / poster_name, "WEBP", quality=88, method=6)

    write_video(
        cache,
        CINEMATICS / f"{name}.mp4",
        FPS,
        "libx264",
        ["-pix_fmt", "yuv420p", "-crf", "23", "-preset", "medium", "-movflags", "+faststart", "-an"],
    )
    write_video(
        cache,
        CINEMATICS / f"{name}.webm",
        FPS,
        "libvpx-vp9",
        ["-pix_fmt", "yuv420p", "-crf", "34", "-b:v", "0", "-row-mt", "1", "-an"],
    )


def main() -> None:
    CINEMATICS.mkdir(parents=True, exist_ok=True)
    POSTERS.mkdir(parents=True, exist_ok=True)
    rank1 = load_source_art("rank1-golden-dragon")
    rank2 = load_source_art("rank2-ice-moon-dragon")
    rank3 = load_source_art("rank3-fire-phoenix")
    render_asset(
        "rank1-golden-dragon",
        (lambda t: source_motion_frame(rank1, GOLD, t, 1001, 1.0)) if rank1 else frame_gold,
        "rank1-golden-dragon-poster.webp",
    )
    render_asset(
        "rank2-ice-moon-dragon",
        (lambda t: source_motion_frame(rank2, ICE, t, 2001, 0.78)) if rank2 else frame_ice,
        "rank2-ice-moon-dragon-poster.webp",
    )
    render_asset(
        "rank3-fire-phoenix",
        (lambda t: source_motion_frame(rank3, FIRE, t, 3001, 0.92)) if rank3 else frame_fire,
        "rank3-fire-phoenix-poster.webp",
    )


if __name__ == "__main__":
    main()

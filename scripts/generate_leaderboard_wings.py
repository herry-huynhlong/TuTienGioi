from __future__ import annotations

import math
import random
import subprocess
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps
import imageio_ffmpeg


WIDTH = 720
HEIGHT = 360
FPS = 24
DURATION = 8
FRAMES = FPS * DURATION

ROOT = Path(__file__).resolve().parents[1]
WINGS = ROOT / "apps" / "web" / "public" / "leaderboard" / "wings"
SOURCE_ART = ROOT / "scripts" / "leaderboard_wing_source_art"


@dataclass(frozen=True)
class WingPalette:
    accent: tuple[int, int, int]
    bright: tuple[int, int, int]
    deep: tuple[int, int, int]
    particle: tuple[int, int, int]
    name: str


GOLD = WingPalette((229, 165, 42), (255, 241, 169), (63, 35, 4), (255, 218, 94), "gold")
ICE = WingPalette((103, 184, 242), (226, 250, 255), (7, 31, 63), (174, 231, 255), "ice")
FIRE = WingPalette((236, 82, 26), (255, 196, 90), (76, 16, 5), (255, 120, 34), "fire")


def rgba(rgb: tuple[int, int, int], alpha: int) -> tuple[int, int, int, int]:
    return rgb[0], rgb[1], rgb[2], alpha


def add_layer(base: Image.Image, layer: Image.Image, blur: float = 0) -> None:
    if blur:
        layer = layer.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(layer)


def draw_feather(
    draw: ImageDraw.ImageDraw,
    root: tuple[float, float],
    tip: tuple[float, float],
    width: float,
    color: tuple[int, int, int],
    alpha: int,
    curve: float,
) -> None:
    rx, ry = root
    tx, ty = tip
    dx = tx - rx
    dy = ty - ry
    length = max(1, math.hypot(dx, dy))
    nx = -dy / length
    ny = dx / length
    mid = ((rx + tx) / 2 + nx * curve, (ry + ty) / 2 + ny * curve)
    left = (mid[0] + nx * width, mid[1] + ny * width)
    right = (mid[0] - nx * width, mid[1] - ny * width)
    draw.polygon([root, left, tip, right], fill=rgba(color, alpha))
    draw.line([root, mid, tip], fill=rgba(tuple(min(255, c + 38) for c in color), min(230, alpha + 42)), width=max(1, int(width * 0.16)))


def draw_wing_side(layer: Image.Image, palette: WingPalette, t: float, side: int, rank_scale: float, fire: bool = False) -> None:
    draw = ImageDraw.Draw(layer, "RGBA")
    cx = WIDTH * 0.5
    cy = HEIGHT * 0.52
    breath = math.sin(t * math.tau) * (10 if rank_scale > 0.95 else 7)
    for row in range(3):
        count = 13 - row * 2
        for i in range(count):
            u = i / max(1, count - 1)
            spread = (120 + row * 52) * rank_scale
            length = (178 - row * 34 + (1 - u) * 60) * rank_scale
            angle = side * (0.26 + u * 0.92 + row * 0.13 + math.sin(t * math.tau * 1.25 + i * 0.55 + row) * 0.028)
            root = (cx + side * (18 + row * 10), cy + row * 12 - 34 + u * 62)
            flex = math.sin(t * math.tau * 1.7 + i * 0.44 + row) * (10 + row * 2)
            tip = (
                root[0] + side * (math.cos(abs(angle)) * (length + spread * u * 0.35) + 52 + row * 15),
                root[1] - math.sin(abs(angle)) * length * 0.72 + u * 115 + breath + flex,
            )
            shade = 0.62 + 0.3 * math.sin(t * math.tau * 1.1 + i * 0.37 + row)
            color = tuple(int(palette.accent[c] * shade + palette.bright[c] * (1 - shade) * 0.72) for c in range(3))
            alpha = int((86 - row * 10 + (1 - u) * 45) * rank_scale)
            draw_feather(draw, root, tip, 12 * rank_scale * (1 - row * 0.16), color, alpha, side * (18 + row * 6) * math.sin(t * math.tau + u * 2))
            if fire and i % 2 == 0:
                draw.line([root, tip], fill=rgba(palette.bright, 72), width=max(1, int(3 * rank_scale)))


def draw_energy(layer: Image.Image, palette: WingPalette, t: float, rank_scale: float) -> None:
    draw = ImageDraw.Draw(layer, "RGBA")
    cx = WIDTH * 0.5
    cy = HEIGHT * 0.5
    for side in (-1, 1):
        for i in range(9):
            phase = t * math.tau * (0.9 + i * 0.04) + i * 0.75
            length = (148 + i * 22) * rank_scale
            yoff = -80 + i * 22
            root = (cx + side * 20, cy + yoff * 0.36)
            points = []
            for k in range(18):
                q = k / 17
                x = root[0] + side * (q * length + math.sin(phase + q * 5) * 10)
                y = root[1] + yoff * q + math.sin(phase * 1.4 + q * math.tau) * 11
                points.append((x, y))
            draw.line(points, fill=rgba(palette.bright, int(40 + 30 * rank_scale)), width=max(1, int(2 * rank_scale)))


def draw_particles(layer: Image.Image, palette: WingPalette, t: float, seed: int, count: int, rank_scale: float) -> None:
    rng = random.Random(seed)
    draw = ImageDraw.Draw(layer, "RGBA")
    for i in range(count):
        x0 = 170 + rng.random() * 380
        y0 = 58 + rng.random() * 235
        x = 130 + ((x0 - 130 + t * (20 + rng.random() * 60)) % 460)
        y = y0 + math.sin(t * math.tau * 1.3 + i) * 8 - t * (8 + rng.random() * 20)
        r = (1.0 + rng.random() * 2.2) * rank_scale
        alpha = int((42 + rng.random() * 105) * rank_scale)
        draw.ellipse((x - r, y - r, x + r, y + r), fill=rgba(palette.particle, alpha))


def render_frame(palette: WingPalette, t: float, rank_scale: float, seed: int, fire: bool = False) -> Image.Image:
    img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))

    aura = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    ad = ImageDraw.Draw(aura, "RGBA")
    pulse = 0.75 + 0.25 * math.sin(t * math.tau)
    ad.ellipse((WIDTH * 0.24, HEIGHT * 0.18, WIDTH * 0.76, HEIGHT * 0.82), fill=rgba(palette.accent, int(30 * pulse * rank_scale)))
    ad.ellipse((WIDTH * 0.35, HEIGHT * 0.28, WIDTH * 0.65, HEIGHT * 0.72), fill=rgba(palette.bright, int(25 * pulse * rank_scale)))
    add_layer(img, aura, blur=26)

    wings = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw_wing_side(wings, palette, t, -1, rank_scale, fire)
    draw_wing_side(wings, palette, t, 1, rank_scale, fire)
    add_layer(img, wings, blur=0.4)

    energy = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw_energy(energy, palette, t, rank_scale)
    draw_particles(energy, palette, t, seed, int(92 * rank_scale), rank_scale)
    add_layer(img, energy, blur=0.4)

    center = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    cd = ImageDraw.Draw(center, "RGBA")
    cd.ellipse((WIDTH * 0.40, HEIGHT * 0.24, WIDTH * 0.60, HEIGHT * 0.76), fill=(0, 0, 0, 130))
    add_layer(img, center, blur=18)
    return img


def transparentize_source(source: Image.Image) -> Image.Image:
    rgb = np.asarray(source.convert("RGB")).astype(np.float32)
    luminance = rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    alpha = np.clip((luminance - 8) * 4.4 + chroma * 1.15, 0, 255)
    alpha = cv2.GaussianBlur(alpha.astype(np.uint8), (0, 0), 0.8)
    rgba_arr = np.dstack([rgb.astype(np.uint8), alpha])
    return Image.fromarray(rgba_arr, "RGBA")


def load_source_art(name: str) -> Image.Image | None:
    path = SOURCE_ART / f"{name}-source.png"
    if not path.exists():
        return None
    source = Image.open(path).convert("RGB")
    fitted = ImageOps.fit(source, (WIDTH, HEIGHT), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    return transparentize_source(fitted)


def source_wing_motion_frame(source: Image.Image, palette: WingPalette, t: float, rank_scale: float, seed: int, fire: bool = False) -> Image.Image:
    rgba_source = np.asarray(source.convert("RGBA"))
    h, w = rgba_source.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = xx / w
    ny = yy / h
    center_gap = np.clip(np.abs(nx - 0.5) / 0.15, 0, 1)
    wing_mask = center_gap * np.clip((0.95 - np.abs(ny - 0.5)) / 0.55, 0, 1)
    side = np.sign(nx - 0.5)
    flap = math.sin(t * math.tau) * (5.5 + 5 * rank_scale)
    dx = (
        np.sin(yy / 26.0 + t * math.tau * 1.4 + seed) * 4.5
        + np.sin((xx + yy) / 74.0 - t * math.tau * 1.1) * 3.5
        + side * flap * np.sin(ny * math.pi)
    ) * wing_mask
    dy = (
        np.sin(xx / 44.0 + t * math.tau * 1.7 + seed * 0.2) * 5.2
        + np.cos(yy / 34.0 - t * math.tau * 1.2) * 3.2
    ) * wing_mask
    warped = cv2.remap(rgba_source, xx + dx, yy + dy, cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    img = Image.fromarray(warped, "RGBA")

    energy = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw_energy(energy, palette, t, rank_scale)
    draw_particles(energy, palette, t, seed + 900, int(82 * rank_scale), rank_scale)
    if fire:
        fd = ImageDraw.Draw(energy, "RGBA")
        for i in range(18):
            y = 70 + i * 12 + math.sin(t * math.tau * 1.4 + i) * 18
            alpha = int(24 + 28 * math.sin(t * math.tau + i) ** 2)
            fd.arc((60 + i * 8, y, WIDTH - 60 - i * 8, y + 190), 200, 340, fill=rgba(palette.bright, alpha), width=2)
    add_layer(img, energy, blur=0.35)

    center_shadow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    cd = ImageDraw.Draw(center_shadow, "RGBA")
    cd.ellipse((WIDTH * 0.40, HEIGHT * 0.18, WIDTH * 0.60, HEIGHT * 0.82), fill=(0, 0, 0, 52))
    add_layer(img, center_shadow, blur=20)
    return img


def write_webm_alpha(frames: list[np.ndarray], path: Path) -> None:
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [
        ffmpeg,
        "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-pix_fmt", "rgba",
        "-s", f"{WIDTH}x{HEIGHT}",
        "-r", str(FPS),
        "-i", "-",
        "-an",
        "-c:v", "libvpx-vp9",
        "-pix_fmt", "yuva420p",
        "-auto-alt-ref", "0",
        "-crf", "32",
        "-b:v", "0",
        "-row-mt", "1",
        str(path),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    assert proc.stdin is not None
    for frame in frames:
        proc.stdin.write(frame.tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError(f"ffmpeg failed while writing {path}")


def write_mp4_preview(frames: list[np.ndarray], path: Path) -> None:
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [
        ffmpeg,
        "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-pix_fmt", "rgba",
        "-s", f"{WIDTH}x{HEIGHT}",
        "-r", str(FPS),
        "-i", "-",
        "-vf", "format=yuv420p",
        "-an",
        "-c:v", "libx264",
        "-crf", "25",
        "-preset", "medium",
        "-movflags", "+faststart",
        str(path),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    assert proc.stdin is not None
    for frame in frames:
        proc.stdin.write(frame.tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError(f"ffmpeg failed while writing {path}")


def render_asset(name: str, palette: WingPalette, scale: float, seed: int, fire: bool = False) -> None:
    print(f"Rendering {name}")
    WINGS.mkdir(parents=True, exist_ok=True)
    frames: list[np.ndarray] = []
    poster: Image.Image | None = None
    source = load_source_art(name)
    for index in range(FRAMES):
        t = index / FRAMES
        frame = source_wing_motion_frame(source, palette, t, scale, seed, fire) if source else render_frame(palette, t, scale, seed, fire)
        if index == FRAMES // 4:
            poster = frame.copy()
        frames.append(np.asarray(frame.convert("RGBA")))
        if index % 24 == 0:
            print(f"  frame {index + 1}/{FRAMES}")
    assert poster is not None
    poster.save(WINGS / f"{name}-poster.webp", "WEBP", quality=88, method=6, lossless=False)
    write_mp4_preview(frames, WINGS / f"{name}.mp4")
    write_webm_alpha(frames, WINGS / f"{name}.webm")


def main() -> None:
    render_asset("rank1-divine-wings", GOLD, 1.0, 701)
    render_asset("rank2-ice-wings", ICE, 0.86, 702)
    render_asset("rank3-phoenix-wings", FIRE, 0.76, 703, fire=True)


if __name__ == "__main__":
    main()

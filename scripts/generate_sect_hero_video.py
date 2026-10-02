from __future__ import annotations

import math
import subprocess
from pathlib import Path

import cv2
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "apps" / "web" / "public"
SOURCE = PUBLIC / "assets" / "images" / "sect-bg.webp"
VIDEOS = PUBLIC / "assets" / "videos"

WIDTH = 1920
HEIGHT = 600
FPS = 24
DURATION = 8
FRAMES = FPS * DURATION


def cover_resize(image: Image.Image, width: int, height: int) -> Image.Image:
    ratio = max(width / image.width, height / image.height)
    resized = image.resize((math.ceil(image.width * ratio), math.ceil(image.height * ratio)), Image.Resampling.LANCZOS)
    left = (resized.width - width) // 2
    top = (resized.height - height) // 2
    return resized.crop((left, top, left + width, top + height))


def load_source() -> Image.Image:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Missing source artwork: {SOURCE}")
    image = cover_resize(Image.open(SOURCE).convert("RGB"), WIDTH, HEIGHT)
    image = ImageEnhance.Brightness(image).enhance(1.08)
    image = ImageEnhance.Contrast(image).enhance(1.06)
    image = ImageEnhance.Color(image).enhance(1.08)
    return image


def alpha_composite(base: Image.Image, layer: Image.Image, blur: float = 0) -> None:
    if blur:
        layer = layer.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(layer)


def draw_cloud_band(size: tuple[int, int], t: float, y: int, speed: float, seed: int, opacity: int) -> Image.Image:
    width, height = size
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer, "RGBA")
    offset = (t * speed + seed * 37) % (width + 480) - 480
    rng = np.random.default_rng(seed)
    for i in range(22):
        cx = offset + i * 130 + float(rng.normal(0, 24))
        cy = y + float(rng.normal(0, 18))
        rx = float(rng.uniform(130, 280))
        ry = float(rng.uniform(28, 82))
        color = (208, 236, 231, int(opacity * rng.uniform(0.55, 1.0)))
        draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=color)
    return layer


def make_frame(source: Image.Image, index: int) -> Image.Image:
    t = index / FRAMES
    loop = math.sin(t * math.tau)
    loop2 = math.cos(t * math.tau)

    rgb = np.asarray(source, dtype=np.uint8)
    h, w = rgb.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = xx / w
    ny = yy / h

    landscape_mask = np.clip((ny - 0.05) / 0.35, 0, 1) * np.clip((0.92 - ny) / 0.25, 0, 1)
    center_mask = np.clip((nx - 0.18) / 0.18, 0, 1) * np.clip((0.90 - nx) / 0.18, 0, 1)
    mist_mask = landscape_mask * center_mask

    dx = (
        np.sin(yy / 72.0 + t * math.tau) * 2.8
        + np.sin((xx + yy) / 120.0 - t * math.tau) * 1.9
    ) * mist_mask
    dy = (
        np.cos(xx / 96.0 - t * math.tau) * 1.9
        + np.sin(yy / 110.0 + t * math.tau) * 1.5
    ) * mist_mask

    warped = cv2.remap(rgb, xx + dx, yy + dy, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    frame = Image.fromarray(warped, "RGB").convert("RGBA")

    # Seamless micro-drift gives depth without feeling like a camera pan.
    drift_x = int(loop * 8)
    drift_y = int(loop2 * 4)
    larger = source.resize((WIDTH + 32, HEIGHT + 16), Image.Resampling.BICUBIC)
    drift = larger.crop((16 + drift_x, 8 + drift_y, 16 + drift_x + WIDTH, 8 + drift_y + HEIGHT)).convert("RGBA")
    frame = Image.blend(drift, frame, 0.82).convert("RGBA")

    clouds = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    alpha_composite(clouds, draw_cloud_band((WIDTH, HEIGHT), t, 430, 95, 11, 54), blur=24)
    alpha_composite(clouds, draw_cloud_band((WIDTH, HEIGHT), (t + 0.5) % 1, 255, -65, 23, 32), blur=30)
    alpha_composite(frame, clouds, blur=0)

    shimmer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shimmer, "RGBA")
    ray_x = 1210 + loop * 24
    sd.polygon(
        [(ray_x - 110, 0), (ray_x + 45, 0), (ray_x - 200, HEIGHT), (ray_x - 390, HEIGHT)],
        fill=(255, 223, 142, 22),
    )
    sd.polygon(
        [(ray_x + 90, 0), (ray_x + 210, 0), (ray_x + 20, HEIGHT), (ray_x - 120, HEIGHT)],
        fill=(255, 242, 180, 16),
    )
    alpha_composite(frame, shimmer, blur=26)

    dust = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dust, "RGBA")
    rng = np.random.default_rng(710)
    for i in range(90):
        base_x = float(rng.uniform(420, 1540))
        base_y = float(rng.uniform(90, 500))
        x = (base_x + math.sin(t * math.tau + i) * 24 + t * 34) % WIDTH
        y = base_y + math.cos(t * math.tau * 0.7 + i * 1.7) * 9
        r = float(rng.uniform(0.7, 2.2))
        a = int(38 + 28 * (0.5 + 0.5 * math.sin(t * math.tau + i)))
        dd.ellipse((x - r, y - r, x + r, y + r), fill=(255, 224, 145, a))
    alpha_composite(frame, dust, blur=0.6)

    water = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    wd = ImageDraw.Draw(water, "RGBA")
    for x in (220, 780, 1180, 1740):
        wobble = math.sin(t * math.tau + x / 80) * 7
        wd.rounded_rectangle((x + wobble, 235, x + 9 + wobble, 525), radius=6, fill=(215, 248, 255, 18))
    alpha_composite(frame, water, blur=5)

    veil = Image.new("RGBA", (WIDTH, HEIGHT), (3, 12, 12, 18))
    alpha_composite(frame, veil, blur=0)
    return frame.convert("RGB")


def write_video(path: Path, pix_fmt: str, codec: str, params: list[str]) -> None:
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    source = load_source()
    cmd = [
        ffmpeg,
        "-y",
        "-f",
        "rawvideo",
        "-vcodec",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-s",
        f"{WIDTH}x{HEIGHT}",
        "-r",
        str(FPS),
        "-i",
        "-",
        "-vf",
        f"format={pix_fmt}",
        "-an",
        "-c:v",
        codec,
        *params,
        str(path),
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    assert proc.stdin is not None
    for index in range(FRAMES):
        frame = make_frame(source, index)
        proc.stdin.write(np.asarray(frame).tobytes())
        if index % 48 == 0:
            print(f"{path.name}: frame {index + 1}/{FRAMES}")
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError(f"ffmpeg failed while writing {path}")


def main() -> None:
    VIDEOS.mkdir(parents=True, exist_ok=True)
    source = load_source()
    poster = make_frame(source, FRAMES // 4)
    SOURCE.parent.mkdir(parents=True, exist_ok=True)
    poster.save(SOURCE, "WEBP", quality=88, method=6)
    write_video(VIDEOS / "sect-bg.mp4", "yuv420p", "libx264", ["-crf", "24", "-preset", "medium", "-movflags", "+faststart"])
    write_video(VIDEOS / "sect-bg.webm", "yuv420p", "libvpx-vp9", ["-crf", "36", "-b:v", "0", "-row-mt", "1"])


if __name__ == "__main__":
    main()

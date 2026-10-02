from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


OUTPUT_NAMES = [
    "kim-long-an.webp",
    "thanh-long-an.webp",
    "bach-ho-an.webp",
    "chu-tuoc-an.webp",
    "huyen-vu-an.webp",
    "tien-kiem-an.webp",
    "lien-hoa-an.webp",
    "nguyet-luan-an.webp",
    "thai-duong-an.webp",
    "son-nhac-an.webp",
    "bao-thap-an.webp",
    "linh-hac-an.webp",
    "ky-lan-an.webp",
    "thien-van-an.webp",
    "loi-an.webp",
    "hoa-an.webp",
    "bang-tinh-an.webp",
    "am-duong-an.webp",
    "than-moc-an.webp",
    "thien-khuyet-an.webp",
]


def split_sheet(sheet_path: Path, names: list[str], out_dir: Path) -> None:
    image = Image.open(sheet_path).convert("RGB")
    cell_w = image.width / 5
    for index, name in enumerate(names):
        left = round(index * cell_w)
        right = round((index + 1) * cell_w)
        cell = image.crop((left, 0, right, image.height))
        scale = min(512 / cell.width, 512 / cell.height)
        resized = cell.resize((round(cell.width * scale), round(cell.height * scale)), Image.Resampling.LANCZOS)
        tile = Image.new("RGB", (512, 512), (5, 8, 8))
        tile.paste(resized, ((512 - resized.width) // 2, (512 - resized.height) // 2))
        tile.save(out_dir / name, "WEBP", quality=92, method=6)


def main() -> None:
    if len(sys.argv) != 6:
        raise SystemExit("Usage: python scripts/split_sect_icon_sheets.py <sheet1> <sheet2> <sheet3> <sheet4> <out_dir>")
    sheets = [Path(arg) for arg in sys.argv[1:5]]
    out_dir = Path(sys.argv[5])
    out_dir.mkdir(parents=True, exist_ok=True)
    for sheet_index, sheet in enumerate(sheets):
        split_sheet(sheet, OUTPUT_NAMES[sheet_index * 5:(sheet_index + 1) * 5], out_dir)


if __name__ == "__main__":
    main()

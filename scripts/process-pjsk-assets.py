"""Create high-resolution PJSK sticker bases without embedded captions.

The repository keeps the original 296px-ish WebP files under
``public/pjsk-stamp/stamps``. This script writes a non-destructive, generated
set under ``public/pjsk-stamp/stamps-clean`` and is intentionally deterministic
so the asset pass can be regenerated later.

Dependencies: Pillow and opencv-python.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFilter


GENERIC_NAME = re.compile(r"^[A-Za-z0-9×]+ \d+$")


def has_embedded_text(name: str) -> bool:
    """The source index names the official captioned stickers descriptively."""

    return GENERIC_NAME.fullmatch(name.strip()) is None


def _subject_protection(ink: np.ndarray, height: int, width: int) -> np.ndarray:
    """Approximate the central/lower character silhouette.

    Official sticker captions sit in the open margin around the character. A
    lower-half estimate gives us a conservative keep region without requiring
    OCR (which would be brittle for stylized Japanese glyphs at this size).
    """

    yy, xx = np.indices((height, width))
    lower = ink & (yy >= int(height * 0.38))
    points = np.argwhere(lower)
    if len(points) < max(24, width // 2):
        points = np.argwhere(ink)
    if len(points) == 0:
        return np.ones((height, width), dtype=bool)

    y_values = points[:, 0]
    x_values = points[:, 1]
    x0, x1 = np.percentile(x_values, [5, 95])
    y0, y1 = np.percentile(y_values, [5, 99])
    cx = (x0 + x1) / 2
    cy = (y0 + y1) / 2
    rx = max((x1 - x0) / 2 + width * 0.12, width * 0.27)
    ry = max((y1 - y0) / 2 + height * 0.11, height * 0.31)

    ellipse = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1
    # Character hair/accessories often reach above the ellipse. Keep the
    # central top lane, but leave the outer caption lanes editable.
    top_lane = (yy < max(y0 - height * 0.08, height * 0.12)) & (np.abs(xx - cx) < width * 0.24)
    return ellipse | top_lane


def detect_caption_mask(rgba: np.ndarray) -> np.ndarray:
    """Return a soft expanded mask for caption-colored strokes."""

    height, width = rgba.shape[:2]
    rgb = rgba[:, :, :3]
    alpha = rgba[:, :, 3]
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    saturation = hsv[:, :, 1]
    value = hsv[:, :, 2]
    opaque = alpha > 24

    # Captions are flat, saturated strokes. Keep dark outlines in the seed so
    # dilation also clears their anti-aliased fringe.
    colored = opaque & (saturation > 48) & (value > 56)
    dark_ink = opaque & (value < 150) & (saturation > 24)
    ink = colored | dark_ink
    keep = _subject_protection(ink, height, width)

    yy, xx = np.indices((height, width))
    outer_margin = (xx < width * 0.3) | (xx > width * 0.7) | (yy < height * 0.38)
    candidate = colored & ~keep & outer_margin

    # Close glyph fragments first, then expand enough to catch their dark
    # outline. The small source dimensions make a 3-5px native mask suitable.
    candidate = cv2.morphologyEx(candidate.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    candidate = cv2.dilate(candidate, np.ones((3, 3), np.uint8), iterations=2)

    # Remove tiny isolated colored noise while retaining punctuation-sized
    # marks such as 「！」 and musical notes.
    count, labels, stats, _ = cv2.connectedComponentsWithStats(candidate, 8)
    cleaned = np.zeros_like(candidate)
    minimum = max(2, int(width * height * 0.00003))
    for index in range(1, count):
        if stats[index, cv2.CC_STAT_AREA] >= minimum:
            cleaned[labels == index] = 1

    return (cleaned > 0).astype(np.uint8) * 255


def upscale_rgba(rgba: np.ndarray, scale: float) -> Image.Image:
    height, width = rgba.shape[:2]
    size = (max(1, round(width * scale)), max(1, round(height * scale)))
    enlarged = cv2.resize(rgba, size, interpolation=cv2.INTER_LANCZOS4)
    image = Image.fromarray(enlarged, mode="RGBA")
    return image.filter(ImageFilter.UnsharpMask(radius=1.15, percent=110, threshold=2))


def process_image(source: Path, destination: Path, remove_text: bool, scale: float, debug_dir: Path | None) -> None:
    rgba = np.array(Image.open(source).convert("RGBA"))
    mask = detect_caption_mask(rgba) if remove_text else np.zeros(rgba.shape[:2], dtype=np.uint8)

    if remove_text and mask.any():
        # Inpaint RGB before making the caption pixels transparent. This keeps
        # anti-aliased edges clean if a browser composites the image on color.
        bgr = cv2.cvtColor(rgba[:, :, :3], cv2.COLOR_RGB2BGR)
        restored = cv2.inpaint(bgr, mask, 3, cv2.INPAINT_TELEA)
        rgba[:, :, :3] = cv2.cvtColor(restored, cv2.COLOR_BGR2RGB)
        rgba[:, :, 3][mask > 0] = 0

    if debug_dir is not None:
        debug_dir.mkdir(parents=True, exist_ok=True)
        overlay = rgba[:, :, :3].copy()
        overlay[mask > 0] = (255, 35, 90)
        Image.fromarray(overlay, mode="RGB").save(debug_dir / f"{source.stem}-mask.png")

    destination.parent.mkdir(parents=True, exist_ok=True)
    enlarged = np.array(upscale_rgba(rgba, scale).convert("RGBA"))
    # Keep RGB zeroed wherever alpha is zero so previewers cannot resurrect a
    # baked caption/background from hidden color data.
    enlarged[enlarged[:, :, 3] == 0, :3] = 0
    Image.fromarray(enlarged, mode="RGBA").save(
        destination, format="WEBP", lossless=True, exact=True, method=6
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=Path("public/pjsk-stamp/stamps"))
    parser.add_argument("--output-dir", type=Path, default=Path("public/pjsk-stamp/stamps-clean"))
    parser.add_argument("--data", type=Path, default=Path("src/data/tools/pjsk-stamp.json"))
    parser.add_argument("--scale", type=float, default=3.0)
    parser.add_argument("--start", type=int, default=0, help="Skip this many entries before processing (for previews).")
    parser.add_argument("--limit", type=int, default=0, help="Only process N entries (for previews).")
    parser.add_argument(
        "--no-text-only",
        action="store_true",
        help="Only process source stickers whose index name does not contain an embedded caption.",
    )
    parser.add_argument("--debug-dir", type=Path, default=None)
    args = parser.parse_args()

    entries = json.loads(args.data.read_text(encoding="utf-8"))
    selected = entries[args.start : args.start + args.limit] if args.limit else entries[args.start :]
    for entry in selected:
        if args.no_text_only and has_embedded_text(entry["name"]):
            continue
        relative = Path(entry["img"].removeprefix("/pjsk-stamp/stamps/").replace("/", str(Path("/"))))
        # The replace above keeps the URL-to-filesystem conversion explicit on
        # Windows while remaining portable on POSIX.
        relative = Path(*entry["img"].removeprefix("/pjsk-stamp/stamps/").split("/"))
        source = args.source_dir / relative
        destination = args.output_dir / relative
        process_image(source, destination, has_embedded_text(entry["name"]), args.scale, args.debug_dir)
        print(f"processed {entry['id']}: {destination}")


if __name__ == "__main__":
    main()

"""Remove edge-connected white mattes from the generated PJSK assets.

``process-pjsk-assets.py`` creates the high-resolution assets and removes the
embedded captions. Some source stickers still contain a baked white sticker
canvas, however. This pass works on the generated assets in-place (or into a
separate output directory) and removes only large near-white components that
touch the image edge. White artwork enclosed by dark outlines is kept. The
final WebP keeps alpha lossless while using the same compact RGB encoding as
the generation pass.

Dependencies: Pillow, numpy, and opencv-python.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


MIN_VISIBLE_ALPHA = 24
WHITE_MIN_CHANNEL = 238
WHITE_MAX_CHANNEL_SPREAD = 25
MIN_MATTE_FRACTION = 0.012
LARGE_MATTE_FRACTION = 0.03
WEBP_QUALITY = 25
WEBP_ALPHA_QUALITY = 100
WEBP_METHOD = 6

# Rin_03 contains a white bow whose upper edge is open/cropped in the source
# raster, so its fill is connected to the white canvas.  Restore the two bow
# lobes after removing the edge-connected matte; all other assets use the
# conservative connected-component rule above.
MANUAL_WHITE_FOREGROUND_POLYGONS: dict[str, tuple[tuple[tuple[int, int], ...], ...]] = {
    "Rin/Rin_03.webp": (
        (
            (54, 26),
            (105, 20),
            (190, 18),
            (211, 45),
            (215, 100),
            (211, 155),
            (220, 204),
            (190, 238),
            (132, 247),
            (78, 218),
            (53, 178),
            (45, 112),
        ),
        (
            (293, 23),
            (337, 18),
            (402, 29),
            (425, 58),
            (430, 110),
            (421, 170),
            (392, 225),
            (350, 242),
            (294, 229),
            (254, 206),
            (257, 150),
            (265, 90),
        ),
    ),
}


def edge_connected_white_matte(rgba: np.ndarray) -> np.ndarray:
    """Return a mask for large white components connected to the canvas edge.

    Connected-component analysis is deliberate here: it removes the white
    canvas while keeping enclosed white details such as bows, highlights, and
    clothing.  The conservative thresholds avoid treating pale blue or gray
    hair as a white matte.
    """

    rgb = rgba[:, :, :3]
    alpha = rgba[:, :, 3]
    height, width = alpha.shape
    low = rgb.min(axis=2)
    high = rgb.max(axis=2)
    candidate = (
        (alpha >= 8)
        & (low >= WHITE_MIN_CHANNEL)
        & ((high - low) <= WHITE_MAX_CHANNEL_SPREAD)
    ).astype(np.uint8)

    count, labels, stats, _ = cv2.connectedComponentsWithStats(candidate, 8)
    matte = np.zeros_like(alpha)
    minimum_area = max(24, int(height * width * MIN_MATTE_FRACTION))
    large_area = int(height * width * LARGE_MATTE_FRACTION)

    for index in range(1, count):
        x, y, component_width, component_height, area = stats[index]
        touches_edge = (
            x == 0
            or y == 0
            or x + component_width >= width
            or y + component_height >= height
        )
        spans_canvas = (
            component_width >= width * 0.45
            or component_height >= height * 0.45
        )
        if (
            touches_edge
            and area >= minimum_area
            and (spans_canvas or area >= large_area)
        ):
            matte[labels == index] = 255

    return matte


def repair_rgba(rgba: np.ndarray) -> tuple[np.ndarray, int]:
    """Repair one RGBA image and return it with the removed-pixel count."""

    alpha = rgba[:, :, 3].copy()
    matte = edge_connected_white_matte(rgba)
    alpha[(matte > 0) | (alpha < MIN_VISIBLE_ALPHA)] = 0

    repaired = rgba.copy()
    repaired[:, :, 3] = alpha
    # Zero RGB under transparent pixels so image viewers and later resampling
    # cannot resurrect the old white matte from hidden color data.
    repaired[alpha == 0, :3] = 0
    return repaired, int((matte > 0).sum())


def restore_manual_white_foreground(
    repaired: np.ndarray,
    original: np.ndarray,
    relative: Path,
) -> tuple[np.ndarray, int]:
    """Restore explicitly bounded white art that touches a matte component."""

    polygons = MANUAL_WHITE_FOREGROUND_POLYGONS.get(relative.as_posix())
    if not polygons:
        return repaired, 0

    restore = np.zeros(original.shape[:2], dtype=np.uint8)
    for polygon in polygons:
        cv2.fillPoly(restore, [np.asarray(polygon, dtype=np.int32)], 1)

    original_alpha = original[:, :, 3]
    selected = (restore > 0) & (original_alpha > 0)
    restored_count = int((selected & (repaired[:, :, 3] == 0)).sum())
    repaired[selected, :3] = original[selected, :3]
    repaired[selected, 3] = original_alpha[selected]
    return repaired, restored_count


def relative_asset_path(entry: dict[str, object]) -> Path:
    image_path = str(entry["img"]).removeprefix("/pjsk-stamp/stamps/")
    return Path(*image_path.split("/"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path("public/pjsk-stamp/stamps-clean"),
        help="Existing generated high-resolution assets.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Destination directory; defaults to --input-dir for an in-place repair.",
    )
    parser.add_argument(
        "--data",
        type=Path,
        default=Path("src/data/tools/pjsk-stamp.json"),
        help="PJSK asset index used to select the 739 published assets.",
    )
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    output_dir = args.output_dir or args.input_dir
    entries = json.loads(args.data.read_text(encoding="utf-8"))
    selected = entries[args.start : args.start + args.limit] if args.limit else entries[args.start :]

    repaired_count = 0
    removed_pixels = 0
    for entry in selected:
        relative = relative_asset_path(entry)
        source = args.input_dir / relative
        destination = output_dir / relative
        if not source.exists():
            raise FileNotFoundError(f"Missing PJSK asset: {source}")

        rgba = np.array(Image.open(source).convert("RGBA"))
        repaired, removed = repair_rgba(rgba)
        repaired, restored = restore_manual_white_foreground(repaired, rgba, relative)
        removed = max(0, removed - restored)
        destination.parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(repaired, mode="RGBA").save(
            destination,
            format="WEBP",
            lossless=False,
            quality=WEBP_QUALITY,
            alpha_quality=WEBP_ALPHA_QUALITY,
            exact=True,
            method=WEBP_METHOD,
        )

        if removed:
            repaired_count += 1
            removed_pixels += removed
        print(f"repaired {entry['id']}: {destination} (removed {removed} matte pixels)")

    print(
        f"completed {len(selected)} assets; "
        f"changed {repaired_count}; removed {removed_pixels} matte pixels"
    )


if __name__ == "__main__":
    main()

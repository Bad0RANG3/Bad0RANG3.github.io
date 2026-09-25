"""Convert imagegen's checkerboard preview into transparent project assets."""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFilter


def checkerboard_background(rgb: np.ndarray) -> np.ndarray:
    """Find baked checkerboard/matte pixels connected to the canvas edge."""

    hsv = cv2.cvtColor(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), cv2.COLOR_BGR2HSV)
    neutral = hsv[:, :, 1] < 18
    value = hsv[:, :, 2]
    # The generated checkerboard is usually mid-gray, while white clothing
    # and paper-like props are near-white. Keep the near-white pixels out of
    # the edge flood so a white outfit that touches the crop edge is not
    # mistaken for the matte. The isolated bright checker cells are removed
    # by the fragment pass below.
    candidate = (neutral & (value >= 70) & (value <= 235)).astype(np.uint8)
    # Keep the raw connectivity. Large close/dilate kernels can bridge a
    # checkerboard cell into a white sleeve, shirt, or other neutral prop.

    count, labels, stats, _ = cv2.connectedComponentsWithStats(candidate, 8)
    background = np.zeros(candidate.shape, dtype=np.uint8)
    height, width = candidate.shape
    for index in range(1, count):
        x, y, w, h, area = stats[index]
        touches_edge = x == 0 or y == 0 or x + w >= width or y + h >= height
        if touches_edge and area > 80:
            background[labels == index] = 255

    # Some transparent-output generations use a solid black matte instead of
    # the checkerboard. It is safe to remove only the edge-connected black
    # component; the character's dark outline is enclosed by colored pixels.
    black = (value < 22).astype(np.uint8)
    black_count, black_labels, black_stats, _ = cv2.connectedComponentsWithStats(black, 8)
    for index in range(1, black_count):
        x, y, w, h, area = black_stats[index]
        touches_edge = x == 0 or y == 0 or x + w >= width or y + h >= height
        if touches_edge and area > 80:
            background[black_labels == index] = 255

    return background


def has_large_dark_matte(rgb: np.ndarray) -> bool:
    """Detect the solid-black matte used by some image generations."""

    hsv = cv2.cvtColor(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), cv2.COLOR_BGR2HSV)
    black = (hsv[:, :, 2] < 22).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(black, 8)
    height, width = black.shape
    largest_edge_component = 0
    for index in range(1, count):
        x, y, w, h, area = stats[index]
        touches_edge = x == 0 or y == 0 or x + w >= width or y + h >= height
        if touches_edge:
            largest_edge_component = max(largest_edge_component, int(area))
    return largest_edge_component > (height * width * 0.08)


def seeded_foreground(rgb: np.ndarray) -> np.ndarray:
    """Build a foreground mask from colored/dark outlines and fill their shapes."""

    hsv = cv2.cvtColor(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), cv2.COLOR_BGR2HSV)
    seed = ((hsv[:, :, 1] >= 30) | (hsv[:, :, 2] <= 105)).astype(np.uint8)
    seed = cv2.morphologyEx(seed, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))

    count, labels, stats, _ = cv2.connectedComponentsWithStats(seed, 8)
    retained = np.zeros(seed.shape, dtype=np.uint8)
    for index in range(1, count):
        if int(stats[index, cv2.CC_STAT_AREA]) >= 20:
            retained[labels == index] = 255

    contours, _ = cv2.findContours(retained, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    foreground = np.zeros(seed.shape, dtype=np.uint8)
    cv2.drawContours(foreground, contours, -1, 255, thickness=-1)
    return cv2.dilate(foreground, np.ones((3, 3), np.uint8), iterations=1)


def remove_neutral_edge_fragments(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Remove small neutral matte fragments left outside the foreground."""

    hsv = cv2.cvtColor(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), cv2.COLOR_BGR2HSV)
    opaque = (alpha > 0).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(opaque, 8)
    height, width = opaque.shape
    for index in range(1, count):
        x, y, w, h, area = stats[index]
        touches_edge = x == 0 or y == 0 or x + w >= width or y + h >= height
        if touches_edge and 4 <= area <= 5000:
            saturation = hsv[:, :, 1][labels == index]
            if float(np.mean(saturation)) < 80:
                alpha[labels == index] = 0

    # Image generators sometimes leave isolated light checkerboard cells in
    # the interior holes of a foreground. They are not connected to the
    # canvas edge, so the edge pass above cannot identify them. Real white
    # clothing and highlights normally touch the colored/dark foreground and
    # therefore belong to its large connected component; remove only tiny,
    # neutral, disconnected fragments to avoid eating those details.
    opaque = (alpha > 0).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(opaque, 8)
    for index in range(1, count):
        area = int(stats[index, cv2.CC_STAT_AREA])
        if area > 320:
            continue
        saturation = hsv[:, :, 1][labels == index]
        value = hsv[:, :, 2][labels == index]
        if float(np.mean(saturation)) < 45 and float(np.mean(value)) >= 70:
            alpha[labels == index] = 0
    return alpha


def convert(source: Path, destination: Path) -> None:
    source_rgba = np.array(Image.open(source).convert("RGBA"))
    rgb = source_rgba[:, :, :3]
    source_alpha = source_rgba[:, :, 3]
    if np.all(source_alpha == 255):
        if has_large_dark_matte(rgb):
            background = checkerboard_background(rgb)
            alpha = np.where(background > 0, 0, 255).astype(np.uint8)
        else:
            alpha = seeded_foreground(rgb)
    else:
        # A real alpha channel is authoritative; re-segmenting it can eat
        # white clothing or other neutral artwork at the sticker edge.
        alpha = source_alpha.copy()
    alpha = remove_neutral_edge_fragments(rgb, alpha)
    rgba = np.dstack([rgb, alpha])
    # Do not leave the baked checkerboard/matte in fully transparent pixels.
    # Some previewers inspect RGB even when alpha is zero and would therefore
    # display the fake background again.
    rgba[alpha == 0, :3] = 0
    sharpened_rgb = Image.fromarray(rgba[:, :, :3], mode="RGB").filter(
        ImageFilter.UnsharpMask(radius=0.8, percent=70, threshold=2)
    )
    cleaned = np.dstack([np.array(sharpened_rgb, dtype=np.uint8), alpha])
    cleaned[alpha == 0, :3] = 0
    destination.parent.mkdir(parents=True, exist_ok=True)
    # Preserve the explicitly zeroed RGB values under transparent pixels. The
    # default WebP encoder may reuse neighbouring RGB blocks there, which can
    # make a transparent checkerboard appear as visible bars in some viewers.
    Image.fromarray(cleaned, mode="RGBA").save(
        destination, format="WEBP", lossless=True, exact=True, method=6
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    sources = sorted(args.input_dir.rglob("*.png"))
    for source in sources:
        relative = source.relative_to(args.input_dir).with_suffix(".webp")
        destination = args.output_dir / relative
        convert(source, destination)
        print(f"converted {relative}")


if __name__ == "__main__":
    main()

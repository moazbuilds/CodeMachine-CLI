#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$ROOT_DIR/out"
TEXT_FILE="$ROOT_DIR/cat.txt"
FRAMES_DIR="$OUT_DIR/frames"
VIDEO_FILE="$OUT_DIR/ascii_scene.mp4"
FPS=30
DURATION=3
TOTAL_FRAMES=$((FPS * DURATION))
WIDTH=1280
HEIGHT=720

mkdir -p "$OUT_DIR"
rm -rf "$FRAMES_DIR"
mkdir -p "$FRAMES_DIR"

if [[ ! -f "$TEXT_FILE" ]]; then
  echo "Missing ASCII text file: $TEXT_FILE" >&2
  exit 1
fi

ASCII_TEXT="$(cat "$TEXT_FILE")"

# Render ASCII text directly into image frames (no terminal capture).
for ((i=0; i<TOTAL_FRAMES; i++)); do
  # Move from x=100 to x=700 over the full duration.
  x=$((100 + (600 * i) / (TOTAL_FRAMES - 1)))
  frame_file=$(printf "%s/frame_%05d.png" "$FRAMES_DIR" "$i")

  convert -size "${WIDTH}x${HEIGHT}" xc:'#0b0f14' \
    -font DejaVu-Sans-Mono -pointsize 40 -fill '#7dd3fc' -annotate +60+90 'ASCII SCENE 01' \
    -font DejaVu-Sans-Mono -pointsize 56 -fill '#e5e7eb' -interline-spacing 12 \
    -annotate +"${x}"+330 "$ASCII_TEXT" \
    "$frame_file"
done

ffmpeg -y \
  -framerate "$FPS" -i "$FRAMES_DIR/frame_%05d.png" \
  -c:v libx264 -pix_fmt yuv420p \
  "$VIDEO_FILE"

echo "Created: $VIDEO_FILE"

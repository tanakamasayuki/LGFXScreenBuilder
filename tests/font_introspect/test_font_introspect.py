"""Font-catalog host introspection (SPEC §8.7.2, phase 1b).

Pipeline (the agreed pytest flow):
  1. gen.py resolves the pinned LovyanGFX (tools/fontgen/sketch.yaml), parses
     lgfx_fonts.hpp, and writes fonts_table.h — at module import, before the dut
     fixture builds the sketch (so a version/parse problem fails loudly here).
  2. The harness builds + runs on the lang-ship host, writing per-font metrics
     (output/metrics.jsonl) and native-size sample PNGs (output/samples/*.png).
  3. This test reads them, packs the samples into one vertical atlas, and writes
     the browser-consumable catalog: docs/src/font-metrics.json + font-atlas.png.

Metrics + previews are merged onto the name-classified catalog (font-catalog.js,
from tools/gen-fonts.mjs) by the browser at load. Per-font flash size is a
separate follow-up (needs marginal link-diff builds, not runtime introspection).
"""
import json
from pathlib import Path

from PIL import Image

import gen

SKETCH_DIR = Path(__file__).resolve().parent
DOCS_SRC = SKETCH_DIR.parents[1] / "docs" / "src"

# Regenerate the font table from the pinned header (runs at collection, before
# the sketch is built).
FONT_NAMES, LGFX_VERSION = gen.generate()


def test_font_introspect(dut):
    dut.expect("TEST start font_introspect", timeout=20)
    dut.expect("PROGRESS 0/", timeout=10)
    dut.expect(r"DONE fonts=(\d+) png=(\d+)", timeout=120)
    dut.expect("TEST done", timeout=10)

    out = SKETCH_DIR / "output"
    metrics_path = out / "metrics.jsonl"
    assert metrics_path.exists(), "harness did not write metrics.jsonl"

    rows = [json.loads(line) for line in metrics_path.read_text().splitlines() if line.strip()]
    assert len(rows) == len(FONT_NAMES), f"{len(rows)} metric rows vs {len(FONT_NAMES)} fonts"

    # Pack every sample PNG into one vertical atlas; record each font's box.
    samples_dir = out / "samples"
    images, boxes, y = {}, {}, 0
    atlas_w = 0
    for r in rows:
        png = samples_dir / f"{r['name']}.png"
        assert png.exists(), f"missing sample {png}"
        img = Image.open(png).convert("RGB")
        assert img.width > 0 and img.height > 0
        images[r["name"]] = img
        boxes[r["name"]] = (0, y, img.width, img.height)
        atlas_w = max(atlas_w, img.width)
        y += img.height
    atlas_h = y

    atlas = Image.new("RGB", (atlas_w, atlas_h), (0, 0, 0))
    rendered = 0
    for name, img in images.items():
        x, yy, w, h = boxes[name]
        atlas.paste(img, (x, yy))
        if (img.getcolors(maxcolors=100000) or []) and len(img.getcolors(maxcolors=100000)) >= 2:
            rendered += 1
    # The vast majority of fonts must have rendered actual glyphs (a handful of
    # symbol-only / degenerate fonts may legitimately come out near-blank).
    assert rendered >= int(0.9 * len(rows)), f"only {rendered}/{len(rows)} samples drew glyphs"

    DOCS_SRC.mkdir(parents=True, exist_ok=True)
    atlas.save(DOCS_SRC / "font-atlas.png")

    catalog = {
        "source": f"LovyanGFX {LGFX_VERSION}",
        "atlas": "font-atlas.png",
        "atlasW": atlas_w,
        "atlasH": atlas_h,
        "fonts": {
            r["name"]: {
                "height": r["height"],
                "baseline": r["baseline"],
                "xAdvance": r["x_advance"],
                "yAdvance": r["y_advance"],
                "ascii": r["ascii"],
                "cjk": r["cjk"],
                "sample": r["sample"],
                "box": list(boxes[r["name"]]),  # [x, y, w, h] in the atlas
            }
            for r in rows
        },
    }
    (DOCS_SRC / "font-metrics.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=0))
    print(f"wrote font-metrics.json ({len(rows)} fonts) + font-atlas.png ({atlas_w}x{atlas_h})")

"""Font-catalog host introspection (SPEC §8.7.2, phase 1b).

This is a GENERATOR, not a pass/fail regression check, so it is NOT part of the
default suite. It lives under tests/manual/ and is named `font_introspect.py`
(no `test_` prefix), so pytest's directory scan skips it — it runs only when its
path is given explicitly, which is how you (re)generate the catalog, e.g. after
bumping the pinned font library:

    uv run pytest manual/font_introspect/font_introspect.py

Pipeline:
  1. The `generated` fixture runs gen.generate(): it ensures the pinned LovyanGFX
     is downloaded (building tools/fontgen on a clean machine), parses
     lgfx_fonts.hpp, and writes fonts_table.h — before the dut fixture builds.
  2. The harness builds + runs on the lang-ship host, writing per-font metrics
     (output/metrics.jsonl) and native-size sample PNGs (output/samples/*.png).
  3. This test reads them, packs the samples into one vertical atlas, and writes
     the browser-consumable catalog: docs/src/font-metrics.json + font-atlas.png.

Per-font flash size is attributed from the linked harness ELF in the same run
(gen.font_flash_sizes). gen.py also writes the name-classified font-catalog.js.
"""
import json
from pathlib import Path

import pytest
from PIL import Image

import gen

SKETCH_DIR = Path(__file__).resolve().parent       # tests/manual/font_introspect
DOCS_SRC = SKETCH_DIR.parents[2] / "docs" / "src"  # repo root / docs / src


@pytest.fixture(scope="module")
def generated():
    """Regenerate the font table (and ensure the pinned libs are downloaded)
    before the dut fixture builds the sketch. Ordered ahead of `dut` in the test
    signature so fonts_table.h exists at build time."""
    return gen.generate()


def test_font_introspect(generated, dut):
    font_names, lgfx_version = generated
    dut.expect("TEST start font_introspect", timeout=20)
    dut.expect("PROGRESS 0/", timeout=10)
    dut.expect(r"DONE fonts=(\d+) png=(\d+)", timeout=120)
    dut.expect("TEST done", timeout=10)

    out = SKETCH_DIR / "output"
    metrics_path = out / "metrics.jsonl"
    assert metrics_path.exists(), "harness did not write metrics.jsonl"

    rows = [json.loads(line) for line in metrics_path.read_text().splitlines() if line.strip()]
    assert len(rows) == len(font_names), f"{len(rows)} metric rows vs {len(font_names)} fonts"

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

    # Exact per-font flash size from the linked harness ELF (single build).
    elfs = sorted(SKETCH_DIR.glob("build/**/*.out"))
    flash = gen.font_flash_sizes(elfs[0], font_names, lgfx_version) if elfs else {}
    if flash:
        assert all(flash.get(n, 0) > 0 for n in font_names), "some fonts got zero flash size"

    catalog = {
        "source": f"LovyanGFX {lgfx_version}",
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
                "mono": r.get("mono"),
                "letters": r.get("letters"),
                "digits": r.get("digits"),
                "latinExt": r.get("latinExt"),
                "sample": r["sample"],
                "box": list(boxes[r["name"]]),  # [x, y, w, h] in the atlas
                **({"flash": flash[r["name"]]} if flash else {}),
            }
            for r in rows
        },
    }
    (DOCS_SRC / "font-metrics.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=0))
    print(f"wrote font-metrics.json ({len(rows)} fonts, flash={'yes' if flash else 'no'}) "
          f"+ font-atlas.png ({atlas_w}x{atlas_h})")

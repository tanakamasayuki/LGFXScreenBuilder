"""Round-trip test: the authoring tool's codegen -> header -> on-device render.

The header (MyScreen.h) is regenerated from docs/src (model + codegen) at module
import, before the dut fixture builds the sketch, so a codegen regression fails
the build.
"""
import subprocess
from pathlib import Path

from PIL import Image

SKETCH_DIR = Path(__file__).parent

# Regenerate MyScreen.h from the authoring tool's codegen (runs at collection,
# before the sketch is built).
subprocess.run(["node", "gen.mjs"], cwd=SKETCH_DIR, check=True)


def test_codegen_roundtrip(dut):
    dut.expect("TEST start codegen_roundtrip", timeout=15)
    dut.expect("PANEL", timeout=5)
    dut.expect("BOOT saved=1", timeout=10)
    dut.expect("MAIN saved=1", timeout=10)
    dut.expect("SETTINGS saved=1", timeout=10)
    dut.expect("TEST done", timeout=5)

    for name in ("boot", "main", "settings"):
        png = SKETCH_DIR / "output" / f"{name}.png"
        assert png.exists(), f"missing {png}"
        img = Image.open(png).convert("RGB")
        assert img.width > 0 and img.height > 0
        colors = img.getcolors(maxcolors=100000) or []
        assert len(colors) >= 2, f"{name}.png looks blank ({len(colors)} colors)"

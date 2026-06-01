from pathlib import Path

from PIL import Image

SKETCH_DIR = Path(__file__).parent


def test_build_lovyangfx(dut):
    dut.expect("TEST start build_lovyangfx", timeout=15)
    dut.expect("PANEL", timeout=5)
    dut.expect("PNG saved=1", timeout=10)
    dut.expect("TEST done", timeout=5)

    png = SKETCH_DIR / "output" / "build_lovyangfx.png"
    assert png.exists(), f"missing {png}"
    assert png.stat().st_size > 100

    img = Image.open(png).convert("RGB")
    assert img.width > 0
    assert img.height > 0

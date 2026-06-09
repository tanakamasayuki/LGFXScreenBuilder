from pathlib import Path

from PIL import Image

SKETCH_DIR = Path(__file__).parent


def test_build_lovyangfx(dut):
    dut.expect("TEST start build_lovyangfx", timeout=15)
    dut.expect("PANEL", timeout=5)
    dut.expect("BOOT saved=1", timeout=10)
    dut.expect("PNG saved=1", timeout=10)
    dut.expect("TEST done", timeout=5)

    # Both scenes render through the generated MyScreen facade (direct mode).
    boot = SKETCH_DIR / "output" / "boot.png"
    assert boot.exists(), f"missing {boot}"
    assert boot.stat().st_size > 100

    main = SKETCH_DIR / "output" / "build_lovyangfx.png"
    assert main.exists(), f"missing {main}"
    assert main.stat().st_size > 100
    img = Image.open(main).convert("RGB")
    assert img.width > 0 and img.height > 0
    # Content actually drew: more than just the background color.
    colors = img.getcolors(maxcolors=100000) or []
    assert len(colors) >= 2, f"build_lovyangfx.png looks blank ({len(colors)} colors)"

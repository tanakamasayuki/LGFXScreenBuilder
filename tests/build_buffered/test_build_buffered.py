from pathlib import Path

from PIL import Image

SKETCH_DIR = Path(__file__).parent


def test_build_buffered(dut):
    dut.expect("TEST start build_buffered", timeout=15)
    dut.expect("PANEL", timeout=5)
    # The build included <LGFXVirtualCanvas.h>, so the render mode resolves to
    # tiled double buffering (SPEC §10): isBuffered() must be true.
    dut.expect("BUFFERED 1", timeout=5)
    dut.expect("BOOT saved=1", timeout=10)
    dut.expect("PNG saved=1", timeout=10)
    dut.expect("TEST done", timeout=5)

    boot = SKETCH_DIR / "output" / "boot.png"
    assert boot.exists(), f"missing {boot}"
    assert boot.stat().st_size > 100

    # The Main scene draws its static parts plus the overlay through the tiled
    # canvas, so the captured frame must not be blank.
    main = SKETCH_DIR / "output" / "build_buffered.png"
    assert main.exists(), f"missing {main}"
    assert main.stat().st_size > 100
    img = Image.open(main).convert("RGB")
    assert img.width > 0 and img.height > 0
    colors = img.getcolors(maxcolors=100000) or []
    assert len(colors) >= 2, f"build_buffered.png looks blank ({len(colors)} colors)"

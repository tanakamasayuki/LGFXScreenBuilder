from pathlib import Path

from PIL import Image

SKETCH_DIR = Path(__file__).parent


def test_build_lovyangfx(dut):
    dut.expect("TEST start build_lovyangfx", timeout=15)
    dut.expect("PANEL", timeout=5)
    dut.expect("BOOT saved=1", timeout=10)
    dut.expect("PNG saved=1", timeout=10)
    # Direct drawing needs nothing extra for a transparent scene (§8.16).
    dut.expect("TRANSPARENT 1", timeout=5)
    dut.expect("DIALOG saved=1", timeout=10)
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

    # Transparent scene over the Main frame: drawn, and the frame underneath kept.
    dialog_png = SKETCH_DIR / "output" / "dialog.png"
    assert dialog_png.exists(), f"missing {dialog_png}"
    dialog = Image.open(dialog_png).convert("RGB")
    assert dialog.size == img.size
    center = (img.width // 2, img.height // 2)
    assert dialog.getpixel(center) != img.getpixel(center), (
        "the transparent scene drew nothing"
    )
    for probe in ((30, 190), (300, 190), (30, 20)):
        if probe[0] < img.width and probe[1] < img.height:
            assert dialog.getpixel(probe) == img.getpixel(probe), (
                f"pixel {probe} changed - a transparent scene must not fill the background"
            )

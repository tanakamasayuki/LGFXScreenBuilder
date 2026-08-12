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
    # LGFXVirtualCanvas 1.4.0 is pinned, so the transparent path is live.
    dut.expect("TRANSPARENT 1", timeout=5)
    dut.expect("DIALOG saved=1", timeout=10)
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

    # Transparent scene (§8.16). The Dialog scene has no background of its own:
    # it is pushed over the Main frame with the color key masked out.
    dialog_png = SKETCH_DIR / "output" / "dialog.png"
    assert dialog_png.exists(), f"missing {dialog_png}"
    dialog = Image.open(dialog_png).convert("RGB")
    assert dialog.size == img.size

    # The dialog itself landed: the center of the panel changed.
    center = (img.width // 2, img.height // 2)
    assert dialog.getpixel(center) != img.getpixel(center), (
        "dialog.png is identical to build_buffered.png at the center - "
        "the transparent scene drew nothing"
    )

    # ...and the screen underneath SURVIVED. Every pixel outside the dialog's
    # bounding box must be exactly what Main left there; a plain (opaque) render
    # would have wiped it to the project background instead.
    #
    # Dialog box for the 320x240 Core profile: x 60..266, y 70..176 (box plus its
    # offset shadow). Sampled generously outside that, but inside Main's `panel`
    # rect so the comparison is against real content and not just black.
    for probe in ((30, 190), (300, 190), (30, 20)):
        if probe[0] < img.width and probe[1] < img.height:
            assert dialog.getpixel(probe) == img.getpixel(probe), (
                f"pixel {probe} changed under a transparent scene - the "
                "background was overwritten instead of masked"
            )

    # The color key must never reach the panel: it is the one color the masked
    # push drops. RGB565 0x0120 == RGB888 (0, 36, 0) (SPEC §8.16).
    assert (0, 36, 0) not in [c for _, c in (dialog.getcolors(maxcolors=100000) or [])], (
        "the transparent color key was transferred to the panel"
    )

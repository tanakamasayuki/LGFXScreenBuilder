from pathlib import Path

from PIL import Image

SKETCH_DIR = Path(__file__).parent


def test_build_fontgen(dut):
    """A generated embedded font (SPEC 8.7.7) compiles and draws on real LovyanGFX."""
    dut.expect("TEST start build_fontgen", timeout=15)
    dut.expect("PANEL", timeout=5)

    # The size field is a CHARACTER height and the line box is derived from the
    # glyphs the font ended up with. LovyanGFX must read back exactly the line
    # box the generator recorded - if these ever disagree, text is mispositioned
    # on every screen using the font.
    dut.expect("HEIGHT 26", timeout=5)

    # Advances are real, and the degree string is wider than nothing.
    width_ascii = int(dut.expect(r"WIDTH_ASCII (\d+)", timeout=5).group(1))
    assert 10 < width_ascii < 200, f"implausible textWidth for 'Hello': {width_ascii}"
    width_degree = int(dut.expect(r"WIDTH_DEGREE (\d+)", timeout=5).group(1))
    assert width_degree > 0

    # Ink coverage: a glyph that failed to decode draws nothing at all.
    ink_ascii = int(dut.expect(r"INK_ASCII (\d+)", timeout=5).group(1))
    assert ink_ascii > 50, f"ASCII text drew almost nothing ({ink_ascii} px)"

    # U+2103 is why the "units" preset exists - Roboto has it and it must survive
    # the whole pipeline (rasterize -> u8g2 encode -> LovyanGFX decode).
    ink_celsius = int(dut.expect(r"INK_CELSIUS (\d+)", timeout=5).group(1))
    assert ink_celsius > 5, f"U+2103 did not draw ({ink_celsius} px)"

    # Regression guard for the presence check: plain bars look alike in most
    # faces, and an earlier detection scheme dropped them from the font.
    ink_bar = int(dut.expect(r"INK_BAR (\d+)", timeout=5).group(1))
    assert ink_bar > 10, f"'Il1' did not draw ({ink_bar} px)"

    dut.expect("PNG saved=1", timeout=10)
    dut.expect("TEST done", timeout=5)

    png = SKETCH_DIR / "output" / "fontgen.png"
    assert png.exists(), f"missing {png}"
    img = Image.open(png).convert("RGB")
    colors = img.getcolors(maxcolors=100000) or []
    assert len(colors) >= 2, f"fontgen.png looks blank ({len(colors)} colors)"

import os
from pathlib import Path

import pytest
from PIL import Image


SKETCH_DIR = Path(__file__).parent
HEADER = SKETCH_DIR / "GeneratedScreen.h"
pytestmark = pytest.mark.skipif(
    not HEADER.exists() and not os.environ.get("LGFX_FONT_TOOL_E2E"),
    reason="browser-generated project header is not present",
)


def test_browser_generated_project_font_renders(request):
    """LGFXFontToolJs output embedded by the editor draws through Screen."""
    if not HEADER.exists():
        if os.environ.get("LGFX_FONT_TOOL_E2E"):
            pytest.fail("browser E2E did not produce GeneratedScreen.h")
        pytest.skip("run tests/fontgen/editor_integration.mjs with LGFX_FONT_TOOL_E2E_HEADER first")

    source = HEADER.read_text(encoding="utf-8")
    assert "lgfx-font-tool 1.0.0" in source
    assert "static const uint8_t kFontData_PanelFont[" in source
    assert "lgfx::U8g2font kFont_PanelFont" in source
    assert "&kFont_PanelFont" in source

    # Resolve the expensive compile/run fixture only after the generated input
    # is known to exist, keeping local targeted pytest runs conveniently skippable.
    dut = request.getfixturevalue("dut")
    dut.expect("TEST start build_font_project_e2e", timeout=15)

    actual = dut.expect(r"ACTUAL ink=(\d+) hash=([0-9a-f]+) height=(\d+) width=(\d+)", timeout=10)
    actual_ink, actual_hash, height, width = actual.groups()
    actual_ink, height, width = map(int, (actual_ink, height, width))
    assert actual_ink > 80, f"embedded project font drew too little ink: {actual_ink}"
    assert 10 < height < 100
    assert 20 < width < 300

    dut.expect("PNG saved=1", timeout=10)
    celsius = dut.expect(r"CELSIUS ink=(\d+) hash=([0-9a-f]+)", timeout=5)
    celsius_ink, celsius_hash = int(celsius.group(1)), celsius.group(2)
    assert celsius_ink > 5, "fallback-sourced ℃ did not draw"

    missing = dut.expect(r"MISSING ink=(\d+) hash=([0-9a-f]+)", timeout=5)
    missing_ink, missing_hash = int(missing.group(1)), missing.group(2)
    assert missing_ink > 0, "LovyanGFX missing-glyph box did not draw"
    assert celsius_hash != missing_hash, "℃ rendered exactly like the missing-glyph box"
    assert celsius_ink != missing_ink, "℃ has the same ink count as the missing-glyph box"

    bars = dut.expect(r"BARS ink=(\d+) hash=([0-9a-f]+)", timeout=5)
    assert int(bars.group(1)) > 10, "embedded Il1 glyphs did not draw"
    assert bars.group(2) not in {actual_hash, celsius_hash, missing_hash}
    dut.expect("VERSION 1.0.0", timeout=5)
    dut.expect("TEST done", timeout=5)

    png = SKETCH_DIR / "output" / "project-font.png"
    assert png.exists()
    image = Image.open(png).convert("RGB")
    colors = image.getcolors(maxcolors=100000) or []
    assert len(colors) >= 3, f"project-font.png lacks expected screen/text colors ({len(colors)})"

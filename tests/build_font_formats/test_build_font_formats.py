"""Every generated-font output format compiles, loads, and draws (SPEC 8.7.7)."""

from pathlib import Path

import pytest

# FormatsScreen.h is generated (deterministically, no browser) by gen.mjs rather
# than committed, so it can never drift from the codegen it is meant to test.
HEADER = Path(__file__).parent / "FormatsScreen.h"
pytestmark = pytest.mark.skipif(
    not HEADER.exists(),
    reason="run `node tests/build_font_formats/gen.mjs` first",
)


def _rows(dut):
    got = {}
    for _ in range(5):
        m = dut.expect(r"ROW (\w+) ink=(\d+) shades=(\d+) ming=(\d+)", timeout=10)
        got[m.group(1).decode()] = tuple(int(m.group(i)) for i in (2, 3, 4))
    return got


def test_build_font_formats(dut):
    dut.expect("TEST start build_font_formats", timeout=15)

    # begin() is what parses the run-time fonts. It also leaves the base colour
    # the anti-aliasing blends toward, so this doubles as proof the hook ran.
    base = dut.expect(r"BASECOLOR ([0-9a-f]{6})", timeout=5).group(1).decode()
    assert base == "1e2a30", f"Screen::begin() did not set the scene base colour (got {base})"

    bg_green = int(dut.expect(r"BG [0-9a-f]{6} bgGreen=(\d+)", timeout=5).group(1))
    rows = _rows(dut)
    dut.expect("TEST done", timeout=5)

    assert set(rows) == {"u8g2", "gfx", "bff2", "bff4", "vlw8"}

    # 1. Every format drew something. A run-time font that failed to load falls
    #    back to the default face, which still draws - so ink alone is not
    #    enough, which is what the shade counts below are for.
    for name, (ink, _, _) in rows.items():
        assert ink > 40, f"{name} drew almost nothing ({ink} px)"

    # 2. The 1bpp formats are binary; the anti-aliased ones are not. This is the
    #    only check that distinguishes "BFF loaded" from "BFF silently fell back
    #    to the 1bpp default font".
    for name in ("u8g2", "gfx"):
        assert rows[name][1] == 2, f"{name} is 1bpp but drew {rows[name][1]} shades"
    for name in ("bff2", "bff4", "vlw8"):
        assert rows[name][1] > 2, f"{name} is anti-aliased but drew only {rows[name][1]} shades"

    # Depth ordering: more bits must not resolve to fewer levels.
    assert rows["bff4"][1] >= rows["bff2"][1]

    # 3. No dark halo: nothing may be darker than the background it sits on.
    #
    #    Only bff4 can actually fail this, and the two reasons are worth knowing
    #    before "strengthening" it. VLW reads the framebuffer back and blends
    #    against the real pixels whenever the panel is readable - which the host
    #    backend is - so it is immune here and only needs the base colour on the
    #    unreadable SPI panels this test cannot emulate. And 2bpp's lowest
    #    non-zero coverage is already 1/3, too strong to dip below the
    #    background. Removing Renderer.h's setBaseColor() call drops bff4's
    #    minimum from 10 to 8 and leaves every other row untouched; that is the
    #    regression this guards.
    for name, (_, _, ming) in rows.items():
        assert ming >= bg_green, (
            f"{name} drew pixels darker than the background "
            f"(green {ming} < {bg_green}) - anti-aliasing is blending toward the "
            f"wrong colour; check setBaseColor() in Renderer.h"
        )

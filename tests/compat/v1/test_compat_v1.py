"""Backward-compat render golden (SPEC §9.2, Layer 3) for frozen format v1.

Renders every profile x scene of the frozen v1 reference on the host LovyanGFX
backend and pixel-compares each capture against the frozen PNG in render/.

A successful structural migration / matching .h (tools/check-compat.mjs) does not
prove the *rendered* result is unchanged, so the pixels are the final oracle. A
diff is either an intended change (refreeze render/) or a regression (fix). The
render engine is pinned in sketch.yaml; on an engine bump the goldens are
deliberately refrozen.

Bootstrap: if a reference is missing (first run), the capture is copied into
render/ and the test passes with a printed notice. Commit render/ so later runs
compare strictly.
"""

import shutil
from pathlib import Path

from PIL import Image, ImageChops

SKETCH_DIR = Path(__file__).parent
OUTPUT_DIR = SKETCH_DIR / "output"
RENDER_DIR = SKETCH_DIR / "render"

# profile x scene names as defined in CompatV1.lgfxsb.json.
PROFILES = ["Core", "Stick", "CoreRot"]
SCENES = ["Boot", "Showcase"]


def _diff(a: Image.Image, b: Image.Image):
    """Return (changed: bool, detail: str) for two images (pixel-exact)."""
    if a.size != b.size:
        return True, f"size {a.size} != {b.size}"
    diff = ImageChops.difference(a.convert("RGB"), b.convert("RGB"))
    bbox = diff.getbbox()  # None when identical
    return (bbox is not None), (f"differs in region {bbox}" if bbox else "")


def test_compat_v1_render(dut):
    dut.expect("TEST start compat_v1", timeout=20)
    for prof in PROFILES:
        for scene in SCENES:
            dut.expect(f"CAP output/{prof}_{scene}.png", timeout=15)
    dut.expect("TEST done compat_v1", timeout=10)

    RENDER_DIR.mkdir(exist_ok=True)
    bootstrapped = []
    mismatches = []
    for prof in PROFILES:
        for scene in SCENES:
            name = f"{prof}_{scene}.png"
            cap = OUTPUT_DIR / name
            assert cap.exists() and cap.stat().st_size > 100, f"capture missing/empty: {name}"

            ref = RENDER_DIR / name
            if not ref.exists():
                shutil.copyfile(cap, ref)
                bootstrapped.append(name)
                continue

            changed, detail = _diff(Image.open(cap), Image.open(ref))
            if changed:
                mismatches.append(f"{name}: {detail}")

    if bootstrapped:
        print(
            "bootstrapped frozen render goldens (commit tests/compat/v1/render/): "
            + ", ".join(bootstrapped)
        )
    assert not mismatches, (
        "v1 render goldens differ from frozen references:\n  "
        + "\n  ".join(mismatches)
        + "\nIf intended, refreeze by deleting the listed render/*.png and rerunning; "
        "if a regression, fix the cause (SPEC §9.2)."
    )

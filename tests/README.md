# Tests

This directory contains the project-specific pytest/Arduino CLI test suite.

The initial tests are intentionally small:

- build the library against the `lang-ship:host` LovyanGFX backend;
- render a generated scene-shaped data object;
- save a host-side PNG through `LovyanGFX::createPng()`.

As the runtime and generator mature, add snapshot and pixel-diff tests here, following the same pattern used by `LGFXVirtualCanvas`.

## Run

```sh
uv run pytest -v
```

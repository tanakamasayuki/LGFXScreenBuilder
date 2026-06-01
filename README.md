# LGFXScreenBuilder

> Japanese: [README.ja.md](README.ja.md)

LGFXScreenBuilder is an Arduino UI authoring and generated-runtime project for LovyanGFX and M5GFX.

The goal is to design screens in a browser-based authoring tool, export generated Arduino data, and render the result from a small typed API.

Project status: early specification and scaffolding.

## Authoring Tool

GitHub Pages:

```text
https://tanakamasayuki.github.io/LGFXScreenBuilder/
```

Local preview:

```sh
python -m http.server 8000 --directory docs
```

Then open:

```text
http://localhost:8000/
```

Pages is served from the `docs/` directory on the `main` branch. Use relative paths such as `./app.js` and `./styles.css` so the app works both locally and under the GitHub Pages project path.

## Arduino API Direction

The preferred generated API avoids string IDs in normal user code.

```cpp
screen.show(Scene::Boot{});

Scene::Main main;
main.header.title = "Main";
main.header.battery = 82;
main.body.temperature = "24.5C";

screen.show(main);
```

See [SPEC.ja.md](SPEC.ja.md) for the current Japanese specification. An English `SPEC.md` will be added after the Japanese specification is stabilized.

## Tests

The initial test scaffold uses pytest, Arduino CLI, and the `lang-ship:host` LovyanGFX backend.

```sh
cd tests
uv run pytest -v
```

## Release

Release automation is provided by:

```text
.github/workflows/release.yml
tools/bump_version.py
```

The release workflow is copied from the shared Arduino library release toolkit and should remain common with other libraries unless the toolkit itself is updated.

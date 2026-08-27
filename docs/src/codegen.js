// Code generation: project model -> "<Project>.h" (the §11 facade + the
// lgfxsb::Project descriptor consumed by the shared engine). Pure module (no
// DOM), so it also runs under Node for round-trip tests.
//
// Output shape matches examples/Basic/MyScreen.h. Generated-code comments are
// English-only per SPEC §10/§13.
import {
  sceneById, placement, DATUMS, profileFonts, isCustomFont,
  isTransparentScene, hasTransparentScene, transparentColorOf,
} from './model.js';
import { buildAiLayout, AI_LAYOUT_DOC_URL } from './ailayout.js';
import { FORMAT_VERSION } from './version.js';
// GFXfont is emitted as C structs rather than an opaque blob, so the container
// the encoder returns has to be taken apart here.
import { unpackGfxContainer } from 'lgfx-font-tool';

const PART_ENUM = { Rect: 'Rect', Line: 'Line', Circle: 'Circle', Text: 'Text', Image: 'Image' };
// Authoring datum code (TL…BR) -> lgfxsb::Datum member name. The C++ names are
// spelled out because short tokens like MR collide with platform macros (ESP32
// xtensa defines `MR`); see src/lgfxsb/Types.h.
const DATUM_ENUM = {
  TL: 'TopLeft', TC: 'TopCenter', TR: 'TopRight',
  ML: 'MidLeft', MC: 'MidCenter', MR: 'MidRight',
  BL: 'BottomLeft', BC: 'BottomCenter', BR: 'BottomRight',
};
// Attribution for a generated font's glyph data. OFL-1.1 and Apache-2.0 both
// require the notice to travel with derived font data, and the emitted array
// IS derived font data — so it goes into the header, not just the UI.
function fontNotice(fd) {
  // A font may be composed from several typefaces (§8.7.7 fallback fills in the
  // characters the chosen one lacks), and is then a derived work of every one
  // of them — so each gets its own entry.
  const list = (fd.sources && fd.sources.length) ? fd.sources : [fd.source || {}];
  const out = [];
  list.forEach((src, i) => {
    out.push(i === 0
      ? `Rasterized from: ${src.family || '(unknown typeface)'}`
      : `Filled in from: ${src.family} (${src.count} characters${src.chars ? ': ' + src.chars.slice(0, 30) : ''})`);
    if (src.by) out.push(`  Author: ${src.by}`);
    out.push(src.license
      ? `  License: ${src.license.name || src.license.id}${src.license.url ? ` — ${src.license.url}` : ''}`
      : '  License: UNKNOWN (local file) — confirm that embedding and redistribution are permitted.');
    if (src.origin) out.push(`  Source: ${src.origin}`);
  });
  return out.join('\n');
}

// One `static const uint8_t name[N] = {...}` table, 16 bytes to a line.
function byteArray(ident, data) {
  let out = `static const uint8_t ${ident}[${data.length}] = {\n`;
  for (let i = 0; i < data.length; i += 16) {
    out += '  ' + Array.from(data.slice(i, i + 16), (b) => '0x' + b.toString(16).padStart(2, '0')).join(', ') +
      (i + 16 < data.length ? ',' : '') + '\n';
  }
  return out + '};\n';
}

// GFXfont, as the structs LovyanGFX expects. A font whose codepoints form one
// contiguous run is plain Adafruit-GFX compatible; a scattered one (any CJK set)
// needs LovyanGFX's EncodeRange extension, which is why the type differs.
function emitGfxFont(n, fd) {
  const gfx = unpackGfxContainer(fd.data);
  const ranged = gfx.ranges.length > 0;
  let out = byteArray(`kFontBitmaps_${n}`, gfx.bitmap);
  const glyphType = ranged ? 'lgfx::v1::GFXglyph' : 'GFXglyph';
  out += `static const ${glyphType} kFontGlyphs_${n}[] = {\n`;
  gfx.glyphs.forEach((g, i) => {
    out += `  { ${g.bitmapOffset}, ${g.width}, ${g.height}, ${g.xAdvance}, ${g.xOffset}, ${g.yOffset} }` +
      (i + 1 < gfx.glyphs.length ? ',' : '') + '\n';
  });
  out += '};\n';
  if (!ranged) {
    out += `static const GFXfont kFont_${n} = {\n`;
    out += `  (uint8_t*)kFontBitmaps_${n},\n  (GFXglyph*)kFontGlyphs_${n},\n`;
    out += `  0x${gfx.first.toString(16)}, 0x${gfx.last.toString(16)}, ${gfx.yAdvance} };\n\n`;
    return out;
  }
  out += `// ${gfx.ranges.length} EncodeRange entries: GFXfont indexes glyphs by offset\n`;
  out += `// within a range, so a scattered character set needs one per contiguous run.\n`;
  out += `static const lgfx::v1::EncodeRange kFontRanges_${n}[] = {\n`;
  gfx.ranges.forEach((r, i) => {
    out += `  { 0x${r.start.toString(16)}, 0x${r.end.toString(16)}, 0x${r.base.toString(16)} }` +
      (i + 1 < gfx.ranges.length ? ',' : '') + '\n';
  });
  out += '};\n';
  out += `static const lgfx::v1::GFXfont kFont_${n} = {\n`;
  out += `  (uint8_t*)kFontBitmaps_${n},\n  (lgfx::v1::GFXglyph*)kFontGlyphs_${n},\n`;
  out += `  0x${gfx.first.toString(16)}, 0x${gfx.last.toString(16)}, ${gfx.yAdvance},\n`;
  out += `  ${gfx.ranges.length}, (lgfx::v1::EncodeRange*)kFontRanges_${n} };\n\n`;
  return out;
}

const hex = (css) => '0x' + (css || '#000000').replace('#', '').padStart(6, '0').toLowerCase();
const cstr = (s) => '"' + String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';

// Flatten all scenes' parts into one indexed list (matches descriptor layout).
function flatten(project) {
  const flat = []; // { sceneId, part, gi }
  const sceneRange = {}; // sceneId -> {start,count}
  for (const sc of project.scenes) {
    const start = flat.length;
    for (const p of sc.parts) flat.push({ sceneId: sc.id, part: p, gi: flat.length });
    sceneRange[sc.id] = { start, count: sc.parts.length };
  }
  return { flat, sceneRange };
}

// Build the typed scene struct body (Text -> const char* field).
// The field default is null ("unset"): the renderer then draws the per-profile
// design text (§8.7), so a fixed label can differ per device. Assigning the
// field overrides it (one runtime value across all profiles).
function structBody(scene, indent, defProfile) {
  const pad = '  '.repeat(indent);
  let out = '';
  for (const p of scene.parts) {
    if (p.type === 'Text') {
      const lo = placement(defProfile, scene.id, p.id);
      const hint = lo && lo.text ? `  // design: ${String(lo.text).replace(/\s+/g, ' ').slice(0, 40)}` : '';
      out += `${pad}const char* ${p.id} = nullptr;${hint}\n`;
    }
  }
  return out;
}

// opts (all optional):
//   profiles  [ids to include] — when given, the enum and all descriptor tables
//             are restricted to it (§10)
//   fontData  Map name -> { data, stats, source, charset } for generated custom
//             fonts (§8.7.7). Built by docs/src/fontgen/build.js; absent under
//             Node round-trip tests, where projects have no custom fonts.
export function generateHeader(project, opts = {}) {
  const name = project.name;
  const { flat, sceneRange } = flatten(project);
  const profiles = (opts.profiles && opts.profiles.length)
    ? project.profiles.filter((p) => opts.profiles.includes(p.id))
    : project.profiles;
  const defProfile = profiles[0];

  let s = '';
  s += `#pragma once\n\n`;
  const stamp = `formatVersion ${FORMAT_VERSION}` + (opts.libraryVersion ? `, library v${opts.libraryVersion}` : '');
  s += `// Generated by LGFXScreenBuilder (${stamp}). Do not edit by hand.\n`;
  s += `// Include <LovyanGFX.hpp> (or M5GFX) and <LGFXScreenBuilder.h> before this header.\n\n`;
  s += `namespace ${name} {\n\n`;

  // Profile enum
  s += `enum class Profile : uint8_t { Auto = 0, ${profiles.map((p) => p.id).join(', ')} };\n\n`;

  // Scene structs
  s += `namespace Scene {\n`;
  project.scenes.forEach((sc, i) => {
    if (isTransparentScene(sc)) {
      s += `  // Transparent scene: drawn ON TOP of whatever is on the panel (no background\n`;
      s += `  // fill). Show the screen underneath again to dismiss it.\n`;
    }
    s += `  struct ${sc.id} {\n    static constexpr lgfxsb::SceneId id = ${i};\n`;
    s += structBody(sc, 2, defProfile);
    s += `  };\n`;
  });
  s += `}\n\n`;

  // detail: parts / scenes / layouts / profiles
  s += `namespace detail {\n\n`;

  // Generated custom fonts (§8.7.7): the glyph bytes live in this header, so
  // the sketch needs no font files. Only fonts enabled on an exported profile
  // are emitted — the same flash policy that keeps preset fonts from linking
  // where they are not used (§8.7.4).
  //
  // u8g2 and GFXfont become `const` objects the layout table points straight at.
  // BFF and VLW cannot: LovyanGFX parses their tables at run time, so they get a
  // font object plus a wrapper over the byte array, loaded once by begin().
  const fontData = opts.fontData || new Map();
  const usedCustom = [...new Set(profiles.flatMap((pr) => profileFonts(project, pr.id)))]
    .filter((n) => isCustomFont(project, n))
    .sort();
  const emittedFonts = new Set();
  const runtimeFonts = [];
  for (const n of usedCustom) {
    const fd = fontData.get(n);
    if (!fd) {
      // Silently dropping a font would produce a header that compiles and then
      // draws in the wrong face, so say so where the user will see it.
      s += `// WARNING: custom font "${n}" was not generated (its recipe could not be rebuilt).\n`;
      s += `//          Text using it falls back to the default font.\n\n`;
      continue;
    }
    const fmt = fd.format || 'u8g2';
    const depth = fmt === 'bff' ? `${fd.bpp || 1}bpp` : fmt === 'vlw' ? '8bpp' : '1bpp';
    s += `// --- ${n}: ${fd.stats.glyphCount} glyphs, ${fd.stats.height}px, ` +
      `${fd.data.length} bytes, ${fmt} ${depth}\n`;
    s += `// ${fontNotice(fd).split('\n').join('\n// ')}\n`;
    if (fmt === 'gfx') {
      s += emitGfxFont(n, fd);
    } else {
      s += byteArray(`kFontData_${n}`, fd.data);
      if (fmt === 'u8g2') {
        s += `static const lgfx::U8g2font kFont_${n}(kFontData_${n});\n\n`;
      } else {
        // The wrapper is what the font reads glyph bytes through at DRAW time
        // (RunTimeFont::_fontData), so it has to outlive every draw, not just
        // the load. Both are file-scope statics for exactly that reason.
        const type = fmt === 'bff' ? 'BFFfont' : 'VLWfont';
        if (fmt === 'bff') {
          s += `// BFF needs LovyanGFX 1.2.21+ / M5GFX 0.2.21+ (earlier versions have no BFFfont).\n`;
        }
        s += `static lgfx::v1::PointerWrapper kFontWrap_${n};\n`;
        s += `static lgfx::v1::${type} kFont_${n};\n\n`;
        runtimeFonts.push(n);
      }
    }
    emittedFonts.add(n);
  }

  if (runtimeFonts.length) {
    s += `// Parses the tables of every run-time font above. Idempotent, and called\n`;
    s += `// from Screen::begin() — until it runs, those fonts have no glyphs and the\n`;
    s += `// renderer draws their Text in the default font instead (§8.7.7).\n`;
    s += `inline void initRuntimeFonts() {\n`;
    s += `  static bool done = false;\n`;
    s += `  if (done) return;\n`;
    s += `  done = true;\n`;
    runtimeFonts.forEach((n) => {
      s += `  kFontWrap_${n}.set(kFontData_${n});\n`;
      s += `  kFont_${n}.loadFont(&kFontWrap_${n});\n`;
    });
    s += `}\n\n`;
  }

  s += `static const lgfxsb::PartDesc kParts[] = {\n`;
  const assetIndexOf = (id) => (project.assets || []).findIndex((a) => a.id === id);
  flat.forEach((f) => {
    const p = f.part;
    // Text content lives per-profile in kLayouts (§8.7); PartDesc is geometry-free.
    const ai = (p.type === 'Image' && p.asset) ? assetIndexOf(p.asset) : -1;
    s += `  {${cstr(p.id)}, lgfxsb::PartType::${PART_ENUM[p.type]}, ${ai}},  // ${f.gi} ${f.sceneId}.${p.id}\n`;
  });
  s += `};\nstatic constexpr uint16_t kPartCount = ${flat.length};\n\n`;

  // A transparent scene appends the flag; opaque scenes stay at the four legacy
  // fields so a project without one generates byte-identical output to before
  // (§8.16). SceneDesc::transparent defaults to false for the omitted case.
  s += `static const lgfxsb::SceneDesc kScenes[] = {\n`;
  project.scenes.forEach((sc, i) => {
    const r = sceneRange[sc.id];
    const transp = isTransparentScene(sc) ? ', true' : '';
    s += `  {${i}, ${cstr(sc.id)}, ${r.start}, ${r.count}${transp}},\n`;
  });
  s += `};\n\n`;

  // layouts [profile][part]
  s += `// {x, y, w, h, x2, y2, r, datum, size, color, fill, visible, font, text}\n`;
  s += `static const lgfxsb::PartLayout kLayouts[] = {\n`;
  profiles.forEach((pr) => {
    // Only fonts enabled for this profile may be referenced — that is the
    // per-profile flash policy (§8.7.4): a font links only where it is used.
    const enabled = new Set(profileFonts(project, pr.id));
    s += `  // ---- Profile: ${pr.id} ${pr.w}x${pr.h} rot${pr.rotation} ----\n`;
    flat.forEach((f) => {
      const e = placement(pr, f.sceneId, f.part.id) || {};
      const isText = f.part.type === 'Text';
      const x = e.x || 0, y = e.y || 0;
      const w = (isText || f.part.type === 'Line' || f.part.type === 'Circle') ? 0 : (e.w || 0);
      const h = (isText || f.part.type === 'Line' || f.part.type === 'Circle') ? 0 : (e.h || 0);
      const x2 = f.part.type === 'Line' ? (e.x2 || 0) : 0;
      const y2 = f.part.type === 'Line' ? (e.y2 || 0) : 0;
      const r = (f.part.type === 'Rect' || f.part.type === 'Circle') ? (e.r || 0) : 0;
      const datum = isText ? `(uint8_t)lgfxsb::Datum::${DATUM_ENUM[e.datum] || 'TopLeft'}` : '0';
      const size = isText ? (e.size || 1) : 0;
      const color = (f.part.type === 'Image') ? '0' : hex(e.color);
      const fill = ((f.part.type === 'Rect' || f.part.type === 'Circle') && e.fill === false) ? 'false' : 'true';
      const vis = (e.visible === false) ? 'false' : 'true';
      // A custom font resolves to the array emitted above; a preset resolves to
      // the library symbol. Either way it must be enabled on this profile.
      const font = !(isText && e.font && enabled.has(e.font)) ? 'nullptr'
        : isCustomFont(project, e.font) ? (emittedFonts.has(e.font) ? `&kFont_${e.font}` : 'nullptr')
        : `&lgfx::v1::fonts::${e.font}`;
      const text = isText ? cstr(e.text || '') : 'nullptr';
      s += `  {${x}, ${y}, ${w}, ${h}, ${x2}, ${y2}, ${r}, ${datum}, ${fmtFloat(size)}, ${color}, ${fill}, ${vis}, ${font}, ${text}},  // ${f.sceneId}.${f.part.id}\n`;
    });
  });
  s += `};\n\n`;

  s += `static const lgfxsb::ProfileDesc kProfiles[] = {\n`;
  profiles.forEach((pr) => {
    s += `  {${pr.w}, ${pr.h}, ${pr.rotation}},\n`;
  });
  s += `};\n\n`;

  // Optional test/capture metadata. These tables are not referenced by the
  // renderer, so ordinary sketches do not need to keep them in flash.
  s += `struct ProfileInfo {\n`;
  s += `  const char* name;\n`;
  s += `  uint8_t index;\n`;
  s += `  int16_t w, h;\n`;
  s += `  uint8_t rotation;\n`;
  s += `};\n\n`;
  s += `struct SceneInfo {\n`;
  s += `  const char* name;\n`;
  s += `  lgfxsb::SceneId id;\n`;
  s += `  uint16_t index;\n`;
  s += `};\n\n`;
  s += `static constexpr ProfileInfo kProfileInfo[] = {\n`;
  profiles.forEach((pr, i) => {
    s += `  {${cstr(pr.id)}, ${i}, ${pr.w}, ${pr.h}, ${pr.rotation}},\n`;
  });
  s += `};\n`;
  s += `static constexpr uint8_t kProfileInfoCount = ${profiles.length};\n\n`;
  s += `static constexpr SceneInfo kSceneInfo[] = {\n`;
  project.scenes.forEach((sc, i) => {
    s += `  {${cstr(sc.id)}, Scene::${sc.id}::id, ${i}},\n`;
  });
  s += `};\n`;
  s += `static constexpr uint16_t kSceneInfoCount = ${project.scenes.length};\n\n`;

  // Image assets: RGB565 pixel arrays + descriptor table (§8.4). const goes to
  // flash on ESP32, so PROGMEM is not required.
  const assets = project.assets || [];
  assets.forEach((a) => {
    const px = (a.rgb565 || []).map((v) => '0x' + (v & 0xFFFF).toString(16).padStart(4, '0')).join(', ');
    s += `static const uint16_t kAsset_${a.id}[] = { ${px} };  // ${a.w}x${a.h}\n`;
  });
  if (assets.length) {
    s += `static const lgfxsb::AssetDesc kAssets[] = {\n`;
    assets.forEach((a) => { s += `  { kAsset_${a.id}, ${a.w}, ${a.h} },\n`; });
    s += `};\n`;
  }
  s += `\n} // namespace detail\n\n`;

  // Project descriptor
  s += `static const lgfxsb::Project project = {\n`;
  s += `  detail::kProfiles, ${profiles.length},\n`;
  s += `  detail::kScenes, ${project.scenes.length},\n`;
  s += `  detail::kParts, detail::kPartCount,\n`;
  s += `  detail::kLayouts,\n`;
  s += `  /*background*/ ${hex(project.background)},\n`;
  s += assets.length ? `  detail::kAssets, ${assets.length},\n` : `  nullptr, 0,\n`;
  // Color key, emitted only when a scene actually needs it; otherwise the
  // descriptor keeps its legacy shape and Project::transparentColor defaults.
  if (hasTransparentScene(project)) {
    s += `  /*transparentColor*/ ${hex(transparentColorOf(project))},\n`;
  }
  s += `};\n\n`;

  // Render mode is fixed at compile time by whether <LGFXVirtualCanvas.h> was
  // included before this header (§10): the drawing-surface type Canvas is the
  // tiled double buffer when present, the device base otherwise.
  s += `#if defined(LGFXVIRTUALCANVAS_H)\n`;
  s += `using Canvas = LGFXVirtualCanvas;\n`;
  s += `#else\n`;
  s += `using Canvas = lgfx::LGFXBase;\n`;
  s += `#endif\n\n`;

  // Facade
  s += `class Screen : public lgfxsb::RendererT<Canvas> {\n`;
  s += `  using Base = lgfxsb::RendererT<Canvas>;\n`;
  // Per-scene overlay slot + a type-erased thunk that recovers the typed scene
  // and the user callback at draw time (§11.4).
  project.scenes.forEach((sc) => {
    s += `  void (*_ov_${sc.id})(Canvas&, const Scene::${sc.id}&) = nullptr;\n`;
    s += `  static void _ovt_${sc.id}(Canvas& g, const void* s, const void* fnp) { (*static_cast<void (*const*)(Canvas&, const Scene::${sc.id}&)>(fnp))(g, *static_cast<const Scene::${sc.id}*>(s)); }\n`;
  });
  s += ` public:\n`;
  s += `  explicit Screen(lgfx::LGFX_Device& gfx) : Base(gfx, project) {}\n`;
  if (runtimeFonts.length) {
    s += `  // BFF / VLW fonts are parsed at run time, so this hook is required for\n`;
    s += `  // them — without it their Text draws in the default font (§8.7.7).\n`;
    s += `  void begin() { Base::begin(); detail::initRuntimeFonts(); }\n`;
  }
  s += `  void setProfile(Profile p) { _profile = static_cast<uint8_t>(p); }\n`;
  s += `  void show(lgfxsb::SceneId id) { renderScene(id, nullptr, 0); }\n`;
  project.scenes.forEach((sc) => {
    const texts = sc.parts.map((p, k) => ({ p, k })).filter((x) => x.p.type === 'Text');
    const ov = `_ov_${sc.id} ? &_ovt_${sc.id} : nullptr, &s, &_ov_${sc.id}`;
    if (texts.length === 0) {
      s += `  void show(const Scene::${sc.id}& s) { renderScene(Scene::${sc.id}::id, nullptr, 0, ${ov}); }\n`;
    } else {
      s += `  void show(const Scene::${sc.id}& s) {\n    lgfxsb::Value v[${sc.parts.length}];\n`;
      texts.forEach(({ p, k }) => {
        // null = unset -> leave Value::None so the per-profile design text shows (§8.7).
        s += `    if (s.${p.id}) v[${k}] = lgfxsb::Value::text(s.${p.id});\n`;
      });
      s += `    renderScene(Scene::${sc.id}::id, v, ${sc.parts.length}, ${ov});\n  }\n`;
    }
    s += `  void setOverlay(void (*fn)(Canvas&, const Scene::${sc.id}&)) { _ov_${sc.id} = fn; }\n`;
  });
  s += `};\n\n`;

  s += `} // namespace ${name}\n`;

  if (opts.embedAiLayouts) s += embedAiLayoutsBlock(project, profiles);
  return s;
}

// SPEC §10.2: embed every scene's AI layout (§8.15) as a parseable comment
// block. Comment-only, so the compiler strips it and it never reaches the
// binary. `/` is escaped as `\/` so the JSON can never contain `*/` and close
// the block early (`\/` is valid JSON; a reader parses the text between the
// sentinels directly, no un-escaping needed).
function embedAiLayoutsBlock(project, profiles) {
  const aiProject = { ...project, profiles }; // layouts match the exported profiles
  const scenes = project.scenes.map((sc) => buildAiLayout(aiProject, sc.id)).filter(Boolean);
  const doc = { format: 'lgfxsb-ai-layouts', version: 1, spec: AI_LAYOUT_DOC_URL, scenes };
  const json = JSON.stringify(doc, null, 2).replace(/\//g, '\\/');
  return `\n/* LGFXSB-AI-LAYOUTS v1 (generated; comment only — stripped at compile, do not edit)\n${json}\nLGFXSB-AI-LAYOUTS END */\n`;
}

function fmtFloat(n) {
  const v = Number(n);
  return Number.isInteger(v) ? v.toFixed(1) + 'f' : v + 'f';
}

// Generate the example sketch `<Project>_example.ino` for the target framework
// (§10). Includes/init differ per framework; the draw API is identical. The demo
// scene is the first one with a Text part; its preview strings seed the values.
export function generateSketch(project, framework, opts = {}) {
  const name = project.name;
  framework = framework || project.targetLibrary || 'M5Unified';

  let inc, decl, init, loopPre = '';
  if (framework === 'M5GFX') {
    inc = '#include <M5GFX.h>';
    decl = 'static M5GFX display;\nstatic Screen screen(display);';
    init = 'display.begin();';
  } else if (framework === 'LovyanGFX') {
    inc = '#include <LovyanGFX.hpp>\n#include <LGFX_AUTODETECT.hpp>';
    decl = 'static LGFX display;\nstatic Screen screen(display);';
    init = 'display.init();';
  } else { // M5Unified
    inc = '#include <M5Unified.h>';
    decl = 'static Screen screen(M5.Display);';
    init = 'M5.begin();';
    loopPre = '  M5.update();\n';
  }

  // The sample tours every scene so all designed screens can be checked on the
  // device: M5Unified advances on button A, bare LovyanGFX/M5GFX auto-advance on
  // a timer. Each screen is drawn with show(id) — its per-profile design/preview
  // state (§8.7), no values needed. Pushing live data is shown as a comment.
  const sceneCount = project.scenes.length;
  const multi = sceneCount > 1;
  const isM5Unified = framework !== 'M5GFX' && framework !== 'LovyanGFX';

  // Concrete "push live data" hint from the first scene that has a Text part.
  const dataScene = project.scenes.find((sc) => sc.parts.some((p) => p.type === 'Text'));
  const dataField = dataScene && dataScene.parts.find((p) => p.type === 'Text');
  const dataHint = dataScene
    ? `  // To draw live data, fill a scene struct and show it instead of show(id):\n` +
      `  //   Scene::${dataScene.id} s;  s.${dataField.id} = "...";  screen.show(s);\n`
    : '';

  let setupBody = '';
  if (sceneCount) setupBody += `  screen.show(sceneIdx);  // first screen, design/preview state\n`;
  if (dataHint) setupBody += `\n${dataHint}`;

  // loop(): advance through scenes.
  let loopBody;
  const advance = `    sceneIdx = (sceneIdx + 1) % kSceneCount;\n    screen.show(sceneIdx);\n`;
  if (!multi) {
    loopBody = '  delay(100);\n';
  } else if (isM5Unified) {
    loopBody = `  if (M5.BtnA.wasPressed()) {  // press button A for the next screen\n${advance}  }\n  delay(1);\n`;
  } else {
    loopBody = `  static uint32_t last = 0;\n  if (millis() - last >= 2500) {  // auto-advance every 2.5 s\n    last = millis();\n${advance}  }\n  delay(10);\n`;
  }

  // Scene count comes from the header (detail::kSceneInfoCount, §10), not a
  // baked literal, so the tour stays correct if the header is regenerated.
  const stateDecl = sceneCount
    ? `\nstatic uint16_t sceneIdx = 0;\nstatic const uint16_t kSceneCount = detail::kSceneInfoCount;`
    : '';

  // Render mode is fixed at compile time by whether <LGFXVirtualCanvas.h> is
  // included before <LGFXScreenBuilder.h> (§10). Default on: tiled double-buffering
  // reduces flicker (direct drawing is smaller but can flicker).
  const buffered = opts.buffered !== false;

  let s = '';
  s += `// Generated by LGFXScreenBuilder. Example sketch (${framework}).\n`;
  if (multi) {
    s += isM5Unified
      ? `// Tours every screen: press button A for the next one.\n`
      : `// Tours every screen: auto-advances every 2.5 s.\n`;
  }
  if (hasTransparentScene(project)) {
    s += `// A transparent scene lands on top of the screen shown before it; the next\n`;
    s += `// screen in the tour repaints the whole panel again.\n`;
  }
  s += `${inc}\n`;
  if (buffered) {
    // __has_include guard: keep compiling even if the LGFXVirtualCanvas library
    // isn't installed yet (falls back to direct drawing with a warning). Delete
    // this whole block to always draw directly.
    s += `// Tiled double-buffering (less flicker). Install the LGFXVirtualCanvas library;\n`;
    s += `// without it this falls back to direct drawing. Delete this block to draw directly.\n`;
    if (hasTransparentScene(project)) {
      s += `// This project has a transparent scene, so buffered drawing wants\n`;
      s += `// LGFXVirtualCanvas 1.4.0 or newer (older versions draw it opaque).\n`;
    }
    s += `#if __has_include(<LGFXVirtualCanvas.h>)\n`;
    s += `#include <LGFXVirtualCanvas.h>\n`;
    s += `#else\n`;
    s += `#warning "LGFXVirtualCanvas not found - drawing directly. Install it for flicker-free buffering."\n`;
    s += `#endif\n`;
  }
  s += `#include <LGFXScreenBuilder.h>\n#include "${name}.h"\n\n`;
  s += `using namespace ${name};\n\n${decl}\n${stateDecl}\n\n`;
  s += `void setup() {\n  ${init}\n  screen.begin();  // Profile::Auto resolves by screen size\n\n${setupBody}}\n\n`;
  s += `void loop() {\n${loopPre}${loopBody}}\n`;
  return s;
}

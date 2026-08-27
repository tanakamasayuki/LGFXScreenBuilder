#pragma once

#include <stdio.h>

#include "Project.h"

// Shared rendering engine (§11.1). Users do not use it directly; the generated
// facade `<Project>::Screen` inherits from it and binds the project descriptor.
// Targets LovyanGFX / M5GFX (a LovyanGFX derivative); <LovyanGFX.hpp> (or M5GFX)
// must be included before this header.
//
// Render mode is fixed at compile time by whether <LGFXVirtualCanvas.h> was
// included before this header (SPEC §10): if it was, drawing goes through the
// tiled double-buffered LGFXVirtualCanvas; otherwise it draws directly to the
// device. The engine is templated on the canvas type `Canvas` (the generated
// header selects it), so the same part-drawing code drives both.

// Transparent (overlay) scene support (§8.16). A direct build needs nothing at
// all — not clearing the screen already leaves the panel showing through. A
// buffered build needs LGFXVirtualCanvas >= 1.4.0 for renderTransparent(); with
// an older one a transparent scene degrades to an ordinary opaque screen.
#if !defined(LGFXVIRTUALCANVAS_H)
#define LGFXSB_TRANSPARENT_SCENES 1
#elif (LGFXVIRTUALCANVAS_VERSION_MAJOR > 1) || \
    (LGFXVIRTUALCANVAS_VERSION_MAJOR == 1 && LGFXVIRTUALCANVAS_VERSION_MINOR >= 4)
#define LGFXSB_TRANSPARENT_SCENES 1
#else
#define LGFXSB_TRANSPARENT_SCENES 0
#warning "LGFXVirtualCanvas < 1.4.0: transparent (overlay) scenes are drawn as ordinary opaque screens. Update the library to 1.4.0 or newer."
#endif

namespace lgfxsb
{

  // The macro above as a value, so only the one `#if` that guards the call to
  // renderTransparent() has to be a preprocessor conditional.
  static constexpr bool kTransparentScenes = (LGFXSB_TRANSPARENT_SCENES != 0);

  // Resolve a PartLayout::font pointer to a font that is safe to draw with.
  //
  // u8g2 and GFXfont are `const` objects that are complete the moment they are
  // linked. VLW and BFF are not: LovyanGFX parses their tables at run time, and
  // until the generated detail::initRuntimeFonts() has run (from Screen::begin(),
  // §8.7.7) their glyph tables are null pointers. Drawing through one in that
  // state walks those nulls, so a sketch that forgot begin() would fault instead
  // of showing text. Falling back to the default font makes the mistake visible
  // as plain-looking text rather than a crash.
  //
  // BFFfont reports itself as ft_ttf, which is why both types are checked here.
  inline const lgfx::v1::IFont *usableFont(const void *font)
  {
    if (font == nullptr)
    {
      return &lgfx::v1::fonts::Font0;
    }
    const auto *f = static_cast<const lgfx::v1::IFont *>(font);
    const auto type = f->getType();
    if (type == lgfx::v1::IFont::font_type_t::ft_vlw || type == lgfx::v1::IFont::font_type_t::ft_ttf)
    {
      if (!static_cast<const lgfx::v1::RunTimeFont *>(f)->_fontLoaded)
      {
        return &lgfx::v1::fonts::Font0;
      }
    }
    return f;
  }

  template <class Canvas>
  class RendererT
  {
  protected:
    lgfx::LGFX_Device *_gfx = nullptr; // base of LGFX / M5GFX / M5.Display
    const Project &_project;
    uint8_t _profile = 0; // 0 = Auto (actual resolution deferred to draw time; 1+ = enum Profile value = index + 1)
    // Board's standard rotation, captured once after the display is initialized
    // (e.g. M5.begin()/display.init() leave it). A profile's rotation is the
    // canonical "0 = standard orientation" and is applied RELATIVE to this base
    // as (base + profile.rotation) % 4, so it maps correctly onto boards (e.g.
    // M5GFX) whose standard rotation is not 0 (§8.9).
    uint8_t _baseRotation = 0;
    bool _baseRotationSet = false;

    void captureBaseRotation()
    {
      if (_gfx)
        _baseRotation = static_cast<uint8_t>(_gfx->getRotation() & 3);
      _baseRotationSet = true;
    }
#if defined(LGFXVIRTUALCANVAS_H)
    LGFXVirtualScreen _vscreen; // tiled double-buffer manager (buffered build only)
#endif

    // Type-erased, per-scene overlay hook (§11.4). The generated facade binds
    // the user callback + the live scene struct into (scene, fnp); the engine
    // invokes it after the static parts — once per tile in buffered mode.
    using OverlayThunk = void (*)(Canvas &g, const void *scene, const void *fnp);

    // Resolve the selected profile to a concrete index (§8.9.4). Auto order:
    // 1) orientation-sensitive size match, 2) first profile.
    uint8_t resolveProfileIndex() const
    {
      if (_profile != 0)
      {
        uint8_t idx = _profile - 1;
        return (idx < _project.profileCount) ? idx : 0;
      }

      // Orientation relative to the board's standard (base), so the native
      // (de-rotated) size is computed the same way on any board.
      const uint8_t rel = static_cast<uint8_t>((_gfx->getRotation() + 4u - _baseRotation) & 3u);
      const int pw = _gfx->width(), ph = _gfx->height();
      const int16_t nativeW = static_cast<int16_t>((rel & 1) ? ph : pw);
      const int16_t nativeH = static_cast<int16_t>((rel & 1) ? pw : ph);
      for (uint8_t pi = 0; pi < _project.profileCount; ++pi)
      {
        const ProfileDesc &pr = _project.profiles[pi];
        if (pr.w == nativeW && pr.h == nativeH)
          return pi;
      }
      // No size match: fall back so something always renders.
      return 0;
    }

    const SceneDesc *findScene(SceneId id) const
    {
      for (uint16_t i = 0; i < _project.sceneCount; ++i)
        if (_project.scenes[i].id == id)
          return &_project.scenes[i];
      return nullptr;
    }

    const PartLayout &layoutOf(uint8_t profileIndex, uint16_t partIndex) const
    {
      return _project.layouts[profileIndex * _project.partCount + partIndex];
    }

    uint16_t color565(uint32_t rgb) const
    {
      return _gfx->color565((rgb >> 16) & 0xFF, (rgb >> 8) & 0xFF, rgb & 0xFF);
    }

    // Whether this scene is drawn as a transparent overlay (§8.16). False when
    // the build cannot honor it (buffered on LGFXVirtualCanvas < 1.4.0), so the
    // scene degrades to an ordinary opaque screen instead of drawing onto an
    // uninitialized tile.
    bool isTransparentScene(const SceneDesc *sc) const
    {
      return kTransparentScenes && sc && sc->transparent;
    }

    // Draw a whole scene onto a canvas: clear, parts, then the overlay. Templated
    // on `Canvas` so the same code drives the device (direct) and the tiled
    // LGFXVirtualCanvas (buffered); in buffered mode it runs once per tile.
    void drawSceneTo(Canvas &g, const SceneDesc *sc, uint8_t pi,
                     const Value *values, uint16_t valueCount,
                     OverlayThunk overlay, const void *scene, const void *fnp)
    {
      // Text sets the base color per part (see drawPart), and the base color is
      // not text state: LovyanGFX also fills clear() / clearDisplay() and the
      // setScrollRect() gap with it. Leaving a part's value behind would mean a
      // later display.clear() in the sketch painted the screen in whatever colour
      // the last anti-aliased Text happened to use, so the scene puts it back.
      const uint32_t savedBase = g.getBaseColor();

      // A transparent scene must NOT paint a background: buffered mode has
      // already auto-cleared the tile with the color key (LGFXVirtualCanvas SPEC
      // §22.3), and in direct mode leaving the pixels alone IS the transparency.
      if (!isTransparentScene(sc))
        g.fillScreen(color565(_project.background));
      if (sc)
      {
        for (uint16_t k = 0; k < sc->partCount; ++k)
        {
          const uint16_t gpi = sc->partStart + k;
          const PartDesc &pd = _project.parts[gpi];
          const PartLayout &lo = layoutOf(pi, gpi);
          const Value v = (k < valueCount) ? values[k] : Value();
          drawPart(g, pd, lo, v);
        }
      }
      if (overlay)
        overlay(g, scene, fnp);
      g.setBaseColor(savedBase);
    }

    void drawPart(Canvas &g, const PartDesc &pd, const PartLayout &lo, const Value &v)
    {
      // Visibility: base on layout.visible, overridden by a Bool value if present.
      bool visible = lo.visible;
      if (v.kind == Value::Kind::Bool)
        visible = v.b;
      if (!visible)
        return;

      const int ox = lo.x;
      const int oy = lo.y;

      switch (pd.type)
      {
      case PartType::Rect:
        if (lo.fill)
        {
          if (lo.r > 0)
            g.fillRoundRect(ox, oy, lo.w, lo.h, lo.r, color565(lo.color));
          else
            g.fillRect(ox, oy, lo.w, lo.h, color565(lo.color));
        }
        else
        {
          if (lo.r > 0)
            g.drawRoundRect(ox, oy, lo.w, lo.h, lo.r, color565(lo.color));
          else
            g.drawRect(ox, oy, lo.w, lo.h, color565(lo.color));
        }
        break;

      case PartType::Line:
        g.drawLine(ox, oy, lo.x2, lo.y2, color565(lo.color));
        break;

      case PartType::Circle:
        if (lo.fill)
          g.fillCircle(ox, oy, lo.r, color565(lo.color));
        else
          g.drawCircle(ox, oy, lo.r, color565(lo.color));
        break;

      case PartType::Text:
      {
        // Per-profile design text (§8.7) is the fallback when no dynamic value
        // is supplied, so each profile shows its own fixed-label string.
        const char *content = lo.text ? lo.text : "";
        char buf[24];
        if (v.kind == Value::Kind::Text && v.s)
        {
          content = v.s;
        }
        else if (v.kind == Value::Kind::Int)
        {
          snprintf(buf, sizeof(buf), "%ld", v.i);
          content = buf;
        }
        // An anti-aliased font (VLW / BFF) blends partial coverage toward the BASE
        // color, not toward what is already on the canvas: setTextColor() below
        // is the one-argument form, which leaves back_rgb888 == fore_rgb888, and
        // lgfx_fonts.cpp then falls back to getBaseColor(). Point it at the color
        // this text actually sits on, or at the screen fill when it has no
        // override. A 1bpp font ignores it — it writes solid pixels or nothing.
        //
        // VLW self-corrects on a READABLE panel (it reads the framebuffer back
        // and blends against the real pixels — lgfx_fonts.cpp "alpha blend
        // mode"). BFF never does: draw_alpha_bitmap_common has no such branch.
        // So this matters for BFF everywhere, and for VLW on the many SPI panels
        // that cannot be read back.
        g.setBaseColor(lo.bg == kInheritBackground ? _project.background : lo.bg);

        // Font (§8.7.5): the descriptor stores &lgfx::v1::fonts::X, or the address
        // of a generated font object, as a void* (null = default). Set it on
        // every Text so the previous Text's font does not leak into this one.
        g.setFont(usableFont(lo.font));
        g.setTextColor(color565(lo.color));
        g.setTextSize(lo.size);
        g.setTextDatum(static_cast<lgfx::textdatum_t>(lo.datum));
        g.drawString(content, ox, oy);
        break;
      }

      case PartType::Image:
        if (pd.assetIndex >= 0 && pd.assetIndex < static_cast<int16_t>(_project.assetCount) && _project.assets)
        {
          const AssetDesc &a = _project.assets[pd.assetIndex];
          if (a.data)
          {
            g.pushImage(ox, oy, a.w, a.h, a.data);
            break;
          }
        }
        g.drawRect(ox, oy, lo.w, lo.h, color565(0x6f8a92));
        break;

      default:
        break;
      }
    }

    // Render a scene. `values` are the dynamic values in this scene's local part
    // order (relative to partStart). The optional overlay hook (§11.4) is invoked
    // after the static parts.
    void renderScene(SceneId id, const Value *values, uint16_t valueCount,
                     OverlayThunk overlay = nullptr, const void *scene = nullptr, const void *fnp = nullptr)
    {
      if (!_gfx)
        return;
      if (!_baseRotationSet)
        captureBaseRotation();
      const uint8_t pi = resolveProfileIndex();
      // (base + profile.rotation) % 4: profile rotation is relative to the board's
      // standard orientation (§8.9), so it wraps back into 0..3.
      _gfx->setRotation((_baseRotation + _project.profiles[pi].rotation) % 4);
      const SceneDesc *sc = findScene(id);

#if defined(LGFXVIRTUALCANVAS_H)
      // Buffered: LGFXVirtualCanvas tiles the screen and calls our draw function
      // once per tile in virtual full-screen coordinates (Canvas == LGFXVirtualCanvas).
      struct Ctx
      {
        RendererT *self;
        const SceneDesc *sc;
        uint8_t pi;
        const Value *values;
        uint16_t count;
        OverlayThunk overlay;
        const void *scene;
        const void *fnp;
      } ctx{this, sc, pi, values, valueCount, overlay, scene, fnp};
      // Spelled as a raw function pointer (not `auto`) so both render() and
      // renderTransparent() resolve to their DrawRaw overload.
      void (*const draw)(LGFXVirtualCanvas &, void *) = [](LGFXVirtualCanvas &g, void *p)
      {
        Ctx *c = static_cast<Ctx *>(p);
        c->self->drawSceneTo(g, c->sc, c->pi, c->values, c->count, c->overlay, c->scene, c->fnp);
      };
#if LGFXSB_TRANSPARENT_SCENES
      if (isTransparentScene(sc))
      {
        // Overlay: push the tiles with the color key masked out so the screen
        // underneath survives (§8.16). renderTransparent() clears each tile with
        // the key itself, so the library's auto-clear has to be back on for it —
        // setAutoClear(false) + renderTransparent() is explicitly unsupported
        // (LGFXVirtualCanvas SPEC §22.3). Restored right after, since an opaque
        // scene relies on drawSceneTo()'s own fillScreen().
        _vscreen.setTransparentColor(static_cast<uint32_t>(_project.transparentColor));
        _vscreen.setAutoClear(true);
        _vscreen.renderTransparent(draw, &ctx);
        _vscreen.setAutoClear(false);
        return;
      }
#endif
      _vscreen.render(draw, &ctx);
#else
      // Direct: draw straight to the device (Canvas == lgfx::LGFXBase).
      drawSceneTo(*_gfx, sc, pi, values, valueCount, overlay, scene, fnp);
#endif
    }

  public:
    RendererT(lgfx::LGFX_Device &gfx, const Project &project)
        : _gfx(&gfx), _project(project)
#if defined(LGFXVIRTUALCANVAS_H)
          ,
          _vscreen(gfx)
#endif
    {
#if defined(LGFXVIRTUALCANVAS_H)
      // drawSceneTo() clears each tile via fillScreen(), so the library's own
      // per-tile auto-clear is redundant. (renderScene() turns it back on for the
      // duration of a transparent scene, which needs it; §8.16.)
      _vscreen.setAutoClear(false);
#endif
    }

    // Configuration hook after display init (§11.3). Captures the board's standard
    // rotation as the base for profile rotation (§8.9); does not change the profile.
    void begin() { captureBaseRotation(); }

    // Resolved render mode (compile-time constant; §10). true = tiled double
    // buffering via LGFXVirtualCanvas, false = direct drawing.
    bool isBuffered() const
    {
#if defined(LGFXVIRTUALCANVAS_H)
      return true;
#else
      return false;
#endif
    }

    // Whether transparent (overlay) scenes are honored in this build (§8.16).
    // False only for a buffered build on LGFXVirtualCanvas < 1.4.0, where such a
    // scene is drawn as an ordinary opaque screen.
    bool supportsTransparentScenes() const { return kTransparentScenes; }
  };

  // Direct-drawing engine, and a backward-compatible name for headers written
  // against the original non-template engine (direct mode only).
  using Renderer = RendererT<lgfx::LGFXBase>;

} // namespace lgfxsb

// Not part of the public surface: the value lives on as lgfxsb::kTransparentScenes.
#undef LGFXSB_TRANSPARENT_SCENES

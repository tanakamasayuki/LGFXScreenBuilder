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
namespace lgfxsb
{

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

    // Draw a whole scene onto a canvas: clear, parts, then the overlay. Templated
    // on `Canvas` so the same code drives the device (direct) and the tiled
    // LGFXVirtualCanvas (buffered); in buffered mode it runs once per tile.
    void drawSceneTo(Canvas &g, const SceneDesc *sc, uint8_t pi,
                     const Value *values, uint16_t valueCount,
                     OverlayThunk overlay, const void *scene, const void *fnp)
    {
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
        // Preset font (§8.7.5): the descriptor stores &lgfx::v1::fonts::X as a
        // void* (null = default). Set it on every Text so the previous Text's
        // font does not leak into this one.
        g.setFont(lo.font ? static_cast<const lgfx::v1::IFont *>(lo.font)
                          : &lgfx::v1::fonts::Font0);
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
      _vscreen.render(
          [](LGFXVirtualCanvas &g, void *p)
          {
            Ctx *c = static_cast<Ctx *>(p);
            c->self->drawSceneTo(g, c->sc, c->pi, c->values, c->count, c->overlay, c->scene, c->fnp);
          },
          &ctx);
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
      // per-tile auto-clear is redundant.
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
  };

  // Direct-drawing engine, and a backward-compatible name for headers written
  // against the original non-template engine (direct mode only).
  using Renderer = RendererT<lgfx::LGFXBase>;

} // namespace lgfxsb

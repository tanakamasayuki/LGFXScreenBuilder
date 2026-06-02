#pragma once

#include <stdio.h>

#include "Project.h"

// Shared rendering engine (§11.1). Users do not use it directly; the generated
// facade `<Project>::Screen` inherits from it and binds the project descriptor.
// Targets LovyanGFX / M5GFX (a LovyanGFX derivative); <LovyanGFX.hpp> (or M5GFX)
// must be included before this header.
namespace lgfxsb
{

  class Renderer
  {
  protected:
    lgfx::LGFX_Device *_gfx = nullptr; // device type that has getBoard() (base of LGFX / M5GFX / M5.Display)
    const Project &_project;
    uint8_t _profile = 0; // 0 = Auto (actual resolution deferred to draw time; 1+ = enum Profile value = index + 1)

    // Resolve the selected profile to a concrete index (§8.9.4).
    uint8_t resolveProfileIndex() const
    {
      if (_profile != 0)
      {
        uint8_t idx = _profile - 1;
        return (idx < _project.profileCount) ? idx : _project.defaultProfile;
      }
      // Auto: resolve getBoard() against the assignment table; fall back if not found.
      const int board = static_cast<int>(_gfx->getBoard());
      for (uint8_t pi = 0; pi < _project.profileCount; ++pi)
      {
        const ProfileDesc &pr = _project.profiles[pi];
        for (uint8_t bi = 0; bi < pr.boardCount; ++bi)
          if (pr.boards[bi] == board)
            return pi;
      }
      return _project.defaultProfile;
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

    // Walk the parent chain to compute a part's absolute origin (inclusive of itself).
    void absOrigin(uint16_t partIndex, uint8_t profileIndex, int &ox, int &oy) const
    {
      ox = 0;
      oy = 0;
      int cur = static_cast<int>(partIndex);
      while (cur >= 0)
      {
        const PartLayout &lo = layoutOf(profileIndex, static_cast<uint16_t>(cur));
        ox += lo.x;
        oy += lo.y;
        cur = _project.parts[cur].parent;
      }
    }

    uint16_t color565(uint32_t rgb) const
    {
      return _gfx->color565((rgb >> 16) & 0xFF, (rgb >> 8) & 0xFF, rgb & 0xFF);
    }

    // Render a scene. `values` are the dynamic values in this scene's local part
    // order (relative to partStart).
    void renderScene(SceneId id, const Value *values, uint16_t valueCount)
    {
      if (!_gfx)
        return;
      const uint8_t pi = resolveProfileIndex();
      const ProfileDesc &pr = _project.profiles[pi];
      _gfx->setRotation(pr.rotation);
      _gfx->fillScreen(color565(_project.background)); // full physical-size fill (§7.4)

      const SceneDesc *sc = findScene(id);
      if (!sc)
        return;

      for (uint16_t k = 0; k < sc->partCount; ++k)
      {
        const uint16_t gpi = sc->partStart + k;
        const PartDesc &pd = _project.parts[gpi];
        const PartLayout &lo = layoutOf(pi, gpi);
        const Value v = (k < valueCount) ? values[k] : Value();
        drawPart(pd, lo, gpi, pi, v);
      }
    }

    void drawPart(const PartDesc &pd, const PartLayout &lo, uint16_t gpi, uint8_t pi, const Value &v)
    {
      if (pd.type == PartType::Group)
        return; // containers are not drawn

      // Visibility: base on layout.visible, overridden by a Bool value if present.
      bool visible = lo.visible;
      if (v.kind == Value::Kind::Bool)
        visible = v.b;
      if (!visible)
        return;

      int ox = 0, oy = 0;
      absOrigin(gpi, pi, ox, oy);

      switch (pd.type)
      {
      case PartType::Rect:
        _gfx->fillRect(ox, oy, lo.w, lo.h, color565(lo.color));
        break;

      case PartType::Text:
      {
        const char *content = pd.text ? pd.text : "";
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
        _gfx->setTextColor(color565(lo.color));
        _gfx->setTextSize(lo.size);
        _gfx->setTextDatum(static_cast<lgfx::textdatum_t>(lo.datum));
        _gfx->drawString(content, ox, oy);
        break;
      }

      case PartType::Image:
        // Phase 1 MVP: asset data not yet supported, so draw a placeholder frame.
        _gfx->drawRect(ox, oy, lo.w, lo.h, color565(0x6f8a92));
        break;

      default:
        break;
      }
    }

  public:
    Renderer(lgfx::LGFX_Device &gfx, const Project &project) : _gfx(&gfx), _project(project) {}

    void begin() {} // configuration hook after display init (does not touch profile selection; §11.3)
  };

} // namespace lgfxsb

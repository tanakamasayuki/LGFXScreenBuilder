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

    // Resolve the selected profile to a concrete index (§8.9.4). Auto order:
    // 1) explicit board match, 2) orientation-sensitive size match, 3) default.
    uint8_t resolveProfileIndex() const
    {
      if (_profile != 0)
      {
        uint8_t idx = _profile - 1;
        return (idx < _project.profileCount) ? idx : _project.defaultProfile;
      }

      // 1) Explicit board match (highest priority): lets a specific device get a
      // dedicated layout even when devices share a size.
      const int board = static_cast<int>(_gfx->getBoard());
      for (uint8_t pi = 0; pi < _project.profileCount; ++pi)
      {
        const ProfileDesc &pr = _project.profiles[pi];
        for (uint8_t bi = 0; bi < pr.boardCount; ++bi)
          if (pr.boards[bi] == board)
            return pi;
      }

      // 2) Size match against the panel's native (rotation-0) resolution, compared
      // orientation-sensitively (135x240 != 240x135). Profile w/h are native dims;
      // a profile's own rotation is applied later at draw time, so we normalize the
      // current physical size back to native using the current rotation parity.
      const uint8_t rot = _gfx->getRotation();
      const int pw = _gfx->width(), ph = _gfx->height();
      const int16_t nativeW = static_cast<int16_t>((rot & 1) ? ph : pw);
      const int16_t nativeH = static_cast<int16_t>((rot & 1) ? pw : ph);
      int firstSize = -1;
      bool defaultMatches = false;
      for (uint8_t pi = 0; pi < _project.profileCount; ++pi)
      {
        const ProfileDesc &pr = _project.profiles[pi];
        if (pr.w == nativeW && pr.h == nativeH)
        {
          if (firstSize < 0)
            firstSize = pi;
          if (pi == _project.defaultProfile)
            defaultMatches = true;
        }
      }
      if (firstSize >= 0) // prefer default when it shares the size, else first declared
        return defaultMatches ? _project.defaultProfile : static_cast<uint8_t>(firstSize);

      // 3) No size match either: fall back so something always renders.
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
        // Preset font (§8.7.5): the descriptor stores &lgfx::v1::fonts::X as a
        // void* (null = default). Set it on every Text so the previous Text's
        // font does not leak into this one.
        _gfx->setFont(lo.font ? static_cast<const lgfx::v1::IFont *>(lo.font)
                              : &lgfx::v1::fonts::Font0);
        _gfx->setTextColor(color565(lo.color));
        _gfx->setTextSize(lo.size);
        _gfx->setTextDatum(static_cast<lgfx::textdatum_t>(lo.datum));
        _gfx->drawString(content, ox, oy);
        break;
      }

      case PartType::Image:
        // Draw the referenced RGB565 asset at its native size (§8.4); if none is
        // bound, fall back to a placeholder frame.
        if (pd.assetIndex >= 0 && pd.assetIndex < static_cast<int16_t>(_project.assetCount) && _project.assets)
        {
          const AssetDesc &a = _project.assets[pd.assetIndex];
          if (a.data)
          {
            _gfx->pushImage(ox, oy, a.w, a.h, a.data);
            break;
          }
        }
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

#pragma once

// LGFXScreenBuilder — Arduino runtime for screens authored with the browser tool.
//
// This umbrella header includes the shared engine (lgfxsb::Renderer / Project).
// On the user side, include <LovyanGFX.hpp> (or M5GFX / M5Unified) first, then
// this header, then the "<Project>.h" emitted by the authoring tool (§11.2).
//
//   #include <LovyanGFX.hpp>
//   #include <LGFX_AUTODETECT.hpp>
//   #include <LGFXScreenBuilder.h>
//   #include "MyScreen.h"        // generated output (<project name>.h)
//   using namespace MyScreen;
//   static LGFX display;
//   static Screen screen(display);

#include "lgfxscreenbuilder_version.h"
#include "lgfxsb/Types.h"
#include "lgfxsb/Project.h"
#include "lgfxsb/Renderer.h"

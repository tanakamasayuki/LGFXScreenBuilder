#pragma once

// en: SAMPLE generated header — hand-written to validate the §11 facade pattern.
// en: In production the authoring tool emits this shape (project namespace +
// en: data descriptor + Screen facade). Include <LovyanGFX.hpp> (or M5GFX) and
// en: <LGFXScreenBuilder.h> before this header.
// ja: サンプル生成ヘッダ — §11 のファサード方式を検証するための手書き版。
// ja: 本番ではオーサリングツールがこの形（プロジェクト名前空間＋データ記述子＋
// ja: Screen ファサード）を出力する。先に <LovyanGFX.hpp> 等と
// ja: <LGFXScreenBuilder.h> をインクルードしておくこと。

namespace MyScreen
{

  // en: Type-safe enum the user names via setProfile() (§8.9 / §8.11). Auto is reserved.
  // ja: ユーザーが setProfile() で名指しする型安全な列挙（§8.9 / §8.11）。Auto は予約。
  enum class Profile : uint8_t { Auto = 0, Core, Stick, Cardputer };

  // en: Scene structs (data contract: ID/type/parent only; values are assigned by the usage code. §8.2)
  // ja: シーン構造体（データ契約: ID/型/親子のみ。値は利用コードが代入。§8.2）
  namespace Scene
  {
    struct Boot
    {
      static constexpr lgfxsb::SceneId id = 0;
    };

    struct Main
    {
      static constexpr lgfxsb::SceneId id = 1;
      struct Header { const char *title = ""; int battery = 0; } header;
      struct Body   { const char *temperature = ""; } body;
    };
  } // namespace Scene

  namespace detail
  {
    // en: Static part definitions (across all scenes; SceneDesc references by range).
    // ja: パーツ静的定義（全シーン通し。SceneDesc が範囲参照）。
    static const lgfxsb::PartDesc kParts[] = {
        // Boot
        {"logo", lgfxsb::PartType::Rect, nullptr, -1},        // 0
        {"boot", lgfxsb::PartType::Text, "Booting...", -1},   // 1
        // Main
        {"headerBand", lgfxsb::PartType::Rect, nullptr, -1},  // 2
        {"title", lgfxsb::PartType::Text, "Main", -1},        // 3
        {"battery", lgfxsb::PartType::Text, "82%", -1},       // 4
        {"temp", lgfxsb::PartType::Text, "24.5C", -1},        // 5
        {"panel", lgfxsb::PartType::Rect, nullptr, -1},       // 6
    };
    static constexpr uint16_t kPartCount = 7;

    static const lgfxsb::SceneDesc kScenes[] = {
        {Scene::Boot::id, "Boot", 0, 2},
        {Scene::Main::id, "Main", 2, 5},
    };

    // en: datum shorthands  /  ja: datum 短縮
    static constexpr uint8_t TL = (uint8_t)lgfxsb::Datum::TL;
    static constexpr uint8_t TR = (uint8_t)lgfxsb::Datum::TR;
    static constexpr uint8_t MC = (uint8_t)lgfxsb::Datum::MC;

    // en: Per-profile layouts [profile][part]  /  ja: プロファイル別レイアウト [profile][part]
    // {x, y, w, h, x2, y2, r, datum, size, color, fill, visible, font}
    static const lgfxsb::PartLayout kLayouts[] = {
        // ---- Profile 0: Core 320x240 rot1 ----
        {110, 80, 100, 60, 0, 0, 0, 0, 0.0f, 0x1e2a30, true, true, nullptr},   // logo
        {160, 160, 0, 0, 0, 0, 0, MC, 2.0f, 0x9ce5ac, true, true, nullptr}, // boot
        {0, 0, 320, 40, 0, 0, 0, 0, 0.0f, 0x1e2a30, true, true, nullptr},      // headerBand
        {12, 10, 0, 0, 0, 0, 0, TL, 2.0f, 0xffffff, true, true, nullptr},   // title
        {310, 12, 0, 0, 0, 0, 0, TR, 1.5f, 0x9ce5ac, true, true, nullptr},  // battery
        {18, 70, 0, 0, 0, 0, 0, TL, 4.0f, 0xffffff, true, true, nullptr},   // temp
        {18, 150, 284, 54, 0, 0, 0, 0, 0.0f, 0x172126, true, true, nullptr},   // panel

        // ---- Profile 1: Stick 135x240 rot0 ----
        {30, 80, 75, 50, 0, 0, 0, 0, 0.0f, 0x1e2a30, true, true, nullptr},     // logo
        {69, 148, 0, 0, 0, 0, 0, MC, 1.5f, 0x9ce5ac, true, true, nullptr},  // boot
        {0, 0, 135, 30, 0, 0, 0, 0, 0.0f, 0x1e2a30, true, true, nullptr},      // headerBand
        {8, 7, 0, 0, 0, 0, 0, TL, 1.5f, 0xffffff, true, true, nullptr},     // title
        {8, 180, 0, 0, 0, 0, 0, TL, 1.5f, 0x9ce5ac, true, true, nullptr},   // battery
        {10, 60, 0, 0, 0, 0, 0, TL, 3.5f, 0xffffff, true, true, nullptr},   // temp
        {10, 110, 115, 60, 0, 0, 0, 0, 0.0f, 0x172126, true, true, nullptr},   // panel

        // ---- Profile 2: Cardputer 240x135 rot1 ----
        {80, 30, 80, 40, 0, 0, 0, 0, 0.0f, 0x1e2a30, true, true, nullptr},     // logo
        {120, 88, 0, 0, 0, 0, 0, MC, 1.5f, 0x9ce5ac, true, true, nullptr},  // boot
        {0, 0, 240, 26, 0, 0, 0, 0, 0.0f, 0x1e2a30, true, true, nullptr},      // headerBand
        {8, 5, 0, 0, 0, 0, 0, TL, 1.5f, 0xffffff, true, true, nullptr},     // title
        {232, 6, 0, 0, 0, 0, 0, TR, 1.25f, 0x9ce5ac, true, true, nullptr},  // battery
        {12, 40, 0, 0, 0, 0, 0, TL, 3.0f, 0xffffff, true, true, nullptr},   // temp
        {12, 86, 216, 40, 0, 0, 0, 0, 0.0f, 0x172126, true, false, nullptr},   // panel (hidden on Cardputer / Cardputer では非表示)
    };

    static const lgfxsb::ProfileDesc kProfiles[] = {
        {320, 240, 1},
        {135, 240, 0},
        {240, 135, 1},
    };

    struct ProfileInfo
    {
      const char *name;
      uint8_t index;
      int16_t w, h;
      uint8_t rotation;
    };

    struct SceneInfo
    {
      const char *name;
      lgfxsb::SceneId id;
      uint16_t index;
    };

    static constexpr ProfileInfo kProfileInfo[] = {
        {"Core", 0, 320, 240, 1},
        {"Stick", 1, 135, 240, 0},
        {"Cardputer", 2, 240, 135, 1},
    };
    static constexpr uint8_t kProfileInfoCount = 3;

    static constexpr SceneInfo kSceneInfo[] = {
        {"Boot", Scene::Boot::id, 0},
        {"Main", Scene::Main::id, 1},
    };
    static constexpr uint16_t kSceneInfoCount = 2;
  } // namespace detail

  static const lgfxsb::Project project = {
      detail::kProfiles, 3,
      detail::kScenes, 2,
      detail::kParts, detail::kPartCount,
      detail::kLayouts,
      /*background*/ 0x000000,
      nullptr, 0,
  };

  // en: Project-specific facade (binds the descriptor to the shared engine. §11.1)
  // ja: プロジェクト専用ファサード（共有エンジンに記述子を束縛。§11.1）
  class Screen : public lgfxsb::Renderer
  {
  public:
    explicit Screen(lgfx::LGFX_Device &gfx) : lgfxsb::Renderer(gfx, project) {}

    void setProfile(Profile p) { _profile = static_cast<uint8_t>(p); }

    void show(lgfxsb::SceneId id) { renderScene(id, nullptr, 0); }

    void show(const Scene::Boot &) { renderScene(Scene::Boot::id, nullptr, 0); }

    void show(const Scene::Main &s)
    {
      // en: scene-local order: 0=headerBand,1=title,2=battery,3=temp,4=panel
      // ja: シーン内ローカル順: 0=headerBand,1=title,2=battery,3=temp,4=panel
      lgfxsb::Value v[5];
      v[1] = lgfxsb::Value::text(s.header.title);
      v[2] = lgfxsb::Value::integer(s.header.battery);
      v[3] = lgfxsb::Value::text(s.body.temperature);
      renderScene(Scene::Main::id, v, 5);
    }
  };

} // namespace MyScreen

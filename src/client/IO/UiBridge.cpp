#include "UiBridge.h"
#include "UiBridgeProtocol.h"

#include "UI.h"
#include "KeyAction.h"

#include "../Console.h"
#include "../Constants.h"
#include "../Character/CharStats.h"
#include "../Character/Player.h"
#include "../Gameplay/Stage.h"
#include "../Net/Login.h"
#include "../Net/Packets/MessagingPackets.h"
#include "../Net/Packets/LoginPackets.h"
#include "../Character/MapleStat.h"
#include "UITypes/UICharSelect.h"
#include "UITypes/UILogin.h"

#include "../Util/Misc.h"

#include "json/json.hpp"

#include "nlnx/nx.hpp"
#include "nlnx/node.hpp"
#include "nlnx/bitmap.hpp"

// stb_image_write provides PNG-to-memory encoding. The implementation must be
// compiled in exactly one translation unit. The vendored stb headers only
// define STB_IMAGE_WRITE_IMPLEMENTATION inside their own test/demo files (e.g.
// stb_herringbone_wang_tile.h), none of which are part of this build's source
// list, so defining it here is safe and gives us the single implementation.
#ifndef STB_IMAGE_WRITE_IMPLEMENTATION
#define STB_IMAGE_WRITE_IMPLEMENTATION
#endif
#include "stb/stb_image_write.h"

#include <cstdint>
#include <vector>

#ifdef MS_PLATFORM_WASM
#include <emscripten.h>
#endif

using json = nlohmann::json;

namespace jrc
{
    UiBridge::UiBridge() {}

    void UiBridge::push(const std::string& payload)
    {
#ifdef MS_PLATFORM_WASM
        EM_ASM({
            if (window.MapleBridge && typeof window.MapleBridge.recv === "function") {
                window.MapleBridge.recv(UTF8ToString($0));
            }
        }, payload.c_str());
#else
        (void)payload;
#endif
    }

    void UiBridge::emit_scene(const std::string& name)
    {
        json j = { {"v", bridge::PROTOCOL_VERSION}, {"t", bridge::MSG_SCENE}, {"name", name} };
        push(j.dump());
    }

    void UiBridge::emit_stats(int hp, int maxhp, int mp, int maxmp, int level, int64_t exp)
    {
        json j = {
            {"v", bridge::PROTOCOL_VERSION}, {"t", bridge::MSG_STATS},
            {"hp", hp}, {"maxHp", maxhp}, {"mp", mp}, {"maxMp", maxmp},
            {"level", level}, {"exp", exp}
        };
        push(j.dump());
    }

    void UiBridge::emit_character(const std::string& name, const std::string& job)
    {
        json j = {
            {"v", bridge::PROTOCOL_VERSION}, {"t", bridge::MSG_CHARACTER},
            {"name", name}, {"job", job}
        };
        push(j.dump());
    }

    void UiBridge::emit_chat(const std::string& line, int ctype)
    {
        json j = {
            {"v", bridge::PROTOCOL_VERSION}, {"t", bridge::MSG_CHAT},
            {"line", line}, {"ctype", ctype}
        };
        push(j.dump());
    }

    void UiBridge::emit_pong(int nonce)
    {
        json j = { {"v", bridge::PROTOCOL_VERSION}, {"t", bridge::MSG_PONG}, {"nonce", nonce} };
        push(j.dump());
    }

    void UiBridge::emit_login_result(int ok, const std::string& reason)
    {
        json j = {
            {"v", bridge::PROTOCOL_VERSION}, {"t", bridge::MSG_LOGINRESULT},
            {"ok", ok}, {"reason", reason}
        };
        push(j.dump());
    }

    void UiBridge::emit_worlds(const std::vector<World>& worlds)
    {
        json arr = json::array();
        for (const World& w : worlds)
        {
            json loads = json::array();
            for (int32_t load : w.chloads)
            {
                loads.push_back(load);
            }
            arr.push_back({
                {"wid", w.wid},
                {"name", w.name},
                {"message", w.message},
                {"channelcount", w.channelcount},
                {"flag", w.flag},
                {"channelloads", loads}
            });
        }
        json j = {
            {"v", bridge::PROTOCOL_VERSION}, {"t", bridge::MSG_WORLDS},
            {"json", arr.dump()}
        };
        push(j.dump());
    }

    void UiBridge::emit_characters(const std::vector<CharEntry>& chars)
    {
        json arr = json::array();
        for (const CharEntry& c : chars)
        {
            const StatsEntry& s = c.stats;
            arr.push_back({
                {"cid", c.cid},
                {"name", s.name},
                {"level", s.stats[Maplestat::LEVEL]},
                {"job", s.stats[Maplestat::JOB]},
                {"str", s.stats[Maplestat::STR]},
                {"dex", s.stats[Maplestat::DEX]},
                {"int", s.stats[Maplestat::INT]},
                {"luk", s.stats[Maplestat::LUK]}
            });
        }
        json j = {
            {"v", bridge::PROTOCOL_VERSION}, {"t", bridge::MSG_CHARACTERS},
            {"json", arr.dump()}
        };
        push(j.dump());
    }

    void UiBridge::emit_asset(const std::string& key, const std::string& dataUrl)
    {
        json j = {
            {"v", bridge::PROTOCOL_VERSION}, {"t", bridge::MSG_ASSET},
            {"key", key}, {"dataUrl", dataUrl}
        };
        push(j.dump());
    }

    namespace
    {
        // Minimal standard-alphabet base64 encoder (no padding shortcuts, no deps).
        std::string base64_encode(const std::string& in)
        {
            static const char* tbl =
                "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
            std::string out;
            out.reserve(((in.size() + 2) / 3) * 4);

            size_t i = 0;
            const size_t n = in.size();
            while (i + 2 < n)
            {
                uint32_t v = (static_cast<uint8_t>(in[i]) << 16) |
                             (static_cast<uint8_t>(in[i + 1]) << 8) |
                             static_cast<uint8_t>(in[i + 2]);
                out.push_back(tbl[(v >> 18) & 0x3F]);
                out.push_back(tbl[(v >> 12) & 0x3F]);
                out.push_back(tbl[(v >> 6) & 0x3F]);
                out.push_back(tbl[v & 0x3F]);
                i += 3;
            }
            if (i < n)
            {
                uint32_t v = static_cast<uint8_t>(in[i]) << 16;
                bool two = (i + 1 < n);
                if (two)
                {
                    v |= static_cast<uint8_t>(in[i + 1]) << 8;
                }
                out.push_back(tbl[(v >> 18) & 0x3F]);
                out.push_back(tbl[(v >> 12) & 0x3F]);
                out.push_back(two ? tbl[(v >> 6) & 0x3F] : '=');
                out.push_back('=');
            }
            return out;
        }

        // stbi write callback: append encoded bytes to a std::string.
        void png_write_cb(void* context, void* data, int size)
        {
            std::string* out = static_cast<std::string*>(context);
            out->append(static_cast<const char*>(data), static_cast<size_t>(size));
        }

        // Follows the WZ "source" link on bitmap nodes the same way Texture does,
        // so linked icons (which store their pixels under the file root) resolve.
        nl::node resolve_bitmap_node(nl::node src)
        {
            std::string link = src["source"];
            if (!link.empty())
            {
                nl::node srcfile = src;
                while (srcfile != srcfile.root())
                {
                    srcfile = srcfile.root();
                }
                src = srcfile.resolve(link.substr(link.find('/') + 1));
            }
            return src;
        }

        // Equip category resolution, mirroring ItemData::get_eqcategory so the
        // equip kind resolves to the same nl::nx::character sub-node the
        // in-canvas inventory/tooltip code uses.
        std::string eq_category(int32_t id)
        {
            constexpr char const* names[15] =
            {
                "Cap",      "Accessory", "Accessory", "Accessory", "Coat",
                "Longcoat", "Pants",     "Shoes",     "Glove",     "Shield",
                "Cape",     "Ring",      "Accessory", "Accessory", "Accessory"
            };
            size_t index = (id / 10000) - 100;
            if (index < 15)
            {
                return names[index];
            }
            if (index >= 30 && index <= 70)
            {
                return "Weapon";
            }
            return "";
        }

        // Resolves a "<kind>/<id>" key to the WZ icon bitmap node, reusing the
        // exact nl::nx paths from Data/ItemData.cpp and Data/SkillData.cpp.
        nl::node resolve_icon_node(const std::string& kind, int32_t id)
        {
            if (kind == "skill")
            {
                // SkillData.cpp:33-39 — skill[<3-digit prefix>.img]["skill"][id]["icon"].
                std::string strid = string_format::extend_id(id, 7);
                nl::node src = nl::nx::skill[strid.substr(0, 3) + ".img"]["skill"][strid];
                return src["icon"];
            }

            // item / equip: mirror ItemData.cpp prefix switch.
            std::string strprefix = "0" + std::to_string(id / 10000);
            std::string strid = "0" + std::to_string(id);
            int32_t prefix = id / 1000000;
            nl::node src;
            switch (prefix)
            {
            case 1:
                src = nl::nx::character[eq_category(id)][strid + ".img"]["info"];
                break;
            case 2:
                src = nl::nx::item["Consume"][strprefix + ".img"][strid]["info"];
                break;
            case 3:
                src = nl::nx::item["Install"][strprefix + ".img"][strid]["info"];
                break;
            case 4:
                src = nl::nx::item["Etc"][strprefix + ".img"][strid]["info"];
                break;
            case 5:
                src = nl::nx::item["Cash"][strprefix + ".img"][strid]["info"];
                break;
            default:
                return nl::node();
            }
            // ItemData stores both "icon" (with shadow) and "iconRaw"; the DOM
            // wants the plain icon, falling back to iconRaw if absent.
            nl::node icon = src["icon"];
            if (!icon)
            {
                icon = src["iconRaw"];
            }
            return icon;
        }
    }

    void UiBridge::resolve_and_emit_asset(const std::string& key)
    {
        auto cached = asset_cache_.find(key);
        if (cached != asset_cache_.end())
        {
            emit_asset(key, cached->second);
            return;
        }

        std::string dataUrl;

        size_t slash = key.find('/');
        if (slash != std::string::npos)
        {
            std::string kind = key.substr(0, slash);
            int32_t id = string_conversion::or_default<int32_t>(key.substr(slash + 1), -1);

            if (id >= 0 && (kind == "item" || kind == "equip" || kind == "skill"))
            {
                nl::node iconnode = resolve_icon_node(kind, id);
                if (iconnode && iconnode.data_type() == nl::node::type::bitmap)
                {
                    nl::node bmpnode = resolve_bitmap_node(iconnode);
                    nl::bitmap bmp = bmpnode;
                    int w = bmp.width();
                    int h = bmp.height();
                    if (bmp.data() && w > 0 && h > 0)
                    {
                        // BGRA (game order) -> RGBA, matching GraphicsGL::addbitmap.
                        int len = w * h * 4;
                        std::vector<uint8_t> rgba(static_cast<size_t>(len));
                        const uint8_t* srcpx = static_cast<const uint8_t*>(bmp.data());
                        for (int i = 0; i < len; i += 4)
                        {
                            rgba[i] = srcpx[i + 2];
                            rgba[i + 1] = srcpx[i + 1];
                            rgba[i + 2] = srcpx[i];
                            rgba[i + 3] = srcpx[i + 3];
                        }

                        std::string png;
                        if (stbi_write_png_to_func(png_write_cb, &png, w, h, 4,
                                                   rgba.data(), w * 4) != 0 &&
                            !png.empty())
                        {
                            dataUrl = "data:image/png;base64," + base64_encode(png);
                        }
                    }
                }
            }
        }

        asset_cache_[key] = dataUrl;
        emit_asset(key, dataUrl);
    }

    void UiBridge::handle_command(const std::string& jsonstr)
    {
        json j = json::parse(jsonstr, nullptr, false);
        if (j.is_discarded() || !j.contains("t") || !j["t"].is_string())
        {
            Console::get().print("[bridge] dropped invalid command");
            return;
        }
        const std::string t = j["t"].get<std::string>();
        if (t == bridge::MSG_PING)
        {
            int nonce = j.value("nonce", 0);
            emit_pong(nonce);
        }
        else if (t == bridge::MSG_OPENWINDOW)
        {
            const std::string window = j.value("window", std::string());
            if (window == "stats")
            {
                UI::get().send_menu(KeyAction::CHARSTATS);
            }
            else if (window == "inventory")
            {
                UI::get().send_menu(KeyAction::INVENTORY);
            }
            else if (window == "equips")
            {
                UI::get().send_menu(KeyAction::EQUIPS);
            }
            else if (window == "skills")
            {
                UI::get().send_menu(KeyAction::SKILLBOOK);
            }
        }
        else if (t == bridge::MSG_SENDCHAT)
        {
            const std::string text = j.value("text", std::string());
            if (!text.empty())
            {
                GeneralChatPacket(text, true).dispatch();
            }
        }
        else if (t == bridge::MSG_LOGIN)
        {
            const std::string account = j.value("account", std::string());
            const std::string password = j.value("password", std::string());
            LoginPacket(account, password).dispatch();
        }
        else if (t == bridge::MSG_SELECTWORLD)
        {
            // Only record the selection here. The actual character-list request
            // is dispatched by MSG_REQUESTCHARLIST to avoid double-sending the
            // CHARLIST_REQUEST packet (the in-canvas flow sends it on "enter world").
            selected_world_ = static_cast<uint8_t>(j.value("world", 0));
            selected_channel_ = static_cast<uint8_t>(j.value("channel", 0));
        }
        else if (t == bridge::MSG_REQUESTCHARLIST)
        {
            uint8_t world = static_cast<uint8_t>(j.value("world", (int)selected_world_));
            uint8_t channel = static_cast<uint8_t>(j.value("channel", (int)selected_channel_));
            selected_world_ = world;
            selected_channel_ = channel;
            CharlistRequestPacket(world, channel).dispatch();
        }
        else if (t == bridge::MSG_SELECTCHAR)
        {
            int32_t cid = j.value("cid", 0);
            // Reuse the in-canvas UICharSelect selection path (incl. PIC "1010")
            // so the exact same packet sequence as the "Start" button is sent.
            if (auto charselect = UI::get().get_element<UICharSelect>())
            {
                charselect->select_character(cid);
            }
            else
            {
                Console::get().print("[bridge] selectChar: UICharSelect not available");
            }
        }
        else if (t == bridge::MSG_BACKTOLOGIN)
        {
            // Return to the login screen (relog). Mirror the in-canvas teardown:
            // drop entry-flow UIs and re-add the login screen.
            UI::get().remove(UIElement::WORLDSELECT);
            UI::get().remove(UIElement::CHARSELECT);
            UI::get().remove(UIElement::CHARCREATION);
            UI::get().emplace<UILogin>();
            UI::get().enable();
        }
        else if (t == bridge::MSG_REQUESTASSET)
        {
            const std::string assetkey = j.value("key", std::string());
            if (!assetkey.empty())
            {
                resolve_and_emit_asset(assetkey);
            }
        }
    }

    void UiBridge::poll_emit()
    {
        if (UI::get().get_state_game() == nullptr)
        {
            return;
        }
        const CharStats& st = Stage::get().get_player().get_stats();
        int hp = st.get_stat(Maplestat::HP);
        int mp = st.get_stat(Maplestat::MP);
        int maxhp = st.get_total(Equipstat::HP);
        int maxmp = st.get_total(Equipstat::MP);
        int level = st.get_stat(Maplestat::LEVEL);
        int64_t exp = st.get_exp();
        if (hp != hp_ || mp != mp_ || maxhp != maxhp_ || maxmp != maxmp_ ||
            level != level_ || exp != exp_)
        {
            hp_ = hp; mp_ = mp; maxhp_ = maxhp; maxmp_ = maxmp; level_ = level; exp_ = exp;
            emit_stats(hp, maxhp, mp, maxmp, level, exp);
        }

        const std::string& name = st.get_name();
        const std::string& job = st.get_jobname();
        if (name != name_ || job != job_)
        {
            name_ = name;
            job_ = job;
            emit_character(name, job);
        }
    }
}

#ifdef MS_PLATFORM_WASM
extern "C"
{
    EMSCRIPTEN_KEEPALIVE void maple_bridge_send(const char* json)
    {
        jrc::UiBridge::get().handle_command(json ? json : "");
    }
}
#endif

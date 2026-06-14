#include "UiBridge.h"
#include "UiBridgeProtocol.h"

#include "UI.h"
#include "KeyAction.h"

#include "../Console.h"
#include "../Constants.h"
#include "../Character/CharStats.h"
#include "../Character/ExpTable.h"
#include "../Character/Player.h"
#include "../Gameplay/Stage.h"
#include "../Net/Login.h"
#include "../Net/Packets/MessagingPackets.h"
#include "../Net/Packets/LoginPackets.h"
#include "../Net/Packets/PlayerPackets.h"
#include "../Net/Packets/InventoryPackets.h"
#include "../Audio/Audio.h"
#include "../Character/MapleStat.h"
#include "../Character/EquipStat.h"
#include "../Character/Inventory/Inventory.h"
#include "../Character/Inventory/InventoryType.h"
#include "../Character/Look/EquipSlot.h"
#include "../Character/SkillBook.h"
#include "UITypes/UICharSelect.h"
#include "UITypes/UILogin.h"
#include "UITypes/UINpcTalk.h"
#include "UITypes/UIShop.h"
#include "UITypes/UIBuffList.h"

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

#include <algorithm>
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

    void UiBridge::emit_stats(int hp, int maxhp, int mp, int maxmp, int level, int64_t exp, int64_t expNext)
    {
        json j = {
            {"v", bridge::PROTOCOL_VERSION}, {"t", bridge::MSG_STATS},
            {"hp", hp}, {"maxHp", maxhp}, {"mp", mp}, {"maxMp", maxmp},
            {"level", level}, {"exp", exp}, {"expNext", expNext}
        };
        push(j.dump());
    }

    void UiBridge::emit_stats_detail()
    {
        const CharStats& st = Stage::get().get_player().get_stats();

        // Mirror the exact values UIStatsInfo displays: primary stats and
        // secondary stats use get_total (the equip-modified total the in-canvas
        // window shows); HP/MP show current/max.
        json detail = {
            {"name", st.get_name()},
            {"job", st.get_jobname()},
            {"level", st.get_stat(Maplestat::LEVEL)},
            {"ap", st.get_stat(Maplestat::AP)},
            {"str", st.get_total(Equipstat::STR)},
            {"dex", st.get_total(Equipstat::DEX)},
            {"int", st.get_total(Equipstat::INT)},
            {"luk", st.get_total(Equipstat::LUK)},
            {"hp", st.get_stat(Maplestat::HP)},
            {"maxHp", st.get_total(Equipstat::HP)},
            {"mp", st.get_stat(Maplestat::MP)},
            {"maxMp", st.get_total(Equipstat::MP)},
            {"watk", st.get_total(Equipstat::WATK)},
            {"matk", st.get_total(Equipstat::MAGIC)},
            {"wdef", st.get_total(Equipstat::WDEF)},
            {"mdef", st.get_total(Equipstat::MDEF)},
            {"accuracy", st.get_total(Equipstat::ACC)},
            {"avoid", st.get_total(Equipstat::AVOID)},
            {"speed", st.get_total(Equipstat::SPEED)},
            {"jump", st.get_total(Equipstat::JUMP)}
        };

        std::string obj = detail.dump();
        if (obj == statsdetail_sig_)
        {
            return;
        }
        statsdetail_sig_ = obj;

        json j = {
            {"v", bridge::PROTOCOL_VERSION}, {"t", bridge::MSG_STATSDETAIL},
            {"json", obj}
        };
        push(j.dump());
    }

    void UiBridge::emit_inventory()
    {
        const Inventory& inv = Stage::get().get_player().get_inventory();

        // Tab id -> lowercased tab string for the DOM Inventory window. Mirrors
        // the InventoryType enum (NONE/EQUIP/USE/SETUP/ETC/CASH/EQUIPPED).
        struct TabDef { InventoryType::Id type; const char* name; };
        static const TabDef tabs[] = {
            { InventoryType::EQUIP, "equip" },
            { InventoryType::USE,   "use"   },
            { InventoryType::SETUP, "setup" },
            { InventoryType::ETC,   "etc"   },
            { InventoryType::CASH,  "cash"  }
        };

        json arr = json::array();
        for (const TabDef& tab : tabs)
        {
            int slotmax = inv.get_slotmax(tab.type);
            for (int16_t slot = 1; slot <= slotmax; ++slot)
            {
                int32_t itemid = inv.get_item_id(tab.type, slot);
                if (itemid == 0)
                {
                    continue;
                }
                arr.push_back({
                    {"tab", tab.name},
                    {"slot", slot},
                    {"itemid", itemid},
                    {"count", inv.get_item_count(tab.type, slot)}
                });
            }
        }

        int64_t meso = inv.get_meso();

        // Sign on items + meso so a meso change (pickups/drops) re-emits even
        // when the item layout is unchanged.
        std::string payload = arr.dump();
        std::string sig = payload + "|" + std::to_string(meso);
        if (sig == inventory_sig_)
        {
            return;
        }
        inventory_sig_ = sig;

        json j = {
            {"v", bridge::PROTOCOL_VERSION}, {"t", bridge::MSG_INVENTORY},
            {"json", payload}, {"meso", meso}
        };
        push(j.dump());
    }

    void UiBridge::emit_equipment()
    {
        const Inventory& inv = Stage::get().get_player().get_inventory();

        json arr = json::array();
        for (Equipslot::Id slot : Equipslot::values)
        {
            int32_t itemid = inv.get_item_id(InventoryType::EQUIPPED, slot);
            if (itemid == 0)
            {
                continue;
            }
            arr.push_back({
                {"slot", static_cast<int>(slot)},
                {"itemid", itemid}
            });
        }

        std::string payload = arr.dump();
        if (payload == equipment_sig_)
        {
            return;
        }
        equipment_sig_ = payload;

        json j = {
            {"v", bridge::PROTOCOL_VERSION}, {"t", bridge::MSG_EQUIPMENT},
            {"json", payload}
        };
        push(j.dump());
    }

    void UiBridge::emit_skills()
    {
        const Skillbook& skills = Stage::get().get_player().get_skills();

        json arr = json::array();
        for (const Skillbook::LearnedSkill& skill : skills.collect_skills())
        {
            arr.push_back({
                {"skillid", skill.id},
                {"level", skill.level},
                {"masterlevel", skill.masterlevel}
            });
        }

        std::string payload = arr.dump();
        if (payload == skills_sig_)
        {
            return;
        }
        skills_sig_ = payload;

        json j = {
            {"v", bridge::PROTOCOL_VERSION}, {"t", bridge::MSG_SKILLS},
            {"json", payload}
        };
        push(j.dump());
    }

    void UiBridge::emit_buffs(const std::vector<std::pair<int32_t, int32_t>>& buffs)
    {
        json arr = json::array();
        for (const auto& buff : buffs)
        {
            // The DOM buff bar resolves icons via the "skill/<id>" asset key,
            // so only skill-sourced buffs (positive ids) are surfaced. Negative
            // ids are item-sourced buffs the bar cannot key on yet.
            if (buff.first < 0)
            {
                continue;
            }
            // Round the remaining duration to whole seconds (in ms). The buff
            // duration decrements every engine tick, so emitting the raw value
            // would change the signature every frame and flood the bridge. The
            // DOM bar only shows second-granularity, so 1s buckets keep the
            // self-diff effective (≈1 push per buff per second).
            int32_t dur_s = buff.second > 0 ? (buff.second + 999) / 1000 : 0;
            arr.push_back({
                {"skillid", buff.first},
                {"duration", dur_s * 1000}
            });
        }

        std::string payload = arr.dump();
        if (payload == buffs_sig_)
        {
            return;
        }
        buffs_sig_ = payload;

        json j = {
            {"v", bridge::PROTOCOL_VERSION}, {"t", bridge::MSG_BUFFS},
            {"json", payload}
        };
        push(j.dump());
    }

    void UiBridge::emit_notice(const std::string& text, const std::string& ntype)
    {
        json payload = {
            {"text", text},
            {"ntype", ntype}
        };
        json j = {
            {"v", bridge::PROTOCOL_VERSION}, {"t", bridge::MSG_NOTICE},
            {"json", payload.dump()}
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

    void UiBridge::emit_shop(bool active, int32_t npcid, const std::vector<ShopEntry>& items)
    {
        json payload;
        payload["active"] = active;
        if (active)
        {
            payload["npcid"] = npcid;
            json arr = json::array();
            for (const ShopEntry& it : items)
            {
                arr.push_back({
                    {"slot", it.slot},
                    {"itemid", it.itemid},
                    {"price", it.price},
                    {"buyable", it.buyable}
                });
            }
            payload["items"] = arr;
        }
        else
        {
            // The DOM treats active:false as "no shop"; items is required by the
            // schema, so emit an empty list it can still validate.
            payload["items"] = json::array();
        }

        json j = {
            {"v", bridge::PROTOCOL_VERSION}, {"t", bridge::MSG_SHOP},
            {"json", payload.dump()}
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

    void UiBridge::emit_npc_dialog(
        bool active,
        int32_t npcid,
        const std::string& mode,
        const std::string& text,
        const std::vector<std::pair<int32_t, std::string>>& selections
    )
    {
        json payload;
        payload["active"] = active;
        if (active)
        {
            payload["npcid"] = npcid;
            payload["mode"] = mode;
            payload["text"] = text;
            if (!selections.empty())
            {
                json arr = json::array();
                for (const auto& sel : selections)
                {
                    arr.push_back({ {"idx", sel.first}, {"label", sel.second} });
                }
                payload["selections"] = arr;
            }
        }
        else
        {
            // The DOM treats active:false as "no dialog"; mode is required by the
            // schema, so emit a stable empty-ish payload it can still validate.
            payload["mode"] = "";
        }

        json j = {
            {"v", bridge::PROTOCOL_VERSION}, {"t", bridge::MSG_NPCDIALOG},
            {"json", payload.dump()}
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
            // Channel routing. "all" is map/general chat; party/guild/alliance
            // are server-routed group chats (recipient list left empty — Cosmic
            // resolves membership server-side); buddy carries recipient ids the
            // server forwards to; whisper targets a single named character.
            const std::string channel = j.value("channel", std::string("all"));
            const std::string target = j.value("target", std::string());
            if (!text.empty())
            {
                if (channel == "party")
                {
                    MultiChatPacket(MultiChatPacket::PARTY, {}, text).dispatch();
                }
                else if (channel == "guild")
                {
                    MultiChatPacket(MultiChatPacket::GUILD, {}, text).dispatch();
                }
                else if (channel == "alliance")
                {
                    MultiChatPacket(MultiChatPacket::ALLIANCE, {}, text).dispatch();
                }
                else if (channel == "buddy")
                {
                    MultiChatPacket(MultiChatPacket::BUDDY, {}, text).dispatch();
                }
                else if (channel == "whisper" && !target.empty())
                {
                    WhisperPacket(target, text).dispatch();
                }
                else
                {
                    GeneralChatPacket(text, true).dispatch();
                }
            }
        }
        else if (t == bridge::MSG_USEITEM)
        {
            // Double-click on an inventory item: equip an EQUIP item or consume
            // a USE item. Mirrors UIItemInventory::doubleclick.
            const std::string tabname = j.value("tab", std::string());
            const int16_t slot = static_cast<int16_t>(j.value("slot", 0));
            InventoryType::Id type = InventoryType::NONE;
            if (tabname == "equip") type = InventoryType::EQUIP;
            else if (tabname == "use") type = InventoryType::USE;
            else if (tabname == "setup") type = InventoryType::SETUP;
            else if (tabname == "etc") type = InventoryType::ETC;
            else if (tabname == "cash") type = InventoryType::CASH;

            const Inventory& inv = Stage::get().get_player().get_inventory();
            int32_t item_id = inv.get_item_id(type, slot);
            if (item_id != 0)
            {
                if (type == InventoryType::EQUIP)
                {
                    EquipItemPacket(slot, inv.find_equipslot(item_id)).dispatch();
                }
                else if (type == InventoryType::USE)
                {
                    // Skip throwing-stars/arrows/bullets, which aren't "used".
                    int32_t prefix = item_id / 10000;
                    if (prefix != 204 && prefix != 206 && prefix != 207)
                    {
                        UseItemPacket(slot, item_id).dispatch();
                    }
                }
            }
        }
        else if (t == bridge::MSG_SETBGMVOLUME)
        {
            int vol = j.value("value", 50);
            Music::set_bgmvolume(static_cast<uint8_t>(std::clamp(vol, 0, 100)));
        }
        else if (t == bridge::MSG_SETSFXVOLUME)
        {
            int vol = j.value("value", 50);
            Sound::set_sfxvolume(static_cast<uint8_t>(std::clamp(vol, 0, 100)));
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
        else if (t == bridge::MSG_ALLOCATEAP)
        {
            // Reuse the exact packet the in-canvas UIStatsInfo sends
            // (UIStatsInfo::send_apup -> SpendApPacket).
            const std::string stat = j.value("stat", std::string());
            bool valid = true;
            Maplestat::Id id = Maplestat::STR;
            if (stat == "str")      { id = Maplestat::STR; }
            else if (stat == "dex") { id = Maplestat::DEX; }
            else if (stat == "int") { id = Maplestat::INT; }
            else if (stat == "luk") { id = Maplestat::LUK; }
            else                    { valid = false; }

            if (valid)
            {
                SpendApPacket(id).dispatch();
            }
            else
            {
                Console::get().print("[bridge] allocateAp: unknown stat '" + stat + "'");
            }
        }
        else if (t == bridge::MSG_NPCRESPOND)
        {
            // Drive the live in-canvas NPC dialogue with the DOM modal's action.
            // UINpcTalk::respond reuses the exact button->packet send logic, so
            // lastmsg/mode bookkeeping stays correct. Ignore if no dialog exists.
            const std::string action = j.value("action", std::string());
            int32_t selection = j.value("selection", 0);
            const std::string text = j.value("text", std::string());
            if (auto npctalk = UI::get().get_element<UINpcTalk>())
            {
                npctalk->respond(action, selection, text);
            }
        }
        else if (t == bridge::MSG_SHOPACTION)
        {
            // Drive the live in-canvas UIShop with the DOM shop window's action.
            // UIShop::shop_action reuses the exact NpcShopActionPacket the
            // in-canvas buttons dispatch. Ignore if no shop is open.
            const std::string action = j.value("action", std::string());
            int16_t slot = static_cast<int16_t>(j.value("slot", 0));
            int32_t itemid = j.value("itemid", 0);
            int16_t quantity = static_cast<int16_t>(j.value("quantity", 1));
            if (auto shop = UI::get().get_element<UIShop>())
            {
                shop->shop_action(action, slot, itemid, quantity);
            }
            // Closing the shop from the DOM clears the DOM window immediately.
            if (action == "exit")
            {
                emit_shop(false, 0, {});
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
        // Exp required to reach the next level, so the DOM EXP gauge can render
        // a real fill ratio (exp / expNext). Zero past the level cap.
        int64_t expNext = (level >= 0 && static_cast<size_t>(level) < ExpTable::LEVELCAP)
            ? ExpTable::values[level]
            : 0;
        if (hp != hp_ || mp != mp_ || maxhp != maxhp_ || maxmp != maxmp_ ||
            level != level_ || exp != exp_)
        {
            hp_ = hp; mp_ = mp; maxhp_ = maxhp; maxmp_ = maxmp; level_ = level; exp_ = exp;
            emit_stats(hp, maxhp, mp, maxmp, level, exp, expNext);
        }

        const std::string& name = st.get_name();
        const std::string& job = st.get_jobname();
        if (name != name_ || job != job_)
        {
            name_ = name;
            job_ = job;
            emit_character(name, job);
        }

        // Detailed stats for the DOM Stats window. Self-diffs via an internal
        // signature, so this only pushes a message when the detail set changes.
        emit_stats_detail();

        // Inventory + equipped items for the DOM Inventory/Equipment windows.
        // Both self-diff via a serialized-payload signature, so they only push
        // a message when the contents actually change.
        emit_inventory();
        emit_equipment();

        // Learned skills for the DOM Skills window. Self-diffs via an internal
        // signature, so this only pushes a message when the skill set changes.
        emit_skills();

        // Active buffs for the DOM buff-icon bar. Read from the in-canvas
        // UIBuffList (populated by ApplyBuffHandler) and self-diffed via a
        // serialized-payload signature, so this only pushes when the buff set
        // (or rounded durations) actually change frame-to-frame.
        if (auto bufflist = UI::get().get_element<UIBuffList>())
        {
            emit_buffs(bufflist->get_buffs());
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

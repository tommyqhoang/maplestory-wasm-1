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

#include "json/json.hpp"

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

#include "UiBridge.h"
#include "UiBridgeProtocol.h"

#include "UI.h"
#include "KeyAction.h"

#include "../Console.h"
#include "../Constants.h"
#include "../Character/CharStats.h"
#include "../Character/Player.h"
#include "../Gameplay/Stage.h"
#include "../Net/Packets/MessagingPackets.h"

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

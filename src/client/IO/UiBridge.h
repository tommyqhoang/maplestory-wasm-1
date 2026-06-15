//////////////////////////////////////////////////////////////////////////////
// MapleBridge: typed, versioned message bus between the WASM engine and the
// React/TS DOM UI. C++ emits state (emit_*), JS sends commands (maple_bridge_send).
//////////////////////////////////////////////////////////////////////////////
#pragma once
#include "../Template/Singleton.h"
#include "../Net/Login.h"

#include <cstdint>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

namespace jrc
{
    class UiBridge : public Singleton<UiBridge>
    {
    public:
        UiBridge();

        // Called once per engine tick: diff cached state and emit on change.
        void poll_emit();

        void emit_scene(const std::string& name);
        void emit_stats(int hp, int maxhp, int mp, int maxmp, int level, int64_t exp, int64_t expNext);
        // Builds and emits the detailed stats payload (StatsDetail) consumed by
        // the DOM Stats window. Reads from the live player CharStats.
        void emit_stats_detail();
        // Builds and emits the inventory payload (item id + count per occupied
        // slot, per tab) consumed by the DOM Inventory window. Self-diffs.
        void emit_inventory();
        // Builds and emits the equipped-items payload (item id per equip slot)
        // consumed by the DOM Equipment window. Self-diffs.
        void emit_equipment();
        // Builds and emits the learned-skills payload (skill id + level +
        // master level) consumed by the DOM Skills window. Self-diffs.
        void emit_skills();
        // Builds and emits the active-buffs payload (skill id + remaining
        // duration in ms per active buff) consumed by the DOM buff-icon bar.
        // Self-diffs via a serialized-payload signature. The buff source is the
        // in-canvas UIBuffList, which is populated by ApplyBuffHandler.
        void emit_buffs(const std::vector<std::pair<int32_t, int32_t>>& buffs);
        // Pushes a transient system notice to the DOM notification toasts.
        // Additive: callers also keep the existing in-canvas message. ntype is
        // a free-form category string (defaults to "system" on the DOM side).
        void emit_notice(const std::string& text, const std::string& ntype = "system");
        void emit_character(const std::string& name, const std::string& job);
        void emit_chat(const std::string& line, int ctype);
        void emit_pong(int nonce);
        // Notifies the DOM that the game connection changed (status "lost" when
        // the socket drops). Lets the UI surface a disconnect overlay since the
        // native loop halts on a dropped socket.
        void emit_connection(const std::string& status);

        // Entry-flow (login / world select / character select) emits.
        void emit_login_result(int ok, const std::string& reason);
        void emit_worlds(const std::vector<World>& worlds);
        void emit_characters(const std::vector<CharEntry>& chars);

        // Pushes the current NPC dialogue state to the DOM modal. When active
        // is false the other fields are ignored (the DOM clears the modal).
        // selections carries the parsed menu options as (idx, label) pairs for
        // SELECTION-mode dialogues.
        void emit_npc_dialog(
            bool active,
            int32_t npcid,
            const std::string& mode,
            const std::string& text,
            const std::vector<std::pair<int32_t, std::string>>& selections
        );

        // A single buyable entry for the DOM NPC shop window.
        struct ShopEntry
        {
            int16_t slot;
            int32_t itemid;
            int32_t price;
            bool buyable;
        };

        // Pushes the current NPC shop state to the DOM shop window. When active
        // is false the other fields are ignored (the DOM clears the window).
        void emit_shop(bool active, int32_t npcid, const std::vector<ShopEntry>& items);

        // Sends a WZ-sourced icon to the DOM as a PNG data URL (or "" if the
        // asset could not be resolved). Keyed by the original requestAsset key.
        void emit_asset(const std::string& key, const std::string& dataUrl);

        // Dispatch an inbound command (JSON) from JS. Tolerant of bad input.
        void handle_command(const std::string& json);

    private:
        void push(const std::string& payload);

        std::string scene_;
        int hp_ = -1, maxhp_ = -1, mp_ = -1, maxmp_ = -1, level_ = -1;
        int64_t exp_ = -1;
        std::string name_;
        std::string job_;

        // Serialized signature of the last emitted StatsDetail payload, used to
        // suppress redundant emits (the detail set changes on level-up, AP
        // spend, equip changes, buffs, etc.).
        std::string statsdetail_sig_;

        // Serialized signatures of the last emitted inventory / equipment
        // payloads, used to suppress redundant emits.
        std::string inventory_sig_;
        std::string equipment_sig_;
        std::string skills_sig_;
        std::string buffs_sig_;

        // Entry-flow selection state (set by selectWorld, used by requestCharlist).
        uint8_t selected_world_ = 0;
        uint8_t selected_channel_ = 0;

        // Encodes the WZ icon for a "<kind>/<id>" key to a PNG data URL and
        // emits it. Resolves item/equip/skill icons via the same nl::nx paths
        // the in-canvas UI uses. Results are cached so repeats are cheap and a
        // reconnecting DOM can re-request without re-encoding.
        void resolve_and_emit_asset(const std::string& key);
        std::unordered_map<std::string, std::string> asset_cache_;
    };
}

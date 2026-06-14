//////////////////////////////////////////////////////////////////////////////
// MapleBridge: typed, versioned message bus between the WASM engine and the
// React/TS DOM UI. C++ emits state (emit_*), JS sends commands (maple_bridge_send).
//////////////////////////////////////////////////////////////////////////////
#pragma once
#include "../Template/Singleton.h"

#include <cstdint>
#include <string>

namespace jrc
{
    class UiBridge : public Singleton<UiBridge>
    {
    public:
        UiBridge();

        // Called once per engine tick: diff cached state and emit on change.
        void poll_emit();

        void emit_scene(const std::string& name);
        void emit_stats(int hp, int maxhp, int mp, int maxmp, int level, int64_t exp);
        void emit_pong(int nonce);

        // Dispatch an inbound command (JSON) from JS. Tolerant of bad input.
        void handle_command(const std::string& json);

    private:
        void push(const std::string& payload);

        std::string scene_;
        int hp_ = -1, maxhp_ = -1, mp_ = -1, maxmp_ = -1, level_ = -1;
        int64_t exp_ = -1;
    };
}

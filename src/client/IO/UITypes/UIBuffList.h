//////////////////////////////////////////////////////////////////////////////
// This file is part of the Journey MMORPG client                           //
// Copyright © 2015-2016 Daniel Allendorf                                   //
//                                                                          //
// This program is free software: you can redistribute it and/or modify     //
// it under the terms of the GNU Affero General Public License as           //
// published by the Free Software Foundation, either version 3 of the       //
// License, or (at your option) any later version.                          //
//                                                                          //
// This program is distributed in the hope that it will be useful,          //
// but WITHOUT ANY WARRANTY; without even the implied warranty of           //
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the            //
// GNU Affero General Public License for more details.                      //
//                                                                          //
// You should have received a copy of the GNU Affero General Public License //
// along with this program.  If not, see <http://www.gnu.org/licenses/>.    //
//////////////////////////////////////////////////////////////////////////////
#pragma once
#include "../UIElement.h"

#include "../Components/IconCover.h"

#include "../../Constants.h"
#include "../../Graphics/Texture.h"

#include <cstdint>
#include <unordered_map>
#include <utility>
#include <vector>

namespace jrc
{
    class BuffIcon
    {
    public:
        BuffIcon(int32_t buff, int32_t dur);

        void draw(Point<int16_t> position, float alpha) const;
        bool update();

        int32_t get_buffid() const;
        int32_t get_duration() const;

    private:
        static const uint16_t FLASH_TIME = 3'000;

        Texture icon;
        IconCover cover;
        int32_t buffid;
        int32_t duration;
        Linear<float> opacity;
        float opcstep;
    };


    class UIBuffList : public UIElement
    {
    public:
        static constexpr Type TYPE = BUFFLIST;
        static constexpr bool FOCUSED = false;
        static constexpr bool TOGGLED = false;

        UIBuffList();

        void draw(float inter) const override;
        void update() override;
        void update_screen(int16_t new_width, int16_t new_height) override;
        CursorResult send_cursor(bool pressed, Point<int16_t> position) override;

        void add_buff(int32_t buffid, int32_t duration);

        // Snapshot of the currently active buffs as (buffid, remaining-duration)
        // pairs. buffid > 0 is a skill id; buffid < 0 is an item-sourced buff
        // (encoded as -itemid). Consumed by UiBridge::poll_emit for the DOM
        // buff-icon bar.
        std::vector<std::pair<int32_t, int32_t>> get_buffs() const;

    private:
        std::unordered_map<int32_t, BuffIcon> icons;
    };
}

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
#include "GraphicsGL.h"

#include "../Configuration.h"
#include "../Console.h"

#ifdef MS_PLATFORM_WASM
#include <emscripten.h>
#endif

#include <algorithm>
#include <cmath>
#include <vector>

namespace jrc
{
    GraphicsGL::GraphicsGL()
    {
        locked = false;

        fontymax = 0;
        supersample = 1;
        scenefbo = 0;
        scenetex = 0;
        upscale_vbo = 0;
        upscale_program = 0;
        upscale_attribute_pos = -1;
        upscale_uniform_outsize = -1;
        outputwidth = Constants::VIEWWIDTH;
        outputheight = Constants::VIEWHEIGHT;
    }

    Error GraphicsGL::init()
    {
        if (glewInit())
        {
            return Error::GLEW;
        }

        if (FT_Init_FreeType(&ftlibrary))
        {
            return Error::FREETYPE;
        }

#ifdef MS_PLATFORM_WASM
        // Start at the highest quality: render the scene supersampled at the
        // maximum factor so sprites and text stay crisp when upscaled to any
        // display. Fixed for the session since fonts bake into the atlas.
        // (Previously this scaled down to match the screen, which left smaller
        // or low-DPI displays rendering at a soft 1x-2x.)
        constexpr GLshort MAX_SUPERSAMPLE = 4;
        supersample = MAX_SUPERSAMPLE;
#endif

        GLint result = GL_FALSE;

        GLuint vs = glCreateShader(GL_VERTEX_SHADER);
        const char *vs_source =
            "precision highp float;\n"
            "attribute vec4 coord;"
            "attribute vec4 color;"
            "varying vec2 texpos;"
            "varying vec4 colormod;"
            "uniform vec2 screensize;"
            "uniform int yoffset;"

            "void main(void) {"
            "    float x = -1.0 + coord.x * 2.0 / screensize.x;"
            "    float y = 1.0 - (coord.y + float(yoffset)) * 2.0 / screensize.y;"
            "    gl_Position = vec4(x, y, 0.0, 1.0);"
            "    texpos = coord.zw;"
            "    colormod = color;"
            "}";
        glShaderSource(vs, 1, &vs_source, NULL);
        glCompileShader(vs);
        glGetShaderiv(vs, GL_COMPILE_STATUS, &result);
        if (!result)
        {
            char infoLog[512];
            glGetShaderInfoLog(vs, 512, NULL, infoLog);
            Console::get().print("Vertex shader compilation failed: " + std::string(infoLog));
            return Error::VERTEX_SHADER;
        }

        GLuint fs = glCreateShader(GL_FRAGMENT_SHADER);
        const char *fs_source =
            "precision mediump float;\n"
            "varying vec2 texpos;"
            "varying vec4 colormod;"
            "uniform sampler2D texture;"
            "uniform vec2 atlassize;"
            "uniform int fontregion;"

            "void main(void) {"
            "    if (texpos.y == 0.0) {"
            "        gl_FragColor = colormod;"
            "    } else if (texpos.y <= float(fontregion)) {"
            "        gl_FragColor = vec4(1.0, 1.0, 1.0, texture2D(texture, texpos / atlassize).r) * colormod;"
            "    } else {"
            "        gl_FragColor = texture2D(texture, texpos / atlassize) * colormod;"
            "    }"
            "}";
        glShaderSource(fs, 1, &fs_source, NULL);
        glCompileShader(fs);
        glGetShaderiv(fs, GL_COMPILE_STATUS, &result);
        if (!result)
        {
            char infoLog[512];
            glGetShaderInfoLog(fs, 512, NULL, infoLog);
            Console::get().print("Fragment shader compilation failed: " + std::string(infoLog));
            return Error::FRAGMENT_SHADER;
        }

        program = glCreateProgram();
        glAttachShader(program, vs);
        glAttachShader(program, fs);
        glLinkProgram(program);
        glGetProgramiv(program, GL_LINK_STATUS, &result);
        if (!result)
        {
            return Error::SHADER_PROGRAM;
        }

        attribute_coord    = glGetAttribLocation(program, "coord");
        attribute_color    = glGetAttribLocation(program, "color");
        uniform_texture    = glGetUniformLocation(program, "texture");
        uniform_atlassize  = glGetUniformLocation(program, "atlassize");
        uniform_screensize = glGetUniformLocation(program, "screensize");
        uniform_yoffset    = glGetUniformLocation(program, "yoffset");
        uniform_fontregion = glGetUniformLocation(program, "fontregion");
        if (
            attribute_coord    == -1 ||
            attribute_color    == -1 ||
            uniform_texture    == -1 ||
            uniform_atlassize  == -1 ||
            uniform_yoffset    == -1 ||
            uniform_screensize == -1
        ) {
            return Error::SHADER_VARS;
        }

        glGenBuffers(1, &vbo);
        glGenBuffers(1, &ibo);

#ifdef MS_PLATFORM_WASM
        // The scene is rendered at the fixed game resolution into an offscreen
        // buffer, then upscaled to the canvas backing store with a
        // sharp-bilinear shader so non-integer scale factors stay crisp.
        GLuint ups_vs = glCreateShader(GL_VERTEX_SHADER);
        const char* ups_vs_source =
            "precision highp float;\n"
            "attribute vec2 pos;"
            "varying vec2 texuv;"

            "void main(void) {"
            "    texuv = pos * 0.5 + 0.5;"
            "    gl_Position = vec4(pos, 0.0, 1.0);"
            "}";
        glShaderSource(ups_vs, 1, &ups_vs_source, NULL);
        glCompileShader(ups_vs);
        glGetShaderiv(ups_vs, GL_COMPILE_STATUS, &result);
        if (!result)
        {
            char infoLog[512];
            glGetShaderInfoLog(ups_vs, 512, NULL, infoLog);
            Console::get().print("Upscale vertex shader compilation failed: " + std::string(infoLog));
            return Error::VERTEX_SHADER;
        }

        GLuint ups_fs = glCreateShader(GL_FRAGMENT_SHADER);
        const char* ups_fs_source =
            "precision highp float;\n"
            "varying vec2 texuv;"
            "uniform sampler2D scene;"
            "uniform vec2 texsize;"
            "uniform vec2 outsize;"

            // Sharp bilinear: snap to texel centers and only interpolate in a
            // one-output-pixel band around texel seams.
            "void main(void) {"
            "    vec2 scale = max(outsize / texsize, vec2(1.0, 1.0));"
            "    vec2 pix = texuv * texsize - 0.5;"
            "    vec2 base = floor(pix);"
            "    vec2 frac = clamp((pix - base - 0.5) * scale + 0.5, 0.0, 1.0);"
            "    gl_FragColor = texture2D(scene, (base + 0.5 + frac) / texsize);"
            "}";
        glShaderSource(ups_fs, 1, &ups_fs_source, NULL);
        glCompileShader(ups_fs);
        glGetShaderiv(ups_fs, GL_COMPILE_STATUS, &result);
        if (!result)
        {
            char infoLog[512];
            glGetShaderInfoLog(ups_fs, 512, NULL, infoLog);
            Console::get().print("Upscale fragment shader compilation failed: " + std::string(infoLog));
            return Error::FRAGMENT_SHADER;
        }

        upscale_program = glCreateProgram();
        glAttachShader(upscale_program, ups_vs);
        glAttachShader(upscale_program, ups_fs);
        glLinkProgram(upscale_program);
        glGetProgramiv(upscale_program, GL_LINK_STATUS, &result);
        if (!result)
        {
            return Error::SHADER_PROGRAM;
        }

        upscale_attribute_pos = glGetAttribLocation(upscale_program, "pos");
        upscale_uniform_outsize = glGetUniformLocation(upscale_program, "outsize");
        GLint upscale_uniform_scene = glGetUniformLocation(upscale_program, "scene");
        GLint upscale_uniform_texsize = glGetUniformLocation(upscale_program, "texsize");
        if (
            upscale_attribute_pos == -1 ||
            upscale_uniform_outsize == -1 ||
            upscale_uniform_texsize == -1
        ) {
            return Error::SHADER_VARS;
        }

        const GLsizei scenew = supersample * Constants::VIEWWIDTH;
        const GLsizei sceneh = supersample * Constants::VIEWHEIGHT;

        glUseProgram(upscale_program);
        glUniform1i(upscale_uniform_scene, 0);
        glUniform2f(upscale_uniform_texsize, scenew, sceneh);
        glUniform2f(upscale_uniform_outsize, outputwidth, outputheight);

        static const GLfloat fullscreen_quad[] = {
            -1.0f, -1.0f,
             1.0f, -1.0f,
            -1.0f,  1.0f,
             1.0f,  1.0f
        };
        glGenBuffers(1, &upscale_vbo);
        glBindBuffer(GL_ARRAY_BUFFER, upscale_vbo);
        glBufferData(GL_ARRAY_BUFFER, sizeof(fullscreen_quad), fullscreen_quad, GL_STATIC_DRAW);
        glBindBuffer(GL_ARRAY_BUFFER, 0);

        glGenTextures(1, &scenetex);
        glBindTexture(GL_TEXTURE_2D, scenetex);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        glTexImage2D(
            GL_TEXTURE_2D, 0, GL_RGBA, scenew, sceneh, 0,
            GL_RGBA, GL_UNSIGNED_BYTE, nullptr
        );

        glGenFramebuffers(1, &scenefbo);
        glBindFramebuffer(GL_FRAMEBUFFER, scenefbo);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, scenetex, 0);
        if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        {
            Console::get().print("Scene framebuffer is incomplete.");
            return Error::SHADER_PROGRAM;
        }
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
#endif

        glGenTextures(1, &atlas);
        glBindTexture(GL_TEXTURE_2D, atlas);
        glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
        glTexImage2D(
            GL_TEXTURE_2D, 0, GL_RGBA, ATLASW, ATLASH, 0,
            GL_RGBA, GL_UNSIGNED_BYTE, nullptr
        );

        fontborder.set_y(1);

        std::string font_normal = Setting<FontPathNormal>().get().load();
        std::string font_bold = Setting<FontPathBold>().get().load();
        if (font_normal.empty() || font_bold.empty())
        {
            Console::get().print(
                "Warning: A font path is empty, check your settings file."
            );
        }

        constexpr const char* FALLBACK_FONT_NORMAL = "/fonts/Arial/Arial.ttf";
        constexpr const char* FALLBACK_FONT_BOLD = "/fonts/Arial/Arial-Bold.ttf";

        if (font_normal.empty())
        {
            font_normal = FALLBACK_FONT_NORMAL;
        }
        if (font_bold.empty())
        {
            font_bold = FALLBACK_FONT_BOLD;
        }

        auto load_font = [&](const std::string& configured_path,
                             const char* fallback_path,
                             Text::Font id,
                             FT_UInt pixelw,
                             FT_UInt pixelh) {
            if (addfont(configured_path.c_str(), id, pixelw, pixelh))
            {
                return;
            }

            if (configured_path != fallback_path &&
                addfont(fallback_path, id, pixelw, pixelh))
            {
                Console::get().print(
                    "Failed to load font '" + configured_path +
                    "', using fallback '" + std::string(fallback_path) + "'."
                );
                return;
            }

            Console::get().print(
                "Failed to load font '" + configured_path +
                "' and fallback '" + std::string(fallback_path) + "'."
            );
        };

        load_font(font_normal, FALLBACK_FONT_NORMAL, Text::A11L, 0, 11);
        load_font(font_normal, FALLBACK_FONT_NORMAL, Text::A11M, 0, 11);
        load_font(font_bold,   FALLBACK_FONT_BOLD,   Text::A11B, 0, 11);
        load_font(font_normal, FALLBACK_FONT_NORMAL, Text::A12M, 0, 12);
        load_font(font_bold,   FALLBACK_FONT_BOLD,   Text::A12B, 0, 12);
        load_font(font_normal, FALLBACK_FONT_NORMAL, Text::A13M, 0, 13);
        load_font(font_bold,   FALLBACK_FONT_BOLD,   Text::A13B, 0, 13);
        load_font(font_normal, FALLBACK_FONT_NORMAL, Text::A18M, 0, 18);

        leftovers = QuadTree<size_t, Leftover>([](const Leftover& first, const Leftover& second) {
            bool wcomp = first.width() >= second.width();
            bool hcomp = first.height() >= second.height();
            if (wcomp && hcomp)
            {
                return QuadTree<size_t, Leftover>::RIGHT;
            }
            else if (wcomp)
            {
                return QuadTree<size_t, Leftover>::DOWN;
            }
            else if (hcomp)
            {
                return QuadTree<size_t, Leftover>::UP;
            }
            else
            {
                return QuadTree<size_t, Leftover>::LEFT;
            }
        });

        return Error::NONE;
    }

    bool GraphicsGL::addfont(const char* name, Text::Font id, FT_UInt pixelw, FT_UInt pixelh)
    {
        FT_Face face;
        if (FT_New_Face(ftlibrary, name, 0, &face))
        {
            return false;
        }

        // Glyphs rasterize at supersample x detail but lay out in game pixels,
        // so bitmaps are padded to supersample multiples for an exact mapping.
        const GLshort ss = supersample;
        if (FT_Set_Pixel_Sizes(face, pixelw * ss, pixelh * ss))
        {
            return false;
        }

        FT_GlyphSlot g = face->glyph;

        auto pad = [ss](GLshort texels) {
            return static_cast<GLshort>(((texels + ss - 1) / ss) * ss);
        };

        GLshort width  = 0;
        GLshort height = 0;
        for (uint8_t c = 32; c < 128; ++c)
        {
            if (FT_Load_Char(face, c, FT_LOAD_RENDER))
                continue;

            GLshort w = pad(static_cast<GLshort>(g->bitmap.width));
            GLshort h = pad(static_cast<GLshort>(g->bitmap.rows));

            width += w;
            if (h > height)
            {
                height = h;
            }
        }

        if (fontborder.x() + width > ATLASW)
        {
            // Start a new row below everything placed so far.
            fontborder.set_x(0);
            fontborder.set_y(fontymax);
        }

        GLshort x = fontborder.x();
        GLshort y = fontborder.y();

        fontborder.shift_x(width);
        if (y + height > fontymax)
        {
            fontymax = y + height;
        }

        fonts[id] = Font(width / ss, height / ss);

        GLshort ox = x;
        GLshort oy = y;
        for (uint8_t c = 32; c < 128; ++c)
        {
            if (FT_Load_Char(face, c, FT_LOAD_RENDER))
            {
                continue;
            }

            // Layout metrics in game pixels; texture rect in atlas texels.
            GLshort ax = static_cast<GLshort>(std::lround(static_cast<double>(g->advance.x >> 6) / ss));
            GLshort ay = static_cast<GLshort>(std::lround(static_cast<double>(g->advance.y >> 6) / ss));
            GLshort l  = static_cast<GLshort>(std::lround(static_cast<double>(g->bitmap_left) / ss));
            GLshort t  = static_cast<GLshort>(std::lround(static_cast<double>(g->bitmap_top) / ss));
            GLshort w  = static_cast<GLshort>(g->bitmap.width);
            GLshort h  = static_cast<GLshort>(g->bitmap.rows);
            GLshort wpad = pad(w);
            GLshort hpad = pad(h);

            if (w > 0 && h > 0)
            {
#ifdef MS_PLATFORM_WASM
                // WebGL path: expand single-channel glyph bitmap to RGBA,
                // zero-padded to the supersample-aligned cell.
                std::vector<uint8_t> rgba_buffer(static_cast<size_t>(wpad) * hpad * 4, 0);
                for (int32_t row = 0; row < h; ++row)
                {
                    for (int32_t col = 0; col < w; ++col)
                    {
                        uint8_t val = g->bitmap.buffer[row * g->bitmap.pitch + col];
                        size_t base = (static_cast<size_t>(row) * wpad + col) * 4;
                        rgba_buffer[base + 0] = val;
                        rgba_buffer[base + 1] = val;
                        rgba_buffer[base + 2] = val;
                        rgba_buffer[base + 3] = val;
                    }
                }
                glTexSubImage2D(
                    GL_TEXTURE_2D, 0, ox, oy, wpad, hpad,
                    GL_RGBA, GL_UNSIGNED_BYTE, rgba_buffer.data()
                );
#else
                glTexSubImage2D(
                    GL_TEXTURE_2D, 0, ox, oy, w, h,
                    GL_RED, GL_UNSIGNED_BYTE, g->bitmap.buffer
                );
#endif
            }

            Offset offset = Offset(ox, oy, wpad, hpad);
            fonts[id].chars[c] = { ax, ay,
                static_cast<GLshort>(wpad / ss), static_cast<GLshort>(hpad / ss),
                l, t, offset };

            ox += wpad;
        }

        return true;
    }

    void GraphicsGL::reinit()
    {
        glUseProgram(program);

        glUniform1i(uniform_yoffset, Constants::VIEWYOFFSET);
        glUniform1i(uniform_fontregion, fontymax);
        glUniform2f(uniform_atlassize, ATLASW, ATLASH);
        glUniform2f(uniform_screensize, Constants::viewwidth(), Constants::viewheight());

        glBindBuffer(GL_ARRAY_BUFFER, vbo);
        glVertexAttribPointer(attribute_coord, 4, GL_SHORT, GL_FALSE, sizeof(Quad::Vertex), 0);
        glVertexAttribPointer(attribute_color, 4, GL_FLOAT, GL_FALSE, sizeof(Quad::Vertex), (const void*)8);

        glEnable(GL_BLEND);
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);

        glBindTexture(GL_TEXTURE_2D, atlas);
        glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);

        clearinternal();
    }

    void GraphicsGL::set_screensize(int16_t width, int16_t height)
    {
        glUseProgram(program);
        glUniform2f(uniform_screensize, width, height);
    }

    void GraphicsGL::set_outputsize(int32_t width, int32_t height)
    {
        if (width <= 0 || height <= 0)
        {
            return;
        }

        outputwidth = width;
        outputheight = height;

#ifdef MS_PLATFORM_WASM
        if (upscale_program)
        {
            glUseProgram(upscale_program);
            glUniform2f(upscale_uniform_outsize, width, height);
            glUseProgram(program);
        }
#endif
    }

    Rectangle<int16_t> GraphicsGL::screen()
    {
        return {
            0,
            Constants::viewwidth(),
            -Constants::VIEWYOFFSET,
            static_cast<int16_t>(-Constants::VIEWYOFFSET + Constants::viewheight())
        };
    }

    void GraphicsGL::clearinternal()
    {
        border = Point<GLshort>(0, fontymax);
        yrange = Range<GLshort>();

        offsets.clear();
        leftovers.clear();
        rlid   = 1;
        wasted = 0;

        // The atlas was just reset, so any HD overrides need re-placing.
        reload_hd();
    }

    void GraphicsGL::clear()
    {
        size_t used = ATLASW * border.y() + border.x() * yrange.second();
        double usedpercent = static_cast<double>(used) / (ATLASW * ATLASH);
        if (usedpercent > 80.0)
        {
            clearinternal();
        }
    }

    void GraphicsGL::addbitmap(const nl::bitmap& bmp)
    {
        getoffset(bmp);
    }

    Point<GLshort> GraphicsGL::reserve_atlas(GLshort w, GLshort h)
    {
        GLshort x = 0;
        GLshort y = 0;

        auto value = Leftover(x, y, w, h);
        size_t lid = leftovers.findnode(value, [](const Leftover& val, const Leftover& leaf){
            return val.width() <= leaf.width() && val.height() <= leaf.height();
        });

        if (lid > 0)
        {
            const Leftover& leftover = leftovers[lid];

            x = leftover.l;
            y = leftover.t;

            GLshort wdelta = leftover.width() - w;
            GLshort hdelta = leftover.height() - h;

            leftovers.erase(lid);

            wasted -= w * h;

            if (wdelta >= MINLOSIZE && hdelta >= MINLOSIZE)
            {
                leftovers.add(rlid, Leftover(x + w, y + h, wdelta, hdelta));
                rlid++;

                if (w >= MINLOSIZE)
                {
                    leftovers.add(rlid, Leftover(x, y + h, w, hdelta));
                    rlid++;
                }

                if (h >= MINLOSIZE)
                {
                    leftovers.add(rlid, Leftover(x + w, y, wdelta, h));
                    rlid++;
                }
            }
            else if (wdelta >= MINLOSIZE)
            {
                leftovers.add(rlid, Leftover(x + w, y, wdelta, h + hdelta));
                rlid++;
            }
            else if (hdelta >= MINLOSIZE)
            {
                leftovers.add(rlid, Leftover(x, y + h, w + wdelta, hdelta));
                rlid++;
            }
        }
        else
        {
            if (border.x() + w > ATLASW)
            {
                border.set_x(0);
                border.shift_y(yrange.second());
                if (border.y() + h > ATLASH)
                {
                    clearinternal();
                }
                else
                {
                    yrange = Range<GLshort>();
                }
            }
            x = border.x();
            y = border.y();

            border.shift_x(w);

            if (h > yrange.second())
            {
                if (x >= MINLOSIZE && h - yrange.second() >= MINLOSIZE)
                {
                    leftovers.add(rlid, Leftover(0, yrange.first(), x, h - yrange.second()));
                    rlid++;
                }

                wasted += x * (h - yrange.second());

                yrange = { y + h, h };
            }
            else if (h < yrange.first() - y)
            {
                if (w >= MINLOSIZE && yrange.first() - y - h >= MINLOSIZE)
                {
                    leftovers.add(rlid, Leftover(x, y + h, w, yrange.first() - y - h));
                    rlid++;
                }

                wasted += w * (yrange.first() - y - h);
            }
        }

        return { x, y };
    }

    const GraphicsGL::Offset& GraphicsGL::getoffset(const nl::bitmap& bmp)
    {
        size_t id = bmp.id();
        auto offiter = offsets.find(id);
        if (offiter != offsets.end())
        {
            return offiter->second;
        }

        GLshort w = bmp.width();
        GLshort h = bmp.height();

        if (w <= 0 || h <= 0)
        {
            return nulloffset;
        }

        if (!bmp.data())
        {
            return nulloffset;
        }

        Point<GLshort> atlaspos = reserve_atlas(w, h);
        GLshort x = atlaspos.x();
        GLshort y = atlaspos.y();

        /*
        size_t used = ATLASW * border.y() + border.x() * yrange.second();
        double usedpercent = static_cast<double>(used) / (ATLASW * ATLASH);
        double wastedpercent = static_cast<double>(wasted) / used;
        Console::get().print("Used: " + std::to_string(usedpercent) + ", wasted: " + std::to_string(wastedpercent));
        */

#ifdef MS_PLATFORM_WASM
        // WebGL 2 does not support GL_BGRA, so we need to manually swap the channels
        // from BGRA (what the game uses) to RGBA (what WebGL expects).
        int32_t len = w * h * 4;
        std::vector<uint8_t> rgba_buffer(len);
        const uint8_t* src = (const uint8_t*)bmp.data();
        for (int i = 0; i < len; i += 4)
        {
            rgba_buffer[i] = src[i + 2];     // R = B
            rgba_buffer[i + 1] = src[i + 1]; // G = G
            rgba_buffer[i + 2] = src[i];     // B = R
            rgba_buffer[i + 3] = src[i + 3]; // A = A
        }
        glTexSubImage2D(GL_TEXTURE_2D, 0, x, y, w, h, GL_RGBA, GL_UNSIGNED_BYTE, rgba_buffer.data());
#else
        glTexSubImage2D(GL_TEXTURE_2D, 0, x, y, w, h, GL_BGRA, GL_UNSIGNED_BYTE, bmp.data());
#endif
        return offsets.emplace(
            std::piecewise_construct,
            std::forward_as_tuple(id),
            std::forward_as_tuple(x, y, w, h)
        ).first->second;
    }

    bool GraphicsGL::has_hd(const std::string& key) const
    {
        return hd_offsets.find(key) != hd_offsets.end();
    }

    bool GraphicsGL::place_hd(const std::string& key, int16_t gamewidth, int16_t gameheight)
    {
#ifdef MS_PLATFORM_WASM
        const int hw = gamewidth * supersample;
        const int hh = gameheight * supersample;
        if (hw <= 0 || hh <= 0 || hw > ATLASW || hh > ATLASH)
        {
            return false;
        }

        std::vector<uint8_t> rgba(static_cast<size_t>(hw) * hh * 4, 0);
        int ok = EM_ASM_INT({
            if (typeof Module.hdGetScaled !== 'function')
            {
                return 0;
            }
            return Module.hdGetScaled(UTF8ToString($0), $1, $2, $3);
        }, key.c_str(), hw, hh, rgba.data());

        if (!ok)
        {
            return false;
        }

        Point<GLshort> pos = reserve_atlas(static_cast<GLshort>(hw), static_cast<GLshort>(hh));

        glBindTexture(GL_TEXTURE_2D, atlas);
        glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
        glTexSubImage2D(
            GL_TEXTURE_2D, 0, pos.x(), pos.y(), hw, hh,
            GL_RGBA, GL_UNSIGNED_BYTE, rgba.data()
        );

        // Stored at HD texel size, but drawn at the WZ asset's game-space
        // rectangle, so it lands 1:1 in the supersampled scene pass.
        hd_offsets[key] = Offset(pos.x(), pos.y(),
            static_cast<GLshort>(hw), static_cast<GLshort>(hh));
        return true;
#else
        (void)key; (void)gamewidth; (void)gameheight;
        return false;
#endif
    }

    void GraphicsGL::reload_hd()
    {
        if (hd_requests.empty())
        {
            return;
        }
        hd_offsets.clear();
        for (const auto& req : hd_requests)
        {
            place_hd(req.first, req.second.x(), req.second.y());
        }
    }

    bool GraphicsGL::load_hd(const std::string& key, int16_t gamewidth, int16_t gameheight)
    {
        if (gamewidth <= 0 || gameheight <= 0)
        {
            return false;
        }
        if (hd_offsets.find(key) != hd_offsets.end())
        {
            return true;
        }
        if (!place_hd(key, gamewidth, gameheight))
        {
            return false;
        }
        hd_requests[key] = Point<int16_t>(gamewidth, gameheight);
        return true;
    }

    void GraphicsGL::draw_hd(const std::string& key, const Rectangle<int16_t>& rect,
        const Color& color, float angle)
    {
        if (locked || color.invisible())
        {
            return;
        }
        auto it = hd_offsets.find(key);
        if (it == hd_offsets.end())
        {
            return;
        }
        if (!rect.overlaps(screen()))
        {
            return;
        }
        quads.emplace_back(rect.l(), rect.r(), rect.t(), rect.b(), it->second, color, angle);
    }

    void GraphicsGL::draw(const nl::bitmap& bmp, const Rectangle<int16_t>& rect,
        const Color& color, float angle)
    {
        if (locked)
        {
            return;
        }

        if (color.invisible())
        {
            return;
        }

        if (!rect.overlaps(screen()))
        {
            return;
        }

        quads.emplace_back(rect.l(), rect.r(), rect.t(), rect.b(), getoffset(bmp), color, angle);
    }

    Text::Layout GraphicsGL::createlayout(const std::string& text, Text::Font id,
        Text::Alignment alignment, int16_t maxwidth, bool formatted) {

        size_t length = text.length();
        if (length == 0)
        {
            return {};
        }

        LayoutBuilder builder(fonts[id], alignment, maxwidth, formatted);

        const char* p_text = text.c_str();

        size_t first = 0;
        size_t offset = 0;
        while (offset < length)
        {
            size_t last = text.find_first_of(" \\#", offset + 1);
            if (last == std::string::npos)
                last = length;

            first = builder.add(p_text, first, offset, last);
            offset = last;
        }

        return builder.finish(first, offset);
    }


    GraphicsGL::LayoutBuilder::LayoutBuilder(const Font& f, Text::Alignment a, int16_t mw, bool fm)
        : font(f), alignment(a), maxwidth(mw), formatted(fm)
    {

        fontid = Text::NUM_FONTS;
        color  = Text::NUM_COLORS;
        ax     = 0;
        ay     = font.linespace();
        width  = 0;
        endy   = 0;
        if (maxwidth == 0)
        {
            maxwidth = 800;
        }
    }

    size_t GraphicsGL::LayoutBuilder::add(const char* text, size_t prev, size_t first, size_t last)
    {
        if (first == last)
        {
            return prev;
        }

        Text::Font  last_font  = fontid;
        Text::Color last_color = color;
        size_t skip = 0;
        bool linebreak = false;
        if (formatted)
        {
            switch (text[first])
            {
            case '\\':
                if (first + 1 < last)
                {
                    switch (text[first + 1])
                    {
                    case 'n':
                        linebreak = true;
                        break;
                    case 'r':
                        linebreak = ax > 0;
                        break;
                    }
                    skip++;
                }
                skip++;
                break;
            case '#':
                if (first + 1 < last)
                {
                    switch (text[first + 1])
                    {
                    case 'k':
                        color = Text::DARKGREY;
                        break;
                    case 'b':
                        color = Text::BLUE;
                        break;
                    case 'r':
                        color = Text::RED;
                        break;
                    case 'c':
                        color = Text::ORANGE;
                        break;
                    }
                    skip++;
                }
                skip++;
                break;
            }
        }

        int16_t wordwidth = 0;
        if (!linebreak)
        {
            for (size_t i = first; i < last; ++i)
            {
                char c = text[i];
                wordwidth += font.chars[c].ax;

                if (wordwidth > maxwidth)
                {
                    if (last - first == 1)
                    {
                        return last;
                    }
                    else
                    {
                        prev = add(text, prev, first, i);
                        return add(text, prev, i, last);
                    }
                }
            }
        }

        bool newword = skip > 0;
        bool newline = linebreak || ax + wordwidth > maxwidth;
        if (newword || newline)
        {
            add_word(prev, first, last_font, last_color);
        }
        if (newline)
        {
            add_line();

            endy = ay;
            ax = 0;
            ay += font.linespace();
        }

        for (size_t pos = first; pos < last; ++pos)
        {
            char c = text[pos];
            const Font::Char& ch = font.chars[c];

            advances.push_back(ax);

            if (pos < first + skip || (newline && c == ' '))
                continue;

            ax += ch.ax;

            if (width < ax)
            {
                width = ax;
            }
        }

        if (newword || newline)
        {
            return first + skip;
        }
        else
        {
            return prev;
        }
    }

    Text::Layout GraphicsGL::LayoutBuilder::finish(size_t first, size_t last)
    {
        add_word(first, last, fontid, color);
        add_line();

        advances.push_back(ax);
        return { lines, advances, width, ay, ax, endy };
    }

    void GraphicsGL::LayoutBuilder::add_word(
        size_t      word_first,
        size_t      word_last,
        Text::Font  word_font,
        Text::Color word_color
    ) {

        words.push_back({ word_first, word_last, word_font, word_color });
    }

    void GraphicsGL::LayoutBuilder::add_line()
    {
        int16_t line_x = 0;
        int16_t line_y = ay;
        switch (alignment)
        {
        case Text::CENTER:
            line_x -= ax / 2;
            break;
        case Text::RIGHT:
            line_x -= ax;
            break;
        default:
            break;
        }

        lines.push_back({ words, { line_x, line_y } });
        words.clear();
    }


    void GraphicsGL::drawtext(const DrawArgument& args, const std::string& text,
        const Text::Layout& layout, Text::Font id, Text::Color colorid, Text::Background background) {

        if (locked)
        {
            return;
        }

        const Color& color = args.get_color();

        if (text.empty() || color.invisible())
        {
            return;
        }

        const Font& font = fonts[id];

        GLshort x = args.getpos().x();
        GLshort y = args.getpos().y();
        GLshort w = layout.width();
        GLshort h = layout.height();

        switch (background)
        {
        case Text::NONE:
            break;
        case Text::NAMETAG:
            for (const Text::Layout::Line& line : layout)
            {
                GLshort left = x + line.position.x() - 2;
                GLshort right = left + w + 3;
                GLshort top = y + line.position.y() - font.linespace() + 5;
                GLshort bottom = top + h - 2;
                Color ntcolor{ 0.0f, 0.0f, 0.0f, 0.6f };

                quads.emplace_back(left, right, top, bottom, nulloffset, ntcolor, 0.0f);
                quads.emplace_back(left - 1, left, top + 1, bottom - 1, nulloffset, ntcolor, 0.0f);
                quads.emplace_back(right, right + 1, top + 1, bottom - 1, nulloffset, ntcolor, 0.0f);
            }
            break;
        default:
            break;
        }

        constexpr GLfloat colors[Text::NUM_COLORS][3] =
        {
            { 0.0f,  0.0f,  0.0f  }, // Black
            { 1.0f,  1.0f,  1.0f  }, // White
            { 1.0f,  1.0f,  0.0f  }, // Yellow
            { 0.0f,  0.0f,  1.0f  }, // Blue
            { 1.0f,  0.0f,  0.0f  }, // Red
            { 0.8f,  0.3f,  0.3f  }, // DarkRed
            { 0.5f,  0.25f, 0.0f  }, // Brown
            { 0.5f,  0.5f,  0.5f  }, // Lightgrey
            { 0.25f, 0.25f, 0.25f }, // Darkgrey
            { 1.0f,  0.5f,  0.0f  }, // Orange
            { 0.0f,  0.75f, 1.0f  }, // Mediumblue
            { 0.5f,  0.0f,  0.5f  }  // Violet
        };

        for (const Text::Layout::Line& line : layout)
        {
            Point<int16_t> position = line.position;

            for (const Text::Layout::Word& word : line.words)
            {
                GLshort ax = position.x() + layout.advance(word.first);
                GLshort ay = position.y();

                const GLfloat* wordcolor;
                if (word.color < Text::NUM_COLORS)
                {
                    wordcolor = colors[word.color];
                }
                else
                {
                    wordcolor = colors[colorid];
                }
                Color abscolor = color * Color{ wordcolor[0], wordcolor[1], wordcolor[2], 1.0f };

                for (size_t pos = word.first; pos < word.last; ++pos)
                {
                    const char c = text[pos];
                    const Font::Char &ch = font.chars[c];

                    GLshort chx = x + ax + ch.bl;
                    GLshort chy = y + ay - ch.bt;
                    GLshort chw = ch.bw;
                    GLshort chh = ch.bh;

                    if (ax == 0 && c == ' ')
                    {
                        continue;
                    }

                    ax += ch.ax;

                    if (chw <= 0 || chh <= 0)
                    {
                        continue;
                    }

                    quads.emplace_back(chx, chx + chw, chy, chy + chh, ch.offset, abscolor, 0.0f);
                }
            }
        }
    }

    void GraphicsGL::drawrectangle(int16_t x, int16_t y, int16_t w, int16_t h, float r, float g, float b, float a)
    {
        if (locked)
        {
            return;
        }

        quads.emplace_back(x, x + w, y, y + h, nulloffset, Color{ r, g, b, a }, 0.0f);
    }

    void GraphicsGL::drawscreenfill(float r, float g, float b, float a)
    {
        drawrectangle(0, -Constants::VIEWYOFFSET, Constants::viewwidth(), Constants::viewheight(), r, g, b, a);
    }

    void GraphicsGL::lock()
    {
        locked = true;
    }

    void GraphicsGL::unlock()
    {
        locked = false;
    }

    void GraphicsGL::flush(float opacity)
    {
        bool coverscene = opacity != 1.0f;
        if (coverscene)
        {
            float complement = 1.0f - opacity;
            Color color{ 0.0f, 0.0f, 0.0f, complement };
            Rectangle<int16_t> screen_rect = screen();
            quads.emplace_back(screen_rect.l(), screen_rect.r(), screen_rect.t(), screen_rect.b(), nulloffset, color, 0.0f);
        }

#ifdef MS_PLATFORM_WASM
        // Pass 1: render the scene supersampled. The vertex shader emits NDC
        // from game coordinates, so the larger viewport scales everything.
        glBindFramebuffer(GL_FRAMEBUFFER, scenefbo);
        glViewport(0, 0, supersample * Constants::VIEWWIDTH, supersample * Constants::VIEWHEIGHT);
#endif

        glClearColor(1.0, 1.0, 1.0, 1.0);
        glClear(GL_COLOR_BUFFER_BIT);

        GLsizei csize = static_cast<GLsizei>(quads.size() * sizeof(Quad));
        glEnableVertexAttribArray(attribute_coord);
        glEnableVertexAttribArray(attribute_color);
        glBindBuffer(GL_ARRAY_BUFFER, vbo);
        glBufferData(GL_ARRAY_BUFFER, csize, quads.data(), GL_STREAM_DRAW);
        glVertexAttribPointer(attribute_coord, 4, GL_SHORT, GL_FALSE, sizeof(Quad::Vertex), 0);
        glVertexAttribPointer(attribute_color, 4, GL_FLOAT, GL_FALSE, sizeof(Quad::Vertex), (const void*)8);
#ifdef MS_PLATFORM_WASM
        // Initialize indices for GL_TRIANGLES (2 triangles per quad, 6 indices per quad)
        std::vector<GLushort> indices;
        indices.reserve(quads.size() * 6);
        for (size_t i = 0; i < quads.size(); ++i)
        {
            GLushort base = static_cast<GLushort>(i * 4);
            indices.push_back(base + 0);
            indices.push_back(base + 1);
            indices.push_back(base + 2);
            indices.push_back(base + 0);
            indices.push_back(base + 2);
            indices.push_back(base + 3);
        }

        glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, ibo);
        glBufferData(GL_ELEMENT_ARRAY_BUFFER, indices.size() * sizeof(GLushort), indices.data(), GL_STREAM_DRAW);
        glDrawElements(GL_TRIANGLES, static_cast<GLsizei>(indices.size()), GL_UNSIGNED_SHORT, 0);
        glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, 0);
#else
        GLsizei fsize = static_cast<GLsizei>(quads.size() * Quad::LENGTH);
        glDrawArrays(GL_QUADS, 0, fsize);
#endif

        glDisableVertexAttribArray(attribute_coord);
        glDisableVertexAttribArray(attribute_color);
        glBindBuffer(GL_ARRAY_BUFFER, 0);

#ifdef MS_PLATFORM_WASM
        // Pass 2: sharp-bilinear upscale of the scene to the canvas backing store.
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
        glViewport(0, 0, outputwidth, outputheight);
        glDisable(GL_BLEND);

        glUseProgram(upscale_program);
        glBindTexture(GL_TEXTURE_2D, scenetex);
        glBindBuffer(GL_ARRAY_BUFFER, upscale_vbo);
        glEnableVertexAttribArray(upscale_attribute_pos);
        glVertexAttribPointer(upscale_attribute_pos, 2, GL_FLOAT, GL_FALSE, 0, 0);
        glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
        glDisableVertexAttribArray(upscale_attribute_pos);
        glBindBuffer(GL_ARRAY_BUFFER, 0);

        // Restore the persistent scene-pass state set up in reinit().
        glEnable(GL_BLEND);
        glUseProgram(program);
        glBindTexture(GL_TEXTURE_2D, atlas);
#endif

        if (coverscene)
        {
            quads.pop_back();
        }

    }

    void GraphicsGL::clearscene()
    {
        if (!locked)
        {
            quads.clear();
        }
    }
}

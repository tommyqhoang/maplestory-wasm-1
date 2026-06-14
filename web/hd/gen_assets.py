#!/usr/bin/env python3
"""Generate HD UI override PNGs from scratch (stdlib only, no Pillow).

These replace low-res WZ UI bitmaps via the engine's HD override system:
the browser scales each PNG to supersample x the WZ asset's game size, so it
lands 1:1 in the offscreen scene pass and stays crisp.

Run:  python3 web/hd/gen_assets.py
"""
import os
import struct
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))


def write_png(path, width, height, rgba):
    """rgba: bytearray of width*height*4 bytes, top-to-bottom rows."""
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)  # filter type 0 (None) per scanline
        raw.extend(rgba[y * stride:(y + 1) * stride])

    def chunk(tag, data):
        out = struct.pack(">I", len(data)) + tag + data
        return out + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)  # 8-bit RGBA
    idat = zlib.compress(bytes(raw), 9)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(sig)
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", idat))
        f.write(chunk(b"IEND", b""))


def lerp(a, b, t):
    return int(round(a + (b - a) * t))


def status_bar_background(width=1024, height=96):
    """A modern dark slate HUD panel: vertical gradient, bright top edge,
    soft inner highlight, deep bottom shadow. Horizontally uniform so it
    tolerates any width scaling without distortion."""
    # color stops (top -> bottom), RGB
    top_edge = (96, 108, 130)
    top = (44, 51, 64)
    mid = (30, 35, 45)
    bottom = (15, 18, 24)
    accent = (64, 196, 224)  # subtle cyan hairline under the top edge

    rgba = bytearray(width * height * 4)
    for y in range(height):
        t = y / (height - 1)
        if t < 0.5:
            tt = t / 0.5
            r = lerp(top[0], mid[0], tt)
            g = lerp(top[1], mid[1], tt)
            b = lerp(top[2], mid[2], tt)
        else:
            tt = (t - 0.5) / 0.5
            r = lerp(mid[0], bottom[0], tt)
            g = lerp(mid[1], bottom[1], tt)
            b = lerp(mid[2], bottom[2], tt)

        if y == 0:
            r, g, b = top_edge
        elif y == 1:
            r = lerp(top_edge[0], accent[0], 0.5)
            g = lerp(top_edge[1], accent[1], 0.5)
            b = lerp(top_edge[2], accent[2], 0.5)
        elif y == 2:
            # faint accent hairline
            r = lerp(r, accent[0], 0.25)
            g = lerp(g, accent[1], 0.25)
            b = lerp(b, accent[2], 0.25)
        elif y >= height - 2:
            # bottom shadow line
            r, g, b = (8, 10, 14)

        off = y * width * 4
        for x in range(width):
            i = off + x * 4
            rgba[i] = r
            rgba[i + 1] = g
            rgba[i + 2] = b
            rgba[i + 3] = 255
    return width, height, rgba


def main():
    w, h, px = status_bar_background()
    out = os.path.join(HERE, "StatusBar", "backgrnd.png")
    write_png(out, w, h, px)
    print("wrote", out, f"({w}x{h})")


if __name__ == "__main__":
    main()

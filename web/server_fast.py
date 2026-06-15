"""
Fast async HTTP server for MapleStory WASM client.

Uses aiohttp for high-performance async file serving with HTTP Range support.
This is significantly faster than Python's built-in http.server.

Install: pip install aiohttp
Run: python web/server_fast.py
"""

import asyncio
import mimetypes
import os
from aiohttp import web

PORT = 8000
DIRECTORY = os.path.join(os.path.dirname(__file__), "..")

# Explicit overrides where exact typing matters or guesses are unreliable.
CONTENT_TYPES = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".wasm": "application/wasm",
    ".css": "text/css",
    ".json": "application/json",
    ".data": "application/octet-stream",
    ".mem": "application/octet-stream",
    ".map": "application/json",
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
}

# Required headers for WASM with SharedArrayBuffer
CORS_HEADERS = {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Accept-Ranges": "bytes",
}


async def handle_request(request: web.Request) -> web.StreamResponse:
    """Handle GET/HEAD requests with Range support."""
    # Translate path
    path = request.path.lstrip("/")
    if not path:
        # The client page lives in web/, not the repo root we serve from.
        path = "web/index.html"
    
    base = os.path.realpath(DIRECTORY)
    full_path = os.path.realpath(os.path.join(base, path))

    # Security: prevent directory traversal. A bare startswith() check is unsafe
    # (a sibling like "<base>-secret" shares the prefix); require full_path to be
    # base itself or live strictly beneath it. realpath() also blocks symlink escapes.
    if full_path != base and not full_path.startswith(base + os.sep):
        return web.Response(status=403, text="Forbidden")
    
    if not os.path.exists(full_path) or os.path.isdir(full_path):
        # Try index.html for directories
        if os.path.isdir(full_path):
            index_path = os.path.join(full_path, "index.html")
            if os.path.exists(index_path):
                full_path = index_path
            else:
                return web.Response(status=404, text="Not Found")
        else:
            return web.Response(status=404, text="Not Found")
    
    file_size = os.path.getsize(full_path)
    
    # Determine content type. WASM/JS need exact types for streaming compilation
    # and ESM; fall back to the mimetypes table for everything else.
    content_type = CONTENT_TYPES.get(
        os.path.splitext(full_path)[1].lower()
    ) or mimetypes.guess_type(full_path)[0] or "application/octet-stream"
    
    # Check for Range header
    range_header = request.headers.get("Range")
    
    if request.method == "HEAD":
        headers = {**CORS_HEADERS, "Content-Length": str(file_size), "Content-Type": content_type}
        print(f"[HEAD] {path} - {file_size} bytes ({file_size / (1024*1024):.2f} MB)")
        return web.Response(status=200, headers=headers)
    
    if range_header:
        # Parse range header
        try:
            start, end = parse_range(range_header, file_size)
        except ValueError:
            return web.Response(
                status=416,
                headers={**CORS_HEADERS, "Content-Range": f"bytes */{file_size}"},
                text="Range Not Satisfiable"
            )
        
        chunk_size = end - start + 1
        
        headers = {
            **CORS_HEADERS,
            "Content-Type": content_type,
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Content-Length": str(chunk_size),
        }
        
        # Stream the response
        response = web.StreamResponse(status=206, headers=headers)
        await response.prepare(request)
        
        # Read and send file in chunks for better memory efficiency
        with open(full_path, "rb") as f:
            f.seek(start)
            remaining = chunk_size
            while remaining > 0:
                # Read in 256KB blocks for efficient I/O
                read_size = min(262144, remaining)
                data = f.read(read_size)
                if not data:
                    break
                await response.write(data)
                remaining -= len(data)
        
        await response.write_eof()
        
        print(f"[Range] {path} - bytes {start}-{end}/{file_size} ({chunk_size / (1024*1024):.2f} MB)")
        return response
    
    else:
        # Full file response
        headers = {
            **CORS_HEADERS,
            "Content-Type": content_type,
            "Content-Length": str(file_size),
        }
        
        response = web.StreamResponse(status=200, headers=headers)
        await response.prepare(request)
        
        with open(full_path, "rb") as f:
            while True:
                data = f.read(262144)  # 256KB chunks
                if not data:
                    break
                await response.write(data)
        
        await response.write_eof()
        return response


def parse_range(range_header: str, file_size: int) -> tuple[int, int]:
    """Parse HTTP Range header."""
    if not range_header.startswith("bytes="):
        raise ValueError("Invalid Range header")
    
    range_spec = range_header[6:]  # Remove "bytes="
    parts = range_spec.split("-")
    
    if len(parts) != 2:
        raise ValueError("Invalid Range format")
    
    start_str, end_str = parts
    
    if start_str and end_str:
        start = int(start_str)
        end = int(end_str)
    elif start_str:
        start = int(start_str)
        end = file_size - 1
    elif end_str:
        # Suffix range: -500 means last 500 bytes
        suffix_len = int(end_str)
        start = max(0, file_size - suffix_len)
        end = file_size - 1
    else:
        raise ValueError("Invalid Range values")
    
    start = max(0, start)
    end = min(end, file_size - 1)
    
    if start > end:
        raise ValueError("Invalid Range")
    
    return start, end


async def main():
    app = web.Application()
    app.router.add_route("GET", "/{path:.*}", handle_request)
    app.router.add_route("HEAD", "/{path:.*}", handle_request)
    
    runner = web.AppRunner(app)
    await runner.setup()
    
    site = web.TCPSite(runner, "0.0.0.0", PORT)
    await site.start()
    
    print("=" * 60)
    print("MapleStory WASM Server (Fast Async)")
    print("=" * 60)
    print(f"Serving at http://localhost:{PORT}")
    print(f"Directory: {os.path.abspath(DIRECTORY)}")
    print()
    print("Features:")
    print("  ✓ Async I/O with aiohttp (much faster!)")
    print("  ✓ HTTP Range requests (206 Partial Content)")
    print("  ✓ Streaming file responses")
    print("  ✓ CORS + COOP/COEP headers for SharedArrayBuffer")
    print()
    print("Press Ctrl+C to stop the server.")
    print("=" * 60)
    print()
    
    # Keep running
    await asyncio.Event().wait()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped.")

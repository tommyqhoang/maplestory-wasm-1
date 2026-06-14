// HD asset override loader.
//
// Preloads high-res UI PNGs (listed in web/hd/manifest.json) and exposes a
// synchronous bridge the WASM engine calls to fetch scaled RGBA pixels:
//   Module.hdGetScaled(key, hw, hh, ptr) -> 1 on success, 0 if unavailable.
//
// The engine asks for the asset scaled to (gameWidth * supersample) so it
// lands 1:1 in the supersampled scene pass and stays crisp. Same-origin
// fetch + createImageBitmap avoids canvas tainting under COEP.
(function () {
  const HD = {
    bitmaps: new Map(), // key -> ImageBitmap
    ready: false,
  };
  window.MapleHD = HD;

  HD.preload = async function () {
    try {
      const res = await fetch('/web/hd/manifest.json', { cache: 'no-store' });
      if (!res.ok) {
        console.warn('[HD] no manifest (status ' + res.status + ')');
        return;
      }
      const manifest = await res.json();
      const assets = (manifest && manifest.assets) || [];
      await Promise.all(assets.map(async (entry) => {
        try {
          const r = await fetch('/web/hd/' + entry.file, { cache: 'no-store' });
          if (!r.ok) {
            console.warn('[HD] missing', entry.file, r.status);
            return;
          }
          const blob = await r.blob();
          const bmp = await createImageBitmap(blob);
          HD.bitmaps.set(entry.key, bmp);
          console.log('[HD] loaded', entry.key, bmp.width + 'x' + bmp.height);
        } catch (e) {
          console.warn('[HD] failed', entry.key, e);
        }
      }));
      HD.ready = true;
      console.log('[HD] preload complete:', HD.bitmaps.size, 'asset(s)');
    } catch (e) {
      console.warn('[HD] preload error', e);
    }
  };

  // Reused scratch canvas for high-quality scaling.
  const scratch = document.createElement('canvas');
  const sctx = scratch.getContext('2d', { willReadFrequently: true });

  HD.getScaled = function (key, hw, hh, ptr) {
    const bmp = HD.bitmaps.get(key);
    if (!bmp || hw <= 0 || hh <= 0) {
      return 0;
    }
    if (scratch.width !== hw || scratch.height !== hh) {
      scratch.width = hw;
      scratch.height = hh;
    } else {
      sctx.clearRect(0, 0, hw, hh);
    }
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(bmp, 0, 0, hw, hh);
    const img = sctx.getImageData(0, 0, hw, hh);
    const heap = (typeof Module !== 'undefined' && Module.HEAPU8)
      ? Module.HEAPU8
      : (typeof HEAPU8 !== 'undefined' ? HEAPU8 : null);
    if (!heap) {
      return 0;
    }
    heap.set(img.data, ptr);
    return 1;
  };

  // Kick off preloading immediately; the HUD is built well after login.
  HD.preload();
})();

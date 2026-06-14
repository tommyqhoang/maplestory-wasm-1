import React from "react";
import { useAsset } from "../bridge/assets";

interface AssetImageProps {
  // WZ asset key in the form "<kind>/<id>" (kinds: item, equip, skill).
  assetKey: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}

// Renders a WZ item/skill icon (composited inside the engine, delivered as a
// PNG data URL) as a plain <img>. While the asset is loading it shows a stable
// placeholder box so surrounding layout does not shift when the icon arrives.
export function AssetImage({
  assetKey,
  alt,
  className,
  style,
}: AssetImageProps) {
  const dataUrl = useAsset(assetKey);

  if (!dataUrl) {
    return (
      <span
        className={["maple-asset-placeholder", className]
          .filter(Boolean)
          .join(" ")}
        role="img"
        aria-label={alt}
        style={{
          display: "inline-block",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "var(--radius)",
          ...style,
        }}
      />
    );
  }

  return (
    <img
      className={["maple-asset-image", className].filter(Boolean).join(" ")}
      src={dataUrl}
      alt={alt}
      style={{ imageRendering: "pixelated", ...style }}
    />
  );
}

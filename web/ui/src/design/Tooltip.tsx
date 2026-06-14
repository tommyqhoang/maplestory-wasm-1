import React, { useCallback, useId, useState } from "react";

interface TooltipProps {
  /** Tooltip text content. */
  content: React.ReactNode;
  /** The element(s) that trigger the tooltip. */
  children: React.ReactNode;
  /**
   * Force the tooltip panel visible regardless of hover/focus state.
   * Intended for unit tests running in production-mode React (where act() is
   * unavailable), allowing renderToStaticMarkup to capture the panel markup.
   */
  forceVisible?: boolean;
}

/**
 * Lightweight hover + focus tooltip. Wraps children in a relative-positioned
 * container; the floating panel appears above (or below) the trigger using CSS
 * positioning. No dependencies beyond React.
 *
 * Accessible: shows on focus as well as hover; the panel has role="tooltip"
 * and is referenced by the trigger via aria-describedby.
 */
export function Tooltip({
  content,
  children,
  forceVisible = false,
}: TooltipProps) {
  const [hovered, setHovered] = useState(false);
  const visible = forceVisible || hovered;
  const id = useId();

  const show = useCallback(() => setHovered(true), []);
  const hide = useCallback(() => setHovered(false), []);

  return (
    <div
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
      aria-describedby={visible ? id : undefined}
    >
      {children}

      {visible && (
        <div
          id={id}
          role="tooltip"
          data-testid="tooltip-panel"
          style={{
            position: "absolute",
            bottom: "calc(100% + var(--sp-1))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 200,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            background: "var(--surface)",
            border: "1px solid var(--surface-border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow)",
            padding: "var(--sp-1) var(--sp-2)",
            fontSize: "0.72rem",
            color: "var(--text-primary)",
            fontFamily: "var(--font)",
            animation:
              "maple-tooltip-in var(--motion-fast) var(--motion-ease) both",
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}

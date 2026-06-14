import React, { useCallback, useRef, useState } from "react";
import { Panel } from "./primitives";

interface WindowProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Initial top-left position in viewport pixels. */
  defaultPosition?: { x: number; y: number };
  className?: string;
}

/**
 * A reusable draggable floating window. Drag the title bar to move it; the
 * close (×) button invokes onClose. Styled with the shared design tokens via
 * Panel. Self-contained: position lives in local state, dragging uses pointer
 * events so it keeps tracking even if the cursor leaves the title bar.
 */
export function Window({
  title,
  onClose,
  children,
  defaultPosition = { x: 120, y: 96 },
  className,
}: WindowProps) {
  const [pos, setPos] = useState(defaultPosition);
  // Offset between the pointer and the window's top-left at drag start.
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragOffset.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pos.x, pos.y],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const off = dragOffset.current;
    if (!off) return;
    setPos({ x: e.clientX - off.dx, y: e.clientY - off.dy });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragOffset.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div
      className={["maple-window ui-interactive", className]
        .filter(Boolean)
        .join(" ")}
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        zIndex: 50,
      }}
    >
      <Panel style={{ padding: 0, minWidth: "240px" }}>
        <div
          className="maple-window-titlebar"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--sp-2) var(--sp-3)",
            borderBottom: "1px solid var(--surface-border)",
            cursor: "move",
            userSelect: "none",
            touchAction: "none",
          }}
        >
          <span
            style={{
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "0.02em",
            }}
          >
            {title}
          </span>
          <button
            className="maple-window-close ui-interactive"
            aria-label="Close"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              fontSize: "1.1rem",
              lineHeight: 1,
              cursor: "pointer",
              padding: "0 var(--sp-1)",
              transition: "color var(--motion-fast) var(--motion-ease)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color =
                "var(--accent)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color =
                "var(--text-secondary)";
            }}
          >
            ×
          </button>
        </div>
        <div className="maple-window-body" style={{ padding: "var(--sp-3)" }}>
          {children}
        </div>
      </Panel>
    </div>
  );
}

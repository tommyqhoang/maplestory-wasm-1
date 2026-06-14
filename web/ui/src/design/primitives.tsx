import React from "react";

/* ---- Panel ------------------------------------------------------------ */
interface PanelProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Panel({ children, className, style }: PanelProps) {
  return (
    <div
      className={["maple-panel", className].filter(Boolean).join(" ")}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--surface-border)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow)",
        padding: "var(--sp-3)",
        fontFamily: "var(--font)",
        color: "var(--text-primary)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ---- Button ----------------------------------------------------------- */
interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  testId?: string;
}

export function Button({
  onClick,
  children,
  className,
  title,
  disabled,
  style: extraStyle,
  testId,
}: ButtonProps) {
  return (
    <button
      className={["maple-btn ui-interactive", className]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      title={title}
      disabled={disabled}
      data-testid={testId}
      style={{
        background: "var(--accent)",
        color: "#fff",
        border: "none",
        borderRadius: "var(--radius)",
        padding: "var(--sp-1) var(--sp-3)",
        fontFamily: "var(--font)",
        fontSize: "0.85rem",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background 0.12s",
        ...extraStyle,
      }}
      onMouseEnter={(e) => {
        if (!disabled)
          (e.currentTarget as HTMLButtonElement).style.background =
            "var(--accent-hover)";
      }}
      onMouseLeave={(e) => {
        if (!disabled)
          (e.currentTarget as HTMLButtonElement).style.background =
            "var(--accent)";
      }}
      onMouseDown={(e) => {
        if (!disabled)
          (e.currentTarget as HTMLButtonElement).style.background =
            "var(--accent-active)";
      }}
      onMouseUp={(e) => {
        if (!disabled)
          (e.currentTarget as HTMLButtonElement).style.background =
            "var(--accent-hover)";
      }}
    >
      {children}
    </button>
  );
}

/* ---- IconButton ------------------------------------------------------- */
interface IconButtonProps {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}

export function IconButton({ onClick, label, children }: IconButtonProps) {
  return (
    <Button
      onClick={onClick}
      title={label}
      style={
        {
          "--_pad": "var(--sp-1)",
          padding: "var(--sp-1)",
          minWidth: "28px",
          minHeight: "28px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        } as React.CSSProperties
      }
    >
      {children}
    </Button>
  );
}

/* ---- GaugeBar --------------------------------------------------------- */
interface GaugeBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
  testId?: string;
}

export function GaugeBar({ label, value, max, color, testId }: GaugeBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <div
      data-testid={testId}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-2)",
        fontFamily: "var(--font)",
      }}
    >
      <span
        style={{
          fontSize: "0.7rem",
          fontWeight: 700,
          color: color,
          minWidth: "28px",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>
      <div
        style={{
          position: "relative",
          flex: 1,
          height: "14px",
          background: "rgba(0,0,0,0.45)",
          borderRadius: "4px",
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${pct}%`,
            background: color,
            borderRadius: "4px",
            transition: "width 0.2s ease",
          }}
        />
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.65rem",
            fontWeight: 700,
            color: "#fff",
            textShadow: "0 1px 2px rgba(0,0,0,0.9)",
            letterSpacing: "0.02em",
          }}
        >
          {value} / {max}
        </span>
      </div>
    </div>
  );
}

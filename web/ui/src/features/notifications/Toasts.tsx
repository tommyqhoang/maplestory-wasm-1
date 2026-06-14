import { useEffect } from "react";
import "./toasts.css";
import { useGame } from "../../store/store";
import type { Notice } from "../../store/store";

const AUTO_DISMISS_MS = 4000;

// A single toast. Auto-dismisses after AUTO_DISMISS_MS and on click.
function Toast({
  notice,
  onDismiss,
}: {
  notice: Notice;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(notice.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [notice.id, onDismiss]);

  return (
    <div
      data-testid="toast"
      data-ntype={notice.ntype}
      className="maple-toast"
      role="status"
      onClick={() => onDismiss(notice.id)}
    >
      {notice.text}
    </div>
  );
}

/**
 * Pure presentational toast stack. Exported separately so it can be unit-tested
 * without the zustand store gate (mirrors the SkillsBody/BuffBarBody pattern).
 */
export function ToastsBody({
  notices,
  onDismiss,
}: {
  notices: Notice[];
  onDismiss: (id: number) => void;
}) {
  if (notices.length === 0) return null;

  return (
    <div className="maple-toast-container" data-testid="toast-container">
      {notices.map((notice) => (
        <Toast key={notice.id} notice={notice} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export function Toasts() {
  const notices = useGame((s) => s.notices);
  const dismissNotice = useGame((s) => s.dismissNotice);

  return <ToastsBody notices={notices} onDismiss={dismissNotice} />;
}

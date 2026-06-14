import { useRef, useEffect, useState } from "react";
import { useGame } from "../../store/store";
import { bridge } from "../../bridge/useBridge";
import { Panel, Button } from "../../design/primitives";

export function Chat() {
  const chat = useGame((s) => s.chat);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    bridge.sendChat(trimmed);
    setText("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSend();
  }

  return (
    <Panel className="hud-chat">
      <div className="hud-chat-messages">
        {chat.map((line, i) => (
          <div key={i} className="hud-chat-line" data-ctype={line.ctype}>
            {line.line}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="hud-chat-input-row">
        <input
          className="hud-chat-input ui-interactive"
          type="text"
          placeholder="Say something…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          data-testid="hud-chat-input"
          maxLength={200}
        />
        <Button onClick={handleSend}>Send</Button>
      </div>
    </Panel>
  );
}

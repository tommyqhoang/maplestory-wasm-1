import { useRef, useEffect, useState } from "react";
import { useGame } from "../../store/store";
import { bridge } from "../../bridge/useBridge";
import { Panel, Button } from "../../design/primitives";
import { CHAT_CHANNELS, type ChatChannel } from "../../bridge/protocol";

const TAB_LABELS: Record<ChatChannel, string> = {
  all: "All",
  party: "Party",
  buddy: "Buddy",
  guild: "Guild",
  alliance: "Alliance",
  whisper: "Whisper",
};

export function Chat() {
  const chat = useGame((s) => s.chat);
  // Active channel lives in the store so the global keyboard manager can cycle
  // it with Tab while the chat input is focused.
  const channel = useGame((s) => s.chatChannel);
  const setChannel = useGame((s) => s.setChatChannel);
  const [text, setText] = useState("");
  const [target, setTarget] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // "All" shows the full stream; a channel tab shows only its own lines.
  const visible =
    channel === "all" ? chat : chat.filter((l) => l.channel === channel);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, channel]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    // A whisper needs a target name; don't send into the void.
    if (channel === "whisper" && !target.trim()) return;
    bridge.sendChat(trimmed, channel, target.trim());
    setText("");
  }

  return (
    <Panel className="hud-chat">
      <div className="hud-chat-tabs" role="tablist">
        {CHAT_CHANNELS.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={channel === c}
            className="hud-chat-tab ui-interactive"
            data-active={channel === c}
            data-testid={`hud-chat-tab-${c}`}
            onClick={() => setChannel(c)}
          >
            {TAB_LABELS[c]}
          </button>
        ))}
      </div>

      <div className="hud-chat-messages">
        {visible.map((line, i) => (
          <div
            key={i}
            className="hud-chat-line"
            data-ctype={line.ctype}
            data-channel={line.channel}
          >
            {line.line}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {channel === "whisper" && (
        <input
          className="hud-chat-target ui-interactive"
          type="text"
          placeholder="Whisper to… (character name)"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          data-testid="hud-chat-target"
          maxLength={13}
        />
      )}

      <form
        className="hud-chat-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <input
          className="hud-chat-input ui-interactive"
          type="text"
          placeholder={
            channel === "all"
              ? "Say something…"
              : `Message ${TAB_LABELS[channel]}…`
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          data-testid="hud-chat-input"
          maxLength={200}
        />
        <Button onClick={() => {}}>Send</Button>
      </form>
    </Panel>
  );
}

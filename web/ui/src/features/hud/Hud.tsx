import "./hud.css";
import { StatusBar } from "./StatusBar";
import { Chat } from "./Chat";
import { StatsWindow } from "../stats/StatsWindow";

export function Hud() {
  return (
    <>
      <StatusBar />
      <Chat />
      <StatsWindow />
    </>
  );
}

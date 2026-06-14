import "./hud.css";
import { useEffect } from "react";
import { useHudHotkeys } from "./useHudHotkeys";
import { useGame } from "../../store/store";
import { bridge } from "../../bridge/useBridge";
import { StatusBar } from "./StatusBar";
import { Chat } from "./Chat";
import { StatsWindow } from "../stats/StatsWindow";
import { InventoryWindow } from "../inventory/InventoryWindow";
import { EquipmentWindow } from "../equipment/EquipmentWindow";
import { SkillsWindow } from "../skills/SkillsWindow";
import { NpcDialog } from "../npc/NpcDialog";
import { Shop } from "../shop/Shop";
import { SystemMenu } from "../system/SystemMenu";
import { Settings } from "../system/Settings";
import { FpsMeter } from "../system/FpsMeter";
import { BuffBar } from "../buffs/BuffBar";
import { Toasts } from "../notifications/Toasts";

export function Hud() {
  useHudHotkeys();

  // Push the player's saved volume preferences to the engine once in-game, so
  // the audio matches their settings (honoring mute) instead of the engine's
  // 100% default.
  useEffect(() => {
    const { bgmVolume, sfxVolume, bgmMuted, sfxMuted } = useGame.getState();
    bridge.setBgmVolume(bgmMuted ? 0 : bgmVolume);
    bridge.setSfxVolume(sfxMuted ? 0 : sfxVolume);
  }, []);

  return (
    <>
      <StatusBar />
      <Chat />
      <BuffBar />
      <StatsWindow />
      <InventoryWindow />
      <EquipmentWindow />
      <SkillsWindow />
      <NpcDialog />
      <Shop />
      <Settings />
      <SystemMenu />
      <FpsMeter />
      <Toasts />
    </>
  );
}

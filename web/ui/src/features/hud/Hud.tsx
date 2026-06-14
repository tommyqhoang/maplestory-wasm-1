import "./hud.css";
import { StatusBar } from "./StatusBar";
import { Chat } from "./Chat";
import { StatsWindow } from "../stats/StatsWindow";
import { InventoryWindow } from "../inventory/InventoryWindow";
import { EquipmentWindow } from "../equipment/EquipmentWindow";
import { SkillsWindow } from "../skills/SkillsWindow";
import { NpcDialog } from "../npc/NpcDialog";

export function Hud() {
  return (
    <>
      <StatusBar />
      <Chat />
      <StatsWindow />
      <InventoryWindow />
      <EquipmentWindow />
      <SkillsWindow />
      <NpcDialog />
    </>
  );
}

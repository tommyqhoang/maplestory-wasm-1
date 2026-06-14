import "./hud.css";
import { StatusBar } from "./StatusBar";
import { Chat } from "./Chat";
import { StatsWindow } from "../stats/StatsWindow";
import { InventoryWindow } from "../inventory/InventoryWindow";
import { EquipmentWindow } from "../equipment/EquipmentWindow";
import { SkillsWindow } from "../skills/SkillsWindow";
import { NpcDialog } from "../npc/NpcDialog";
import { Shop } from "../shop/Shop";

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
      <Shop />
    </>
  );
}

import { useState } from "react";
import { useGame } from "../../store/store";
import { bridge } from "../../bridge/useBridge";
import type { CharInfo } from "../../bridge/protocol";
import { Panel, Button } from "../../design/primitives";
import { EntryBackdrop } from "../entry/EntryBackdrop";

/** v83 job id → display name (common subset + fallback) */
function jobName(jobId: number): string {
  const JOB_NAMES: Record<number, string> = {
    0: "Beginner",
    100: "Warrior",
    110: "Fighter",
    111: "Crusader",
    112: "Hero",
    120: "Page",
    121: "White Knight",
    122: "Paladin",
    130: "Spearman",
    131: "Dragon Knight",
    132: "Dark Knight",
    200: "Magician",
    210: "Wizard (F/P)",
    211: "Mage (F/P)",
    212: "Archmage (F/P)",
    220: "Wizard (I/L)",
    221: "Mage (I/L)",
    222: "Archmage (I/L)",
    230: "Cleric",
    231: "Priest",
    232: "Bishop",
    300: "Archer",
    310: "Hunter",
    311: "Ranger",
    312: "Bowmaster",
    320: "Crossbowman",
    321: "Sniper",
    322: "Marksman",
    400: "Rogue",
    410: "Assassin",
    411: "Hermit",
    412: "Night Lord",
    420: "Bandit",
    421: "Chief Bandit",
    422: "Shadower",
    500: "Pirate",
    510: "Brawler",
    511: "Marauder",
    512: "Buccaneer",
    520: "Gunslinger",
    521: "Outlaw",
    522: "Corsair",
    900: "GM",
    910: "Super GM",
    1000: "Noblesse",
    2000: "Aran (Beginner)",
    2100: "Aran",
  };
  return JOB_NAMES[jobId] ?? `Job ${jobId}`;
}

interface CharCardProps {
  char: CharInfo;
  selected: boolean;
  onSelect: (cid: number) => void;
}

function CharCard({ char, selected, onSelect }: CharCardProps) {
  return (
    <Panel
      className={`char-card${selected ? " selected" : ""}`}
      style={{ padding: "var(--sp-3)", cursor: "pointer" }}
      // Panel renders a div — we attach click via onClick on the div via className
    >
      <div
        onClick={() => onSelect(char.cid)}
        data-testid={`char-${char.cid}`}
        style={{ outline: "none" }}
      >
        <div className="char-card__name">{char.name}</div>
        <div className="char-card__level">Lv. {char.level}</div>
        <div className="char-card__job">{jobName(char.job)}</div>
        <div className="char-card__stats">
          <div className="char-card__stat">
            STR <span>{char.str}</span>
          </div>
          <div className="char-card__stat">
            DEX <span>{char.dex}</span>
          </div>
          <div className="char-card__stat">
            INT <span>{char.int}</span>
          </div>
          <div className="char-card__stat">
            LUK <span>{char.luk}</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function CharSelect() {
  const characters = useGame((s) => s.characters);
  const [selectedCid, setSelectedCid] = useState<number | null>(null);

  function handleStart() {
    if (selectedCid !== null) {
      bridge.selectChar(selectedCid);
    }
  }

  return (
    <EntryBackdrop>
      <Panel className="entry-card entry-card--wide">
        <div className="entry-logo">
          <h1 className="entry-logo__title">Select Character</h1>
          <p className="entry-logo__sub">Choose your adventurer</p>
        </div>

        {characters.length === 0 ? (
          <div className="entry-empty">
            No characters found. Create one to get started!
          </div>
        ) : (
          <div className="char-grid">
            {characters.map((c) => (
              <CharCard
                key={c.cid}
                char={c}
                selected={c.cid === selectedCid}
                onSelect={setSelectedCid}
              />
            ))}
          </div>
        )}

        <div className="entry-actions">
          <Button
            onClick={handleStart}
            disabled={selectedCid === null}
            testId="char-start"
          >
            Start
          </Button>
          <Button onClick={() => bridge.backToLogin()}>Back</Button>
        </div>
      </Panel>
    </EntryBackdrop>
  );
}

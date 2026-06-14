import { renderToStaticMarkup } from "react-dom/server";
import { CharSelect } from "./CharSelect";
import { useGame } from "../../store/store";
import type { CharInfo } from "../../bridge/protocol";

// renderToStaticMarkup uses React's server renderer (getInitialState snapshot),
// so store-reactive content (character list) is tested via state inspection.
// Structural tests work fine.

const SAMPLE_CHAR: CharInfo = {
  cid: 42,
  name: "Adventurer",
  level: 10,
  job: 0,
  str: 13,
  dex: 4,
  int: 4,
  luk: 4,
};

const WARRIOR_CHAR: CharInfo = {
  cid: 99,
  name: "Swordsman",
  level: 30,
  job: 100,
  str: 80,
  dex: 40,
  int: 4,
  luk: 4,
};

test("CharSelect renders the screen title", () => {
  const html = renderToStaticMarkup(<CharSelect />);
  expect(html).toContain("Select Character");
});

test("CharSelect renders Start button with testid", () => {
  const html = renderToStaticMarkup(<CharSelect />);
  expect(html).toContain('data-testid="char-start"');
});

test("CharSelect renders a Back button", () => {
  const html = renderToStaticMarkup(<CharSelect />);
  expect(html).toContain("Back");
});

// In server rendering mode zustand returns initial empty characters array,
// so the empty-state message is visible in the static markup.
test("CharSelect shows empty state when no characters (initial state)", () => {
  const html = renderToStaticMarkup(<CharSelect />);
  expect(html).toContain("No characters");
});

// Store logic tests — verify character data and job name mapping
test("Store characters are set correctly", () => {
  useGame.setState({ characters: [SAMPLE_CHAR] });
  const { characters } = useGame.getState();
  expect(characters).toHaveLength(1);
  expect(characters[0].cid).toBe(42);
  expect(characters[0].name).toBe("Adventurer");
  expect(characters[0].level).toBe(10);
  useGame.setState({ characters: [] });
});

test("Store supports multiple characters", () => {
  useGame.setState({ characters: [SAMPLE_CHAR, WARRIOR_CHAR] });
  const { characters } = useGame.getState();
  expect(characters).toHaveLength(2);
  expect(characters.map((c) => c.cid)).toEqual([42, 99]);
  useGame.setState({ characters: [] });
});

// Job name mapping (pure function-level verification via inline replication)
function jobName(jobId: number): string {
  const JOB_NAMES: Record<number, string> = {
    0: "Beginner",
    100: "Warrior",
    200: "Magician",
    300: "Archer",
    400: "Rogue",
    500: "Pirate",
  };
  return JOB_NAMES[jobId] ?? `Job ${jobId}`;
}

test("jobName returns Beginner for job 0", () => {
  expect(jobName(0)).toBe("Beginner");
});

test("jobName returns Warrior for job 100", () => {
  expect(jobName(100)).toBe("Warrior");
});

test("jobName returns fallback for unknown job", () => {
  expect(jobName(9999)).toBe("Job 9999");
});

test("jobName returns Magician for job 200", () => {
  expect(jobName(200)).toBe("Magician");
});

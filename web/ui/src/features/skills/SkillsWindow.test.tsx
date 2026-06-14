import { renderToStaticMarkup } from "react-dom/server";
import { SkillsBody } from "./SkillsWindow";
import type { SkillEntry } from "../../bridge/protocol";

// renderToStaticMarkup uses React's server snapshot, so the store-gated window
// is tested via the pure SkillsBody component (same convention as
// InventoryWindow.test.tsx).

const skills: SkillEntry[] = [
  { skillid: 1000, level: 3, masterlevel: 0 },
  { skillid: 1001, level: 10, masterlevel: 20 },
  { skillid: 1002, level: 1, masterlevel: 0 },
];

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

test("SkillsBody renders one cell per learned skill", () => {
  const html = renderToStaticMarkup(<SkillsBody skills={skills} />);
  expect(countOccurrences(html, 'data-testid="skills-cell"')).toBe(3);
});

test("SkillsBody renders a skill icon for each skill", () => {
  const html = renderToStaticMarkup(<SkillsBody skills={skills} />);
  // AssetImage renders a placeholder with aria-label = alt while loading.
  expect(html).toContain('aria-label="Skill 1000"');
  expect(html).toContain('aria-label="Skill 1001"');
  expect(html).toContain('aria-label="Skill 1002"');
});

test("SkillsBody shows level, with master level when present", () => {
  const html = renderToStaticMarkup(<SkillsBody skills={skills} />);
  // Skill with masterlevel 20 shows "10/20"; masterlevel 0 shows bare level.
  expect(html).toContain(">10/20<");
  expect(html).toContain(">3<");
});

test("SkillsBody shows a friendly message when there are no skills", () => {
  const html = renderToStaticMarkup(<SkillsBody skills={[]} />);
  expect(countOccurrences(html, 'data-testid="skills-cell"')).toBe(0);
  expect(html).toContain("No skills");
});

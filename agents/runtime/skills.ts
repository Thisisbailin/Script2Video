import type { Script2VideoSkillDefinition, Script2VideoSkillLoader } from "./types";

type RawSkillModuleMap = Record<string, string>;

const skillMarkdownModules = import.meta.glob("../../skills/**/SKILL.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as RawSkillModuleMap;

const parseTitle = (markdown: string, fallback: string) => {
  const heading = markdown.match(/^#\s+(.+)$/m);
  return heading?.[1]?.trim() || fallback;
};

const parseDescription = (markdown: string) => {
  const descriptionLine = markdown.match(/^description:\s*(.+)$/m);
  return descriptionLine?.[1]?.trim() || "";
};

const toSkillId = (path: string) => {
  const match = path.match(/skills\/([^/]+)\/SKILL\.md$/);
  return match?.[1] || path;
};

const buildSkillDefinitions = (): Script2VideoSkillDefinition[] =>
  Object.entries(skillMarkdownModules).map(([path, markdown]) => {
    const id = toSkillId(path);
    return {
      id,
      title: parseTitle(markdown, id),
      description: parseDescription(markdown),
      systemOverlay: markdown,
    };
  });

export class LocalSkillLoader implements Script2VideoSkillLoader {
  private readonly skills = buildSkillDefinitions();

  listSkills(): Script2VideoSkillDefinition[] {
    return this.skills;
  }

  getSkill(id: string): Script2VideoSkillDefinition | null {
    return this.skills.find((skill) => skill.id === id) || null;
  }
}

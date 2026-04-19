import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { SourceContext, WorkflowSpec } from "@/lib/workflow/schema";

type RoutedEntityType = Extract<WorkflowSpec["entityType"], "company" | "person">;

interface SkillRouteProfile {
  strongPhrases: readonly string[];
  weakPhrases: readonly string[];
  defaultEntityType?: RoutedEntityType;
  defaultUiIntent?: WorkflowSpec["uiIntent"];
  defaultLlmTask?: WorkflowSpec["llmTask"];
  preferEnrichment?: boolean;
  preferSearch?: boolean;
}

export interface UseCaseSkill {
  slug: string;
  name: string;
  description: string;
  body: string;
  examples: string[];
  path: string;
  routeProfile: SkillRouteProfile;
}

export interface UseCaseSkillMatch {
  skill: UseCaseSkill;
  score: number;
  reasons: string[];
}

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const IDENTIFIER_PATTERN =
  /(?:https?:\/\/[^\s,]+|\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)/i;
const PERSON_LANGUAGE = [
  "candidate",
  "candidates",
  "people",
  "person",
  "talent",
  "recruit",
  "recruiting",
  "hire",
  "hiring",
  "linkedin",
  "profile",
  "profiles",
  "champion",
  "stakeholder",
] as const;
const COMPANY_LANGUAGE = [
  "company",
  "companies",
  "startup",
  "startups",
  "account",
  "accounts",
  "prospect",
  "prospects",
  "portfolio",
  "watchlist",
  "market",
  "thesis",
  "corp dev",
  "outbound",
] as const;
const DISCOVERY_LANGUAGE = [
  "find",
  "search",
  "discover",
  "research",
  "source",
  "build",
  "monitor",
  "rank",
  "list",
  "shortlist",
] as const;

const ROUTE_PROFILES: Record<string, SkillRouteProfile> = {
  "build-candidate-lists": {
    strongPhrases: [
      "candidate list",
      "candidate shortlist",
      "recruiting dashboard",
      "talent shortlist",
    ],
    weakPhrases: [
      "candidate",
      "candidates",
      "shortlist",
      "recruiting",
      "hiring dashboard",
    ],
    defaultEntityType: "person",
    defaultUiIntent: "list",
    defaultLlmTask: "rank",
    preferSearch: true,
  },
  "build-internal-sales-tools": {
    strongPhrases: [
      "build an internal sales tool",
      "create an internal sales tool",
      "rep facing workspace",
      "sales workspace",
      "sales app",
    ],
    weakPhrases: [
      "internal sales tool",
      "workspace",
      "dashboard",
      "sales ops",
      "account research",
      "lead enrichment",
    ],
    defaultUiIntent: "dashboard",
    defaultLlmTask: "score",
    preferSearch: true,
  },
  "build-prospect-lists": {
    strongPhrases: [
      "prospect list",
      "prospecting table",
      "rank prospects",
      "outbound list",
    ],
    weakPhrases: [
      "prospect",
      "prospects",
      "prospecting",
      "outbound",
      "lead list",
    ],
    defaultEntityType: "company",
    defaultUiIntent: "table-first",
    defaultLlmTask: "rank",
    preferSearch: true,
  },
  "enrich-leads": {
    strongPhrases: [
      "enrich leads",
      "lead enrichment",
      "company enrichment",
      "enrich this csv",
      "enrich these linkedin",
      "enrich these domains",
    ],
    weakPhrases: [
      "enrich",
      "enrichment",
      "csv",
      "domain list",
      "linkedin urls",
      "business emails",
    ],
    defaultUiIntent: "table-first",
    defaultLlmTask: "classify",
    preferEnrichment: true,
  },
  "internal-sales-tools": {
    strongPhrases: [
      "account prioritization",
      "lead triage",
      "territory review",
      "pipeline inspection",
      "champion review",
    ],
    weakPhrases: [
      "sales tool",
      "sales dashboard",
      "account review",
      "triage dashboard",
      "pipeline",
    ],
    defaultUiIntent: "dashboard",
    defaultLlmTask: "score",
    preferSearch: true,
  },
  "monitor-companies-for-signals": {
    strongPhrases: [
      "monitor these companies",
      "watchlist dashboard",
      "company signals",
      "portfolio companies",
    ],
    weakPhrases: [
      "monitor",
      "watchlist",
      "signals",
      "hiring signals",
      "growth signals",
    ],
    defaultEntityType: "company",
    defaultUiIntent: "dashboard",
    defaultLlmTask: "extract-signals",
    preferSearch: true,
  },
  "power-your-ai-sdr": {
    strongPhrases: [
      "sdr campaign",
      "outbound campaign",
      "buyer hunting",
      "multi threaded sdr",
    ],
    weakPhrases: [
      "sdr",
      "buyers",
      "buyer",
      "outreach",
      "revops",
      "account fit",
    ],
    defaultUiIntent: "dashboard",
    defaultLlmTask: "score",
    preferSearch: true,
  },
  "power-your-deal-sourcing-platform": {
    strongPhrases: [
      "deal sourcing",
      "origination",
      "corp dev",
      "acquisition targets",
    ],
    weakPhrases: [
      "acquisition",
      "m a",
      "sourcing platform",
      "targets",
      "investment thesis",
    ],
    defaultEntityType: "company",
    defaultUiIntent: "comparison-view",
    defaultLlmTask: "rank",
    preferSearch: true,
  },
  "power-your-recruiting-platform": {
    strongPhrases: [
      "recruiting platform",
      "candidate scout",
      "talent intelligence",
      "recruiter workspace",
    ],
    weakPhrases: [
      "recruiting",
      "recruiter",
      "hiring",
      "talent",
      "candidate dashboard",
    ],
    defaultEntityType: "person",
    defaultUiIntent: "dashboard",
    defaultLlmTask: "rank",
    preferSearch: true,
  },
  "track-champions": {
    strongPhrases: [
      "track champions",
      "champion tracking",
      "likely champions",
      "stakeholder emails",
    ],
    weakPhrases: [
      "champion",
      "champions",
      "stakeholder",
      "advocate",
      "influence",
    ],
    defaultEntityType: "person",
    defaultUiIntent: "dashboard",
    defaultLlmTask: "score",
    preferSearch: true,
  },
  "venture-capital": {
    strongPhrases: [
      "venture capital",
      "investment thesis",
      "vc sourcing",
      "investor summary",
    ],
    weakPhrases: [
      "venture",
      "investor",
      "investment",
      "portfolio",
      "fund",
      "startup research",
    ],
    defaultEntityType: "company",
    defaultUiIntent: "report",
    defaultLlmTask: "research",
    preferSearch: true,
  },
};

let cachedSkills: UseCaseSkill[] | null = null;

export function listUseCaseSkills() {
  cachedSkills ??= loadUseCaseSkills();
  return cachedSkills;
}

export function matchUseCaseSkill(
  prompt: string,
  sourceContext?: SourceContext | null,
) {
  if (!prompt.trim()) {
    return null;
  }

  const normalizedText = normalizeForMatch(
    [
      prompt,
      sourceContext?.label ?? "",
      sourceContext?.content ?? "",
      ...extractSourceContextFragments(sourceContext),
    ].join(" "),
  );
  const rawText = [
    prompt,
    sourceContext?.label ?? "",
    sourceContext?.content ?? "",
    ...extractSourceContextFragments(sourceContext),
  ].join("\n");
  const skills = listUseCaseSkills();
  let bestMatch: UseCaseSkillMatch | null = null;

  for (const skill of skills) {
    const candidate = scoreUseCaseSkill(skill, normalizedText, rawText, sourceContext);
    if (!candidate) {
      continue;
    }

    if (
      !bestMatch ||
      candidate.score > bestMatch.score ||
      (candidate.score === bestMatch.score &&
        skill.slug.localeCompare(bestMatch.skill.slug) < 0)
    ) {
      bestMatch = {
        skill,
        score: candidate.score,
        reasons: candidate.reasons,
      };
    }
  }

  return bestMatch;
}

export function buildUseCaseSkillContext(match: UseCaseSkillMatch | null) {
  if (!match) {
    return null;
  }

  return [
    `Matched use-case skill: ${humanizeSkillName(match.skill.name)}`,
    `Skill file: use-case-skills/${match.skill.slug}/SKILL.md`,
    `Description: ${match.skill.description}`,
    `Routing reasons: ${match.reasons.join("; ") || "best available semantic match"}.`,
    "Use this skill guidance when translating the request into a workflow unless the user explicitly overrides it.",
    match.skill.body.trim(),
  ].join("\n\n");
}

function loadUseCaseSkills() {
  const skillsRoot = path.resolve(process.cwd(), "use-case-skills");

  if (!existsSync(skillsRoot)) {
    return [];
  }

  return readdirSync(skillsRoot, {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const skillPath = path.join(skillsRoot, entry.name, "SKILL.md");
      if (!existsSync(skillPath)) {
        return null;
      }

      const parsed = parseSkillMarkdown(readFileSync(skillPath, "utf8"));

      return {
        slug: entry.name,
        name: parsed.name || entry.name,
        description: parsed.description || "",
        body: parsed.body.trim(),
        examples: extractExamples(parsed.body),
        path: skillPath,
        routeProfile: ROUTE_PROFILES[entry.name] ?? {
          strongPhrases: [],
          weakPhrases: [],
        },
      } satisfies UseCaseSkill;
    })
    .filter((skill): skill is UseCaseSkill => Boolean(skill))
    .sort((left, right) => left.slug.localeCompare(right.slug));
}

function parseSkillMarkdown(markdown: string) {
  const match = markdown.match(FRONTMATTER_PATTERN);
  if (!match) {
    return {
      name: "",
      description: "",
      body: markdown,
    };
  }

  const attributes = parseFrontmatterBlock(match[1]);

  return {
    name: attributes.name ?? "",
    description: attributes.description ?? "",
    body: match[2],
  };
}

function parseFrontmatterBlock(block: string) {
  return block.split(/\r?\n/).reduce<Record<string, string>>((accumulator, line) => {
    const [key, ...rest] = line.split(":");
    if (!key || rest.length === 0) {
      return accumulator;
    }

    accumulator[key.trim()] = rest.join(":").trim();
    return accumulator;
  }, {});
}

function extractExamples(body: string) {
  const exampleSection = body.match(/## Example Prompts\s*([\s\S]*)$/);
  if (!exampleSection) {
    return [];
  }

  return exampleSection[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim().replace(/^"+|"+$/g, ""))
    .filter(Boolean);
}

function extractSourceContextFragments(sourceContext?: SourceContext | null) {
  if (!sourceContext?.records.length) {
    return [];
  }

  return sourceContext.records
    .slice(0, 5)
    .flatMap((row) => Object.values(row))
    .filter(Boolean);
}

function scoreUseCaseSkill(
  skill: UseCaseSkill,
  normalizedText: string,
  rawText: string,
  sourceContext?: SourceContext | null,
) {
  let score = 0;
  const reasons: string[] = [];
  const identifiersProvided =
    IDENTIFIER_PATTERN.test(rawText) || Boolean(sourceContext?.records.length);

  score += scoreMatchedPhrases(
    normalizedText,
    skill.routeProfile.strongPhrases,
    12,
    reasons,
  );
  score += scoreMatchedPhrases(
    normalizedText,
    skill.routeProfile.weakPhrases,
    4,
    reasons,
  );

  if (skill.routeProfile.preferEnrichment && identifiersProvided) {
    score += 8;
    reasons.push("existing identifiers or uploaded rows favor direct enrichment");
  }

  if (
    skill.routeProfile.preferSearch &&
    !identifiersProvided &&
    containsAnyPhrase(normalizedText, DISCOVERY_LANGUAGE)
  ) {
    score += 4;
    reasons.push("exploratory language favors search-first routing");
  }

  if (
    skill.routeProfile.defaultEntityType === "person" &&
    containsAnyPhrase(normalizedText, PERSON_LANGUAGE)
  ) {
    score += 3;
    reasons.push("person-oriented language matched");
  }

  if (
    skill.routeProfile.defaultEntityType === "company" &&
    containsAnyPhrase(normalizedText, COMPANY_LANGUAGE)
  ) {
    score += 3;
    reasons.push("company-oriented language matched");
  }

  if (
    sourceContext?.kind === "csv" &&
    containsAnyPhrase(normalizedText, ["csv", "sheet", "spreadsheet"])
  ) {
    score += 2;
    reasons.push("csv context matched");
  }

  if (
    skill.slug === "build-internal-sales-tools" &&
    containsAnyPhrase(normalizedText, ["build", "create", "design", "tool", "workspace"])
  ) {
    score += 6;
    reasons.push("product-building sales language matched");
  }

  if (
    skill.slug === "internal-sales-tools" &&
    containsAnyPhrase(normalizedText, ["workspace", "dashboard", "tool"])
  ) {
    score += 3;
    reasons.push("sales workspace language matched");
  }

  if (
    skill.slug === "power-your-recruiting-platform" &&
    containsAnyPhrase(normalizedText, ["platform", "workspace", "scout", "dashboard"])
  ) {
    score += 4;
    reasons.push("recruiting-platform language matched");
  }

  if (
    skill.slug === "build-candidate-lists" &&
    containsAnyPhrase(normalizedText, ["candidate list", "shortlist", "candidate shortlist"])
  ) {
    score += 5;
    reasons.push("candidate-list language matched");
  }

  if (
    skill.slug === "build-prospect-lists" &&
    containsAnyPhrase(normalizedText, ["prospect list", "prospecting table", "outbound list"])
  ) {
    score += 5;
    reasons.push("prospect-list language matched");
  }

  if (score === 0) {
    return null;
  }

  return {
    score,
    reasons: dedupe(reasons).slice(0, 4),
  };
}

function scoreMatchedPhrases(
  normalizedText: string,
  phrases: readonly string[],
  points: number,
  reasons: string[],
) {
  let score = 0;

  for (const phrase of phrases) {
    if (!containsNormalizedPhrase(normalizedText, phrase)) {
      continue;
    }

    score += points;
    reasons.push(`matched "${phrase}"`);
  }

  return score;
}

function containsNormalizedPhrase(text: string, phrase: string) {
  const normalizedPhrase = normalizeForMatch(phrase);
  return normalizedPhrase.length > 0 && text.includes(normalizedPhrase);
}

function containsAnyPhrase(text: string, phrases: readonly string[]) {
  return phrases.some((phrase) => containsNormalizedPhrase(text, phrase));
}

function normalizeForMatch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function humanizeSkillName(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function dedupe(values: string[]) {
  return [...new Set(values)];
}

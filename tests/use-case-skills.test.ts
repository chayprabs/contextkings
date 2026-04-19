import { describe, expect, it } from "vitest";
import {
  buildUseCaseSkillContext,
  listUseCaseSkills,
  matchUseCaseSkill,
} from "@/lib/use-case-skills";
import { heuristicWorkflowFromPrompt } from "@/lib/workflow/planner";
import { createThreadStateSnapshot, type SourceContext } from "@/lib/workflow/schema";

describe("use-case skill routing", () => {
  it("loads workflow skills from the local use-case-skills directory", () => {
    const skills = listUseCaseSkills();

    expect(skills.length).toBeGreaterThan(0);
    expect(skills.some((skill) => skill.slug === "enrich-leads")).toBe(true);
  });

  it("matches enrichment-heavy prompts to the enrich-leads skill and exposes its context", () => {
    const sourceContext: SourceContext = {
      kind: "csv",
      label: "domains.csv",
      content: "domain\nopenai.com\nstripe.com",
      records: [
        { domain: "openai.com" },
        { domain: "stripe.com" },
      ],
    };

    const match = matchUseCaseSkill(
      "Enrich this CSV of company domains and classify each one by ICP fit.",
      sourceContext,
    );
    const context = buildUseCaseSkillContext(match);

    expect(match?.skill.slug).toBe("enrich-leads");
    expect(context).toContain("use-case-skills/enrich-leads/SKILL.md");
    expect(context).toContain("Enrich Leads");
  });

  it("uses the matched enrich-leads skill to bias fallback workflows toward direct enrichment", () => {
    const sourceContext: SourceContext = {
      kind: "csv",
      label: "domains.csv",
      content: "domain\nopenai.com\nstripe.com",
      records: [
        { domain: "openai.com" },
        { domain: "stripe.com" },
      ],
    };

    const workflow = heuristicWorkflowFromPrompt(
      "Enrich this CSV of company domains and classify each one by ICP fit.",
      createThreadStateSnapshot({
        sourceContext,
      }),
      sourceContext,
    );

    expect(workflow.inputMode).toBe("csv");
    expect(workflow.crustPlan[0]?.step).toBe("company-enrich");
    expect(workflow.assumptions.join(" ")).toContain("enrich-leads");
  });

  it("prefers the internal sales build skill for product-shaping sales requests", () => {
    const match = matchUseCaseSkill(
      "Build an internal sales tool that enriches target accounts and highlights warm signals.",
    );

    expect(match?.skill.slug).toBe("build-internal-sales-tools");
  });
});

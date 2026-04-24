import { BaseStep } from "./base.js";
import { registerStep } from "./registry.js";
import type { StepDescription, PreflightResult, StepResult, RunContext } from "../types.js";

export class ReviewRequirementsStep extends BaseStep {
  describe(): StepDescription {
    return {
      id: this.definition.id,
      type: "review-requirements",
      summary: "Summarize build state from requirements and inventory. Suggest next step.",
      prerequisites: ["UI_REQUIREMENTS.md", "COMPONENT_INVENTORY.md"],
      artifacts: [],
      passCondition: "Review completed. Always passes — informational only.",
      failCondition: "never",
      scope: "page",
      verification: "command-result",
    };
  }

  async preflight(ctx: RunContext): Promise<PreflightResult> {
    const issues: string[] = [];
    const reqExists = await ctx.exists(ctx.config.artifacts.requirements);
    const invExists = await ctx.exists(ctx.config.artifacts.inventory);
    if (!reqExists) issues.push(`Missing ${ctx.config.artifacts.requirements}`);
    if (!invExists) issues.push(`Missing ${ctx.config.artifacts.inventory}`);
    return { ready: issues.length === 0, issues };
  }

  async execute(ctx: RunContext): Promise<StepResult> {
    const result = await ctx.invokeCommand("/review-requirements");
    return {
      status: "passed",
      artifacts: [],
      metrics: {},
      message: result.success
        ? "Requirements review completed."
        : "Requirements review attempted (some data may be incomplete).",
    };
  }
}

registerStep("review-requirements", ReviewRequirementsStep);

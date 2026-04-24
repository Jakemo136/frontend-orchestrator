import { BaseStep } from "./base.js";
import { registerStep } from "./registry.js";
import type { StepDescription, PreflightResult, StepResult, RunContext } from "../types.js";

export class VisualQaStep extends BaseStep {
  describe(): StepDescription {
    return {
      id: this.definition.id,
      type: "visual-qa",
      summary: "UX quality review — Nielsen heuristics, Gestalt principles, interaction quality.",
      prerequisites: ["DESIGN_AUDIT.md"],
      artifacts: ["VISUAL_QA.md"],
      passCondition: "Visual QA command succeeds.",
      failCondition: "Design audit not run first or command fails.",
      scope: "page",
      verification: "command-result",
    };
  }

  async preflight(ctx: RunContext): Promise<PreflightResult> {
    const exists = await ctx.exists(ctx.config.artifacts.design_audit);
    return {
      ready: exists,
      issues: exists ? [] : [`Missing ${ctx.config.artifacts.design_audit} — run design-audit first`],
    };
  }

  async execute(ctx: RunContext): Promise<StepResult> {
    const result = await ctx.invokeCommand("/visual-qa");
    return {
      status: result.success ? "passed" : "failed",
      artifacts: result.artifacts,
      metrics: {},
      message: result.success
        ? "Visual QA completed."
        : `Visual QA failed: ${result.error ?? "unknown error"}`,
    };
  }
}

registerStep("visual-qa", VisualQaStep);

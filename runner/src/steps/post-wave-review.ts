import { BaseStep } from "./base.js";
import { registerStep } from "./registry.js";
import type { StepDescription, PreflightResult, StepResult, RunContext } from "../types.js";

export class PostWaveReviewStep extends BaseStep {
  describe(): StepDescription {
    return {
      id: this.definition.id,
      type: "post-wave-review",
      summary: "Run code-reviewer, code-simplifier, design-audit, and wiring audit on touched routes after a wave.",
      prerequisites: [],
      artifacts: [],
      passCondition: "No critical issues. Wiring tests exist for every parent-child rendering edge. No fireEvent.change for text inputs. Schema-driven MSW used (no hand-written JSON mocks).",
      failCondition: "Critical issues found, missing wiring tests, or convention violations.",
      scope: "page",
    };
  }

  async preflight(_ctx: RunContext): Promise<PreflightResult> {
    return { ready: true, issues: [] };
  }

  async execute(ctx: RunContext): Promise<StepResult> {
    const review = await ctx.invokeCommand("/code-review");
    const simplify = await ctx.invokeCommand("/code-simplify");
    const audit = await ctx.invokeCommand("/design-audit");

    const failures: string[] = [];
    if (!review.success) failures.push("code-review");
    if (!simplify.success) failures.push("code-simplify");
    if (!audit.success) failures.push("design-audit");

    // Wiring audit: verify integration tests exist for parent-child edges
    const wiringAudit = await ctx.invokeCommand("/wiring-audit");
    if (!wiringAudit.success) failures.push("wiring-audit");

    if (failures.length > 0) {
      return {
        status: "failed",
        artifacts: audit.artifacts,
        metrics: { review_issues: failures.length },
        message: `Issues found in: ${failures.join(", ")}. ${wiringAudit.success ? "" : "Missing wiring tests for parent-child prop flows."}`,
      };
    }

    return {
      status: "passed",
      artifacts: audit.artifacts,
      metrics: { review_issues: 0 },
      message: "Post-wave review passed. Code quality, design, and wiring audit clean.",
    };
  }
}

registerStep("post-wave-review", PostWaveReviewStep);

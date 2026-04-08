import { BaseStep } from "./base.js";
import { registerStep } from "./registry.js";
import type { StepDescription, PreflightResult, StepResult, RunContext } from "../types.js";

export class PreCommitReviewStep extends BaseStep {
  describe(): StepDescription {
    return {
      id: this.definition.id,
      type: "pre-commit-review",
      summary: "Run code-reviewer, code-simplifier, and all test suites before committing.",
      prerequisites: [],
      artifacts: [],
      passCondition: "All tests pass and no critical review issues.",
      failCondition: "Tests fail or critical review issues found.",
      scope: "component",
    };
  }

  async preflight(_ctx: RunContext): Promise<PreflightResult> {
    return { ready: true, issues: [] };
  }

  async execute(ctx: RunContext): Promise<StepResult> {
    const review = await ctx.invokeCommand("/code-review");
    const simplify = await ctx.invokeCommand("/code-simplify");

    const typecheck = await ctx.exec(ctx.config.commands.typecheck);
    const clientTests = await ctx.exec(ctx.config.commands.test_client);
    const e2e = await ctx.exec(ctx.config.commands.test_e2e);

    const failures: string[] = [];
    if (!review.success) failures.push("code-review found critical issues");
    if (!simplify.success) failures.push("code-simplify found critical issues");
    if (typecheck.exitCode !== 0) failures.push("typecheck failed");
    if (clientTests.exitCode !== 0) failures.push("client tests failed");
    if (e2e.exitCode !== 0) failures.push("E2E tests failed");

    if (failures.length > 0) {
      return {
        status: "failed",
        artifacts: [],
        metrics: { failure_count: failures.length },
        message: `Pre-commit review failed: ${failures.join("; ")}`,
      };
    }

    return {
      status: "passed",
      artifacts: [],
      metrics: { failure_count: 0 },
      message: "Pre-commit review passed. All checks green.",
    };
  }
}

registerStep("pre-commit-review", PreCommitReviewStep);

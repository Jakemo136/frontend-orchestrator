import { BaseStep } from "./base.js";
import { registerStep } from "./registry.js";
import type { StepDescription, PreflightResult, StepResult, RunContext } from "../types.js";

export class E2eGreenStep extends BaseStep {
  describe(): StepDescription {
    return {
      id: this.definition.id,
      type: "e2e-green",
      summary: "Run full E2E test suite and require all tests to pass.",
      prerequisites: [],
      artifacts: [],
      passCondition: "E2E tests exit with code 0.",
      failCondition: "Any E2E test fails.",
      scope: "page",
    };
  }

  async preflight(_ctx: RunContext): Promise<PreflightResult> {
    return { ready: true, issues: [] };
  }

  async execute(ctx: RunContext): Promise<StepResult> {
    const result = await ctx.exec(ctx.config.commands.test_e2e);

    if (result.exitCode !== 0) {
      return {
        status: "failed",
        artifacts: [],
        metrics: { e2e_exit_code: result.exitCode },
        message: `E2E tests failed:\n${result.stderr || result.stdout}`,
      };
    }

    return {
      status: "passed",
      artifacts: [],
      metrics: { e2e_exit_code: 0 },
      message: "All E2E tests passed.",
    };
  }
}

registerStep("e2e-green", E2eGreenStep);

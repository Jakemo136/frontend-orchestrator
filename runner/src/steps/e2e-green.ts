import { BaseStep } from "./base.js";
import { registerStep } from "./registry.js";
import { tryParseEvidence } from "../evidence/utils.js";
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
      verification: "exit-code",
    };
  }

  async preflight(_ctx: RunContext): Promise<PreflightResult> {
    return { ready: true, issues: [] };
  }

  async execute(ctx: RunContext): Promise<StepResult> {
    const result = await ctx.exec(ctx.config.commands.test_e2e);
    const evidence = tryParseEvidence(ctx, this.definition.id);

    if (result.exitCode !== 0) {
      return {
        status: "failed",
        artifacts: evidence?.manifestPath ? [evidence.manifestPath] : [],
        metrics: {
          e2e_exit_code: result.exitCode,
          ...(evidence && { totalTests: evidence.totalTests, passed: evidence.passed, failed: evidence.failed }),
        },
        message: evidence
          ? `${evidence.failed}/${evidence.totalTests} E2E tests failed. Evidence: ${evidence.manifestPath}`
          : `E2E tests failed:\n${result.stderr || result.stdout}`,
        evidence,
      };
    }

    const message = evidence
      ? `All ${evidence.totalTests} E2E tests passed.`
      : "All E2E tests passed.";

    return {
      status: "passed",
      artifacts: evidence?.manifestPath ? [evidence.manifestPath] : [],
      metrics: {
        e2e_exit_code: 0,
        ...(evidence && { totalTests: evidence.totalTests, passed: evidence.passed }),
      },
      message,
      evidence,
    };
  }
}

registerStep("e2e-green", E2eGreenStep);

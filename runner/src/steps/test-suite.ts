import { BaseStep } from "./base.js";
import { registerStep } from "./registry.js";
import { tryParseEvidence } from "../evidence/utils.js";
import type { StepDescription, PreflightResult, StepResult, RunContext } from "../types.js";

export class TestSuiteStep extends BaseStep {
  describe(): StepDescription {
    return {
      id: this.definition.id,
      type: "test-suite",
      summary: "Runs typecheck, client test suite, and E2E suite for the current wave.",
      prerequisites: [],
      artifacts: [],
      passCondition: "Typecheck and client tests pass. E2E is informational unless e2e_blocking is true.",
      failCondition: "Typecheck or client tests fail, or E2E fails when e2e_blocking is true.",
      scope: "component",
      verification: "exit-code",
    };
  }

  async preflight(_ctx: RunContext): Promise<PreflightResult> {
    return { ready: true, issues: [] };
  }

  private buildSuccessMessage(e2ePassed: boolean, evidence: any): string {
    if (e2ePassed) {
      return evidence ? `All ${evidence.totalTests} tests passed.` : "All tests passed.";
    }
    if (evidence) {
      return `Typecheck and client tests passed. ${evidence.failed}/${evidence.totalTests} E2E failures recorded (non-blocking). Evidence: ${evidence.manifestPath}`;
    }
    return "Typecheck and client tests passed. E2E failures recorded (non-blocking).";
  }

  async execute(ctx: RunContext): Promise<StepResult> {
    const e2eBlocking = (this.definition.params.e2e_blocking as boolean) ?? false;

    const typecheck = await ctx.exec(ctx.config.commands.typecheck);
    if (typecheck.exitCode !== 0) {
      return {
        status: "failed",
        artifacts: [],
        metrics: { typecheck: 1, client_tests: 0, e2e: 0 },
        message: `Typecheck failed:\n${typecheck.stderr || typecheck.stdout}`,
      };
    }

    const clientTests = await ctx.exec(ctx.config.commands.test_client);
    if (clientTests.exitCode !== 0) {
      return {
        status: "failed",
        artifacts: [],
        metrics: { typecheck: 0, client_tests: 1, e2e: 0 },
        message: `Client tests failed:\n${clientTests.stderr || clientTests.stdout}`,
      };
    }

    const e2e = await ctx.exec(ctx.config.commands.test_e2e);
    const e2ePassed = e2e.exitCode === 0;

    const evidence = tryParseEvidence(ctx, this.definition.id);

    if (!e2ePassed && e2eBlocking) {
      return {
        status: "failed",
        artifacts: evidence?.manifestPath ? [evidence.manifestPath] : [],
        metrics: {
          typecheck: 0,
          client_tests: 0,
          e2e: 1,
          ...(evidence && { totalTests: evidence.totalTests, passed: evidence.passed, failed: evidence.failed }),
        },
        message: evidence
          ? `${evidence.failed}/${evidence.totalTests} E2E tests failed. Evidence: ${evidence.manifestPath}`
          : `E2E tests failed (blocking):\n${e2e.stderr || e2e.stdout}`,
        evidence,
      };
    }

    const message = this.buildSuccessMessage(e2ePassed, evidence);

    return {
      status: "passed",
      artifacts: evidence?.manifestPath ? [evidence.manifestPath] : [],
      metrics: {
        typecheck: 0,
        client_tests: 0,
        e2e: e2ePassed ? 0 : 1,
        ...(evidence && { totalTests: evidence.totalTests, passed: evidence.passed, failed: evidence.failed }),
      },
      message,
      evidence,
    };
  }
}

registerStep("test-suite", TestSuiteStep);

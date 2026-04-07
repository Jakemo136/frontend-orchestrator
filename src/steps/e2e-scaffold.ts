import { BaseStep } from "./base.js";
import { registerStep } from "./registry.js";
import type { StepDescription, PreflightResult, StepResult, RunContext } from "../types.js";

export class E2eScaffoldStep extends BaseStep {
  describe(): StepDescription {
    return {
      id: this.definition.id,
      type: "e2e-scaffold",
      summary: "Scaffold E2E test files from requirements via e2e-writer subagent.",
      prerequisites: ["UI_REQUIREMENTS.md"],
      artifacts: [],
      passCondition: "E2E scaffold command succeeds.",
      failCondition: "Command fails or requirements missing.",
      scope: "page",
    };
  }

  async preflight(ctx: RunContext): Promise<PreflightResult> {
    const exists = await ctx.exists(ctx.config.artifacts.requirements);
    return {
      ready: exists,
      issues: exists ? [] : [`Missing ${ctx.config.artifacts.requirements}`],
    };
  }

  async execute(ctx: RunContext): Promise<StepResult> {
    const result = await ctx.invokeCommand("/build-pipeline:e2e");
    return {
      status: result.success ? "passed" : "failed",
      artifacts: result.artifacts,
      metrics: {},
      message: result.success
        ? "E2E tests scaffolded."
        : `E2E scaffold failed: ${result.error ?? "unknown error"}`,
    };
  }
}

registerStep("e2e-scaffold", E2eScaffoldStep);

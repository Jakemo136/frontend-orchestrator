import { BaseStep } from "./base.js";
import { registerStep } from "./registry.js";
import type { StepDescription, PreflightResult, StepResult, RunContext } from "../types.js";

export class SetBaselineStep extends BaseStep {
  describe(): StepDescription {
    return {
      id: this.definition.id,
      type: "set-baseline",
      summary: "Promote current screenshots to visual regression baseline. Requires user approval.",
      prerequisites: [],
      artifacts: [],
      passCondition: "User approves baseline overwrite and command succeeds.",
      failCondition: "User rejects or command fails.",
      scope: "page",
      verification: "approval",
    };
  }

  async preflight(_ctx: RunContext): Promise<PreflightResult> {
    return { ready: true, issues: [] };
  }

  async execute(ctx: RunContext): Promise<StepResult> {
    try {
      await ctx.awaitApproval("Overwrite visual regression baseline with current screenshots?");
    } catch {
      return {
        status: "failed",
        artifacts: [],
        metrics: {},
        message: "User declined baseline overwrite.",
      };
    }

    const result = await ctx.invokeCommand("/set-baseline");
    return {
      status: result.success ? "passed" : "failed",
      artifacts: result.artifacts,
      metrics: {},
      message: result.success
        ? "Baseline updated."
        : `Baseline update failed: ${result.error ?? "unknown error"}`,
    };
  }
}

registerStep("set-baseline", SetBaselineStep);

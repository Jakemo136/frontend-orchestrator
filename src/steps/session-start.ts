import { BaseStep } from "./base.js";
import { registerStep } from "./registry.js";
import type { StepDescription, PreflightResult, StepResult, RunContext } from "../types.js";

export class SessionStartStep extends BaseStep {
  describe(): StepDescription {
    return {
      id: this.definition.id,
      type: "session-start",
      summary: "Read project docs (CLAUDE.md, requirements, inventory, build status). Produce structured briefing.",
      prerequisites: [],
      artifacts: [],
      passCondition: "briefing generated. Always passes — missing files are reported, not fatal.",
      failCondition: "never",
      scope: "component",
    };
  }

  async preflight(_ctx: RunContext): Promise<PreflightResult> {
    return { ready: true, issues: [] };
  }

  async execute(ctx: RunContext): Promise<StepResult> {
    const result = await ctx.invokeCommand("/session-start");
    return {
      status: "passed",
      artifacts: [],
      metrics: {},
      message: result.success
        ? "Session briefing generated."
        : "Session briefing attempted (some docs may be missing).",
    };
  }
}

registerStep("session-start", SessionStartStep);

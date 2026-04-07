import { BaseStep } from "./base.js";
import { registerStep } from "./registry.js";
import type { StepDescription, PreflightResult, StepResult, RunContext } from "../types.js";

export class DesignAuditStep extends BaseStep {
  describe(): StepDescription {
    return {
      id: this.definition.id,
      type: "design-audit",
      summary: "Run full design and accessibility audit at all breakpoints.",
      prerequisites: [],
      artifacts: ["DESIGN_AUDIT.md"],
      passCondition: "Design audit command succeeds.",
      failCondition: "Dev server not running or audit command fails.",
      scope: "page",
    };
  }

  async preflight(ctx: RunContext): Promise<PreflightResult> {
    const health = await ctx.exec(
      "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000",
    );
    const isUp = health.stdout.trim() === "200";
    return {
      ready: isUp,
      issues: isUp ? [] : ["Dev server not responding at http://localhost:3000"],
    };
  }

  async execute(ctx: RunContext): Promise<StepResult> {
    const result = await ctx.invokeCommand("/design-audit");
    return {
      status: result.success ? "passed" : "failed",
      artifacts: result.artifacts,
      metrics: {},
      message: result.success
        ? "Design audit completed."
        : `Design audit failed: ${result.error ?? "unknown error"}`,
    };
  }
}

registerStep("design-audit", DesignAuditStep);

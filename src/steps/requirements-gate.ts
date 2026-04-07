import { BaseStep } from "./base.js";
import { registerStep } from "./registry.js";
import type { StepDescription, PreflightResult, StepResult, RunContext } from "../types.js";

export class RequirementsGateStep extends BaseStep {
  describe(): StepDescription {
    return {
      id: this.definition.id,
      type: "requirements-gate",
      summary: "Interactive requirements interview. Produces UI_REQUIREMENTS.md and COMPONENT_INVENTORY.md.",
      prerequisites: [],
      artifacts: ["UI_REQUIREMENTS.md", "COMPONENT_INVENTORY.md"],
      passCondition: "Both artifact files exist AND user has explicitly approved them.",
      failCondition: "User cancels, artifacts missing, or user rejects approval.",
      scope: "component",
    };
  }

  async preflight(_ctx: RunContext): Promise<PreflightResult> {
    return { ready: true, issues: [] };
  }

  async execute(ctx: RunContext): Promise<StepResult> {
    await ctx.invokeCommand("/ui-interview");

    const reqPath = ctx.config.artifacts.requirements;
    const invPath = ctx.config.artifacts.inventory;
    const reqExists = await ctx.exists(reqPath);
    const invExists = await ctx.exists(invPath);

    if (!reqExists || !invExists) {
      const missing = [!reqExists ? reqPath : null, !invExists ? invPath : null].filter(Boolean);
      return {
        status: "failed",
        artifacts: [],
        metrics: {},
        message: `Artifacts missing after interview: ${missing.join(", ")}`,
      };
    }

    try {
      await ctx.awaitApproval(`Review and approve:\n  - ${reqPath}\n  - ${invPath}`);
    } catch {
      return {
        status: "failed",
        artifacts: [],
        metrics: {},
        message: "User rejected requirements approval.",
      };
    }

    return {
      status: "passed",
      artifacts: [reqPath, invPath],
      metrics: {},
      message: "Requirements and inventory approved.",
    };
  }
}

registerStep("requirements-gate", RequirementsGateStep);

import { BaseStep } from "./base.js";
import { registerStep } from "./registry.js";
import type { StepDescription, PreflightResult, StepResult, RunContext } from "../types.js";

export class DependencyResolveStep extends BaseStep {
  describe(): StepDescription {
    return {
      id: this.definition.id,
      type: "dependency-resolve",
      summary: "Resolve component dependencies and produce BUILD_PLAN.md. Requires user approval.",
      prerequisites: ["COMPONENT_INVENTORY.md"],
      artifacts: ["BUILD_PLAN.md"],
      passCondition: "BUILD_PLAN.md exists and user approves the plan.",
      failCondition: "Inventory missing, BUILD_PLAN.md not generated, or user rejects.",
      scope: "page",
    };
  }

  async preflight(ctx: RunContext): Promise<PreflightResult> {
    const exists = await ctx.exists(ctx.config.artifacts.inventory);
    return {
      ready: exists,
      issues: exists ? [] : [`Missing ${ctx.config.artifacts.inventory}`],
    };
  }

  async execute(ctx: RunContext): Promise<StepResult> {
    await ctx.invokeCommand("/build-pipeline:resolve-deps");

    const planPath = ctx.config.artifacts.build_plan;
    const planExists = await ctx.exists(planPath);
    if (!planExists) {
      return {
        status: "failed",
        artifacts: [],
        metrics: {},
        message: `${planPath} not generated after dependency resolution.`,
      };
    }

    try {
      await ctx.awaitApproval(`Review and approve build plan: ${planPath}`);
    } catch {
      return {
        status: "failed",
        artifacts: [],
        metrics: {},
        message: "User rejected the build plan.",
      };
    }

    return {
      status: "passed",
      artifacts: [planPath],
      metrics: {},
      message: "Build plan approved.",
    };
  }
}

registerStep("dependency-resolve", DependencyResolveStep);

import { BaseStep } from "./base.js";
import { registerStep } from "./registry.js";
import type { StepDescription, PreflightResult, StepResult, RunContext } from "../types.js";

export class BuildWaveStep extends BaseStep {
  describe(): StepDescription {
    const wave = (this.definition.params.wave as number) ?? 0;
    return {
      id: this.definition.id,
      type: "build-wave",
      summary: `Build all components in wave ${wave} via /build-component. Each component runs TDD protocol + code review + wiring audit (verifies parent-child prop flow via integration tests).`,
      prerequisites: ["COMPONENT_INVENTORY.md"],
      artifacts: [],
      passCondition: "All components built, reviewed, and wiring-audited. Integration tests verify parent-child prop chains.",
      failCondition: "Any component build fails.",
      scope: "component",
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
    const wave = (this.definition.params.wave as number) ?? 0;
    const result = await ctx.invokeCommand("/build-component", `--wave ${wave}`);

    return {
      status: result.success ? "passed" : "failed",
      artifacts: result.artifacts,
      metrics: { wave },
      message: result.success
        ? `Wave ${wave} components built successfully.`
        : `Wave ${wave} build failed: ${result.error ?? "unknown error"}`,
    };
  }
}

registerStep("build-wave", BuildWaveStep);

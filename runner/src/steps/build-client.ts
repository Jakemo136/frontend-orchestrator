import { BaseStep } from "./base.js";
import { registerStep } from "./registry.js";
import type { StepDescription, PreflightResult, StepResult, RunContext } from "../types.js";

export class BuildClientStep extends BaseStep {
  describe(): StepDescription {
    const wave = (this.definition.params.wave as number) ?? 0;
    return {
      id: this.definition.id,
      type: "build-client",
      summary: `Run production client build for wave ${wave}.`,
      prerequisites: [],
      artifacts: [],
      passCondition: "Build command exits with code 0.",
      failCondition: "Build command exits with non-zero code.",
      scope: "component",
    };
  }

  async preflight(_ctx: RunContext): Promise<PreflightResult> {
    return { ready: true, issues: [] };
  }

  async execute(ctx: RunContext): Promise<StepResult> {
    const result = await ctx.exec(ctx.config.commands.build_client);
    if (result.exitCode !== 0) {
      return {
        status: "failed",
        artifacts: [],
        metrics: {},
        message: `Client build failed:\n${result.stderr || result.stdout}`,
      };
    }
    return {
      status: "passed",
      artifacts: [],
      metrics: {},
      message: "Client build succeeded.",
    };
  }
}

registerStep("build-client", BuildClientStep);

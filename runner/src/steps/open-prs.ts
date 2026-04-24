import { BaseStep } from "./base.js";
import { registerStep } from "./registry.js";
import type { StepDescription, PreflightResult, StepResult, RunContext } from "../types.js";

export class OpenPrsStep extends BaseStep {
  describe(): StepDescription {
    const wave = (this.definition.params.wave as number) ?? 0;
    return {
      id: this.definition.id,
      type: "open-prs",
      summary: `Create branches and open PRs for wave ${wave} components.`,
      prerequisites: [],
      artifacts: [],
      passCondition: "All PRs created and CI is green.",
      failCondition: "PR creation fails or CI fails.",
      scope: "component",
      verification: "command-result",
    };
  }

  async preflight(_ctx: RunContext): Promise<PreflightResult> {
    return { ready: true, issues: [] };
  }

  async execute(ctx: RunContext): Promise<StepResult> {
    const wave = (this.definition.params.wave as number) ?? 0;
    const result = await ctx.invokeCommand("/build-pipeline:open-prs", `--wave ${wave}`);

    if (!result.success) {
      return {
        status: "failed",
        artifacts: [],
        metrics: { wave },
        message: `Failed to open PRs for wave ${wave}: ${result.error ?? "unknown error"}`,
      };
    }

    return {
      status: "passed",
      artifacts: result.artifacts,
      metrics: { wave, pr_count: result.artifacts.length },
      message: `Wave ${wave} PRs opened: ${result.artifacts.length} PRs created.`,
    };
  }
}

registerStep("open-prs", OpenPrsStep);

import { BaseStep } from "./base.js";
import { registerStep } from "./registry.js";
import type { StepDescription, PreflightResult, StepResult, RunContext } from "../types.js";

export class AwaitMergeStep extends BaseStep {
  describe(): StepDescription {
    const wave = (this.definition.params.wave as number) ?? 0;
    return {
      id: this.definition.id,
      type: "await-merge",
      summary: `Wait for user to merge wave ${wave} PRs before proceeding.`,
      prerequisites: [],
      artifacts: [],
      passCondition: "All PRs for the wave are merged.",
      failCondition: "User declines or PRs remain unmerged.",
      scope: "component",
    };
  }

  async preflight(_ctx: RunContext): Promise<PreflightResult> {
    return { ready: true, issues: [] };
  }

  async execute(ctx: RunContext): Promise<StepResult> {
    const wave = (this.definition.params.wave as number) ?? 0;
    const prList = await ctx.exec(`gh pr list --label "wave-${wave}" --json number,state`);

    try {
      await ctx.awaitApproval(
        `Merge all wave ${wave} PRs, then confirm.\n\nCurrent PR status:\n${prList.stdout}`,
      );
    } catch {
      return {
        status: "failed",
        artifacts: [],
        metrics: { wave },
        message: `User declined to merge wave ${wave} PRs.`,
      };
    }

    return {
      status: "passed",
      artifacts: [],
      metrics: { wave },
      message: `Wave ${wave} PRs merged.`,
    };
  }
}

registerStep("await-merge", AwaitMergeStep);

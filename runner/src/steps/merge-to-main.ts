import { BaseStep } from "./base.js";
import { registerStep } from "./registry.js";
import type { StepDescription, PreflightResult, StepResult, RunContext } from "../types.js";

export class MergeToMainStep extends BaseStep {
  describe(): StepDescription {
    return {
      id: this.definition.id,
      type: "merge-to-main",
      summary: "Open PR from feature branch to main. Wait for user to merge.",
      prerequisites: [],
      artifacts: [],
      passCondition: "PR is created and user merges it.",
      failCondition: "No feature branch configured, PR creation fails, or user declines.",
      scope: "app",
    };
  }

  async preflight(ctx: RunContext): Promise<PreflightResult> {
    const branch = ctx.config.branches.feature;
    if (!branch) {
      return { ready: false, issues: ["No feature branch configured in config.branches.feature"] };
    }
    return { ready: true, issues: [] };
  }

  async execute(ctx: RunContext): Promise<StepResult> {
    const feature = ctx.config.branches.feature;
    const main = ctx.config.branches.main;

    const prResult = await ctx.exec(
      `gh pr create --base ${main} --head ${feature} --title "Merge ${feature} to ${main}" --body "Automated PR from orchestrator"`,
    );

    if (prResult.exitCode !== 0) {
      return {
        status: "failed",
        artifacts: [],
        metrics: {},
        message: `Failed to create PR: ${prResult.stderr || prResult.stdout}`,
      };
    }

    try {
      await ctx.awaitApproval(
        `PR created from ${feature} → ${main}. Review and merge, then confirm.\n\n${prResult.stdout}`,
      );
    } catch {
      return {
        status: "failed",
        artifacts: [],
        metrics: {},
        message: "User declined to merge to main.",
      };
    }

    return {
      status: "passed",
      artifacts: [],
      metrics: {},
      message: `Feature branch ${feature} merged to ${main}.`,
    };
  }
}

registerStep("merge-to-main", MergeToMainStep);

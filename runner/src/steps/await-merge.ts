import { BaseStep } from "./base.js";
import { registerStep } from "./registry.js";
import type { StepDescription, PreflightResult, StepResult, RunContext } from "../types.js";

interface PrRecord {
  number: number;
  state: string;
  title: string;
  statusCheckRollup: unknown[];
}

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
      failCondition: "PRs remain unmerged or cannot be validated.",
      scope: "component",
    };
  }

  async preflight(_ctx: RunContext): Promise<PreflightResult> {
    return { ready: true, issues: [] };
  }

  async execute(ctx: RunContext): Promise<StepResult> {
    const wave = (this.definition.params.wave as number) ?? 0;

    const prList = await ctx.exec(
      `gh pr list --label "wave-${wave}" --json number,state,title,statusCheckRollup`,
    );

    if (prList.exitCode !== 0) {
      return {
        status: "failed",
        artifacts: [],
        metrics: { wave },
        message: `gh pr list failed: ${prList.stderr || prList.stdout}`,
      };
    }

    let prs: PrRecord[];
    try {
      prs = JSON.parse(prList.stdout) as PrRecord[];
    } catch {
      return {
        status: "failed",
        artifacts: [],
        metrics: { wave },
        message: `Failed to parse gh pr list output: ${prList.stdout}`,
      };
    }

    if (prs.length === 0) {
      return {
        status: "failed",
        artifacts: [],
        metrics: { wave },
        message: `No PRs found for wave ${wave}`,
      };
    }

    const unmerged = prs.filter((pr) => pr.state !== "MERGED");
    if (unmerged.length > 0) {
      const list = unmerged.map((pr) => `#${pr.number} "${pr.title}" (${pr.state})`).join(", ");
      return {
        status: "failed",
        artifacts: [],
        metrics: { wave, unmerged_count: unmerged.length },
        message: `Wave ${wave} PRs not yet merged: ${list}`,
      };
    }

    return {
      status: "passed",
      artifacts: [],
      metrics: { wave, merged_count: prs.length },
      message: `Wave ${wave} PRs merged (${prs.length} total).`,
    };
  }
}

registerStep("await-merge", AwaitMergeStep);

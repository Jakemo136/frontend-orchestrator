import { BaseStep } from "./base.js";
import { registerStep } from "./registry.js";
import type { StepDescription, PreflightResult, StepResult, RunContext } from "../types.js";

interface StatusCheck {
  name: string;
  state: string;
}

interface PrRecord {
  number: number;
  state: string;
  title: string;
  statusCheckRollup: StatusCheck[];
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
      verification: "ci-check",
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

    const requiredChecks = ctx.config.ci.required_on_feature;
    const informationalChecks = ctx.config.ci.informational_on_feature;

    const ciFailures: string[] = [];
    const ciWarnings: string[] = [];

    if (requiredChecks.length > 0 || informationalChecks.length > 0) {
      for (const pr of prs) {
        const checksByName = new Map(pr.statusCheckRollup.map((c) => [c.name, c.state]));

        for (const check of requiredChecks) {
          const state = checksByName.get(check);
          if (state !== "SUCCESS" && state !== "SKIPPED") {
            ciFailures.push(`#${pr.number}: required check "${check}" was ${state ?? "missing"}`);
          }
        }

        for (const check of informationalChecks) {
          const state = checksByName.get(check);
          if (state !== "SUCCESS" && state !== "SKIPPED") {
            ciWarnings.push(`#${pr.number}: informational check "${check}" was ${state ?? "missing"}`);
          }
        }
      }
    }

    if (ciFailures.length > 0) {
      return {
        status: "failed",
        artifacts: [],
        metrics: { wave, merged_count: prs.length },
        message: `Wave ${wave} PRs merged but required CI checks failed: ${ciFailures.join("; ")}`,
      };
    }

    const warningNote = ciWarnings.length > 0 ? ` Warnings: ${ciWarnings.join("; ")}` : "";
    return {
      status: "passed",
      artifacts: [],
      metrics: { wave, merged_count: prs.length },
      message: `Wave ${wave} PRs merged (${prs.length} total).${warningNote}`,
    };
  }
}

registerStep("await-merge", AwaitMergeStep);

import { BaseStep } from "./base.js";
import { registerStep } from "./registry.js";
import { ApprovalDeniedError } from "../runner/approval.js";
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
      verification: "approval",
    };
  }

  async preflight(ctx: RunContext): Promise<PreflightResult> {
    const branch = ctx.config.branches.feature;
    if (!branch) {
      return { ready: false, issues: ["No feature branch configured in config.branches.feature"] };
    }
    const issues: string[] = [];
    const branchCheck = await ctx.exec(`git rev-parse --verify refs/heads/${branch}`);
    if (branchCheck.exitCode !== 0) {
      issues.push(`Feature branch "${branch}" does not exist in git`);
    }
    const ghCheck = await ctx.exec("gh auth status");
    if (ghCheck.exitCode !== 0) {
      issues.push("gh CLI is not authenticated — run 'gh auth login' first");
    }
    return { ready: issues.length === 0, issues };
  }

  async execute(ctx: RunContext): Promise<StepResult> {
    const feature = ctx.config.branches.feature;
    const main = ctx.config.branches.main;

    // Check for an existing open PR to avoid creating a duplicate
    let prUrl: string;
    const existingPrResult = await ctx.exec(
      `gh pr list --head ${feature} --base ${main} --state open --json number,url`,
    );
    if (existingPrResult.exitCode === 0) {
      let existingPrs: Array<{ number: number; url: string }> = [];
      try {
        existingPrs = JSON.parse(existingPrResult.stdout) as Array<{ number: number; url: string }>;
      } catch {
        // Parse failure — proceed to create PR
      }
      if (existingPrs.length > 0) {
        prUrl = existingPrs[0]!.url;
      } else {
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
        prUrl = prResult.stdout.trim().split("\n")[0]!;
      }
    } else {
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
      prUrl = prResult.stdout.trim().split("\n")[0]!;
    }

    let parseWarning = "";
    const requiredChecks = ctx.config.ci.required_on_main;
    if (requiredChecks.length > 0) {
      const checksResult = await ctx.exec(
        `gh pr checks ${prUrl} --json name,state`,
      );
      if (checksResult.exitCode === 0) {
        try {
          const checks = JSON.parse(checksResult.stdout) as Array<{ name: string; state: string }>;
          const checkNames = new Set(checks.map((c) => c.name));
          const missing = requiredChecks.filter((name) => !checkNames.has(name));
          const failing = checks
            .filter((c) => requiredChecks.includes(c.name))
            .filter((c) => c.state !== "SUCCESS" && c.state !== "SKIPPED");
          if (failing.length > 0 || missing.length > 0) {
            const parts: string[] = [];
            if (failing.length > 0) parts.push(failing.map((c) => `${c.name} (${c.state})`).join(", "));
            if (missing.length > 0) parts.push(missing.map((name) => `${name} (missing)`).join(", "));
            return {
              status: "failed",
              artifacts: [],
              metrics: { failing_checks: failing.length + missing.length },
              message: `Required CI checks not passing: ${parts.join("; ")}`,
            };
          }
        } catch {
          parseWarning = " (warning: could not parse CI check results)";
        }
      }
    }

    try {
      await ctx.awaitApproval(
        `PR created from ${feature} → ${main}. Review and merge, then confirm.\n\n${prUrl}`,
      );
    } catch (err) {
      if (!(err instanceof ApprovalDeniedError)) throw err;
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
      message: `Feature branch ${feature} merged to ${main}.${parseWarning}`,
    };
  }
}

registerStep("merge-to-main", MergeToMainStep);

import { BaseStep } from "./base.js";
import { registerStep } from "./registry.js";
import type { StepDescription, PreflightResult, StepResult, RunContext } from "../types.js";

export class DesignAuditStep extends BaseStep {
  describe(): StepDescription {
    return {
      id: this.definition.id,
      type: "design-audit",
      summary: "Run full design and accessibility audit at all breakpoints.",
      prerequisites: [],
      artifacts: ["DESIGN_AUDIT.md"],
      passCondition: "Design audit command succeeds.",
      failCondition: "Dev server not running or audit command fails.",
      scope: "page",
    };
  }

  async preflight(ctx: RunContext): Promise<PreflightResult> {
    const url = ctx.config.dev_server_url;
    const health = await ctx.exec(
      `curl -s -o /dev/null -w '%{http_code}|%{content_type}|%{response_code}|%{num_redirects}' --max-time 10 --max-redirs 0 ${url}`,
    );

    // exit code 7 = connection refused; exit code 47 = redirect (--max-redirs 0)
    // any other non-zero exit code is an unexpected failure
    if (health.exitCode !== 0 && health.exitCode !== 47) {
      return {
        ready: false,
        issues: [`Dev server not reachable at ${url} (exit code ${health.exitCode})`],
      };
    }

    const parts = health.stdout.trim().split("|");
    const finalCode = parseInt(parts[0] ?? "0", 10);
    const initialCode = parseInt(parts[2] ?? "0", 10);
    const redirectCount = parseInt(parts[3] ?? "0", 10);

    const issues: string[] = [];

    if (initialCode >= 300 && initialCode < 400) {
      issues.push(
        `Dev server at ${url} returned ${initialCode} (redirect). This may indicate an auth wall or misconfigured route.`,
      );
    } else if (initialCode === 401 || initialCode === 403) {
      issues.push(
        `Dev server at ${url} returned ${initialCode} (auth required). Configure authentication before running audit.`,
      );
    } else if (finalCode !== 200) {
      issues.push(`Dev server at ${url} returned HTTP ${finalCode}, expected 200.`);
    }

    if (redirectCount > 0 && issues.length === 0) {
      issues.push(
        `Dev server at ${url} redirected ${redirectCount} time(s). Audit may run against wrong page.`,
      );
    }

    return { ready: issues.length === 0, issues };
  }

  async execute(ctx: RunContext): Promise<StepResult> {
    const result = await ctx.invokeCommand("/design-audit");
    return {
      status: result.success ? "passed" : "failed",
      artifacts: result.artifacts,
      metrics: {},
      message: result.success
        ? "Design audit completed."
        : `Design audit failed: ${result.error ?? "unknown error"}`,
    };
  }
}

registerStep("design-audit", DesignAuditStep);

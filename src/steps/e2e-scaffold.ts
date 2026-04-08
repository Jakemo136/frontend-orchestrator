import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { BaseStep } from "./base.js";
import { registerStep } from "./registry.js";
import type { StepDescription, PreflightResult, StepResult, RunContext } from "../types.js";

const STARTER_CONFIG = `import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  retries: 1,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
});
`;

const CI_EVIDENCE_DOC = `# CI Evidence Upload

Upload test evidence as a CI artifact so failure dossiers are available for triage.

## GitHub Actions

\`\`\`yaml
- name: Upload test evidence
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: test-evidence-\${{ github.run_id }}
    path: .orchestrator/evidence/
    retention-days: 14
\`\`\`

## What gets uploaded

- evidence-manifest.json — structured index of all failures with paths
- [test-name]/trace.zip — Playwright trace (open with npx playwright show-trace)
- [test-name]/screenshot.png — failure screenshot
`;

export class E2eScaffoldStep extends BaseStep {
  describe(): StepDescription {
    return {
      id: this.definition.id,
      type: "e2e-scaffold",
      summary: "Scaffold E2E test files from requirements via e2e-writer subagent. Generates starter Playwright config if missing.",
      prerequisites: ["UI_REQUIREMENTS.md"],
      artifacts: [],
      passCondition: "E2E scaffold command succeeds.",
      failCondition: "Command fails or requirements missing.",
      scope: "page",
    };
  }

  async preflight(ctx: RunContext): Promise<PreflightResult> {
    const exists = await ctx.exists(ctx.config.artifacts.requirements);
    return {
      ready: exists,
      issues: exists ? [] : [`Missing ${ctx.config.artifacts.requirements}`],
    };
  }

  async execute(ctx: RunContext): Promise<StepResult> {
    const configPath = ctx.resolve(ctx.config.evidence.playwright_config);
    const hasConfig = await ctx.exists(ctx.config.evidence.playwright_config);

    if (!hasConfig) {
      mkdirSync(dirname(configPath), { recursive: true });
      writeFileSync(configPath, STARTER_CONFIG);

      const ciDocPath = ctx.resolve("docs/ci-evidence-upload.md");
      mkdirSync(dirname(ciDocPath), { recursive: true });
      writeFileSync(ciDocPath, CI_EVIDENCE_DOC);
    }

    const result = await ctx.invokeCommand("/build-pipeline:e2e");

    if (!result.success) {
      return {
        status: "failed",
        artifacts: result.artifacts,
        metrics: {},
        message: `E2E scaffold failed: ${result.error ?? "unknown error"}`,
      };
    }

    const configMessage = hasConfig ? "" : `Generated starter Playwright config at ${ctx.config.evidence.playwright_config}. Generated docs/ci-evidence-upload.md. `;
    return {
      status: "passed",
      artifacts: result.artifacts,
      metrics: {},
      message: `${configMessage}E2E tests scaffolded.`,
    };
  }
}

registerStep("e2e-scaffold", E2eScaffoldStep);

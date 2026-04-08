import type { ExecResult } from "../types.js";

interface PreflightDeps {
  configPath: string;
  exec: (cmd: string) => Promise<ExecResult>;
  exists: (path: string) => Promise<boolean>;
  readFile: (path: string) => Promise<string>;
}

interface PreflightResult {
  ready: boolean;
  issues: string[];
}

// Config validation patterns
const TRACE_PATTERN = /trace:\s*['"](?:retain-on-failure|on-first-retry|on)['"]/;
const SCREENSHOT_PATTERN = /screenshot:\s*['"](?:only-on-failure|on)['"]/;
const JSON_REPORTER_PATTERN = /['"]json['"][\s\S]*?outputFile/;
const RETRIES_PATTERN = /retries:\s*(\d+)/;

export async function validatePlaywrightConfig(deps: PreflightDeps): Promise<PreflightResult> {
  const issues: string[] = [];

  const configExists = await deps.exists(deps.configPath);
  if (!configExists) {
    return {
      ready: false,
      issues: [`Playwright config not found at ${deps.configPath}. Run e2e-scaffold to generate one.`],
    };
  }

  const listResult = await deps.exec("npx playwright test --list");
  if (listResult.exitCode !== 0) {
    issues.push(
      "Playwright not installed or config failed to load. Run `npm install -D @playwright/test` and ensure playwright.config.ts is valid.",
    );
    return { ready: false, issues };
  }

  const configContent = await deps.readFile(deps.configPath);

  if (!TRACE_PATTERN.test(configContent)) {
    issues.push(
      "Set `use: { trace: 'retain-on-failure' }` in playwright.config.ts — traces are the primary debugging artifact for the evidence pipeline.",
    );
  }

  if (!SCREENSHOT_PATTERN.test(configContent)) {
    issues.push(
      "Set `use: { screenshot: 'only-on-failure' }` in playwright.config.ts — failure screenshots feed the evidence pipeline.",
    );
  }

  if (!JSON_REPORTER_PATTERN.test(configContent)) {
    issues.push(
      "Add json reporter to playwright.config.ts: `reporter: [['json', { outputFile: 'test-results/results.json' }]]` — the orchestrator reads this to build failure dossiers.",
    );
  }

  const retriesMatch = configContent.match(RETRIES_PATTERN);
  if (retriesMatch && parseInt(retriesMatch[1], 10) < 1) {
    issues.push(
      "Set `retries: 1` in playwright.config.ts — first-retry traces only work with at least one retry.",
    );
  }

  return { ready: issues.length === 0, issues };
}

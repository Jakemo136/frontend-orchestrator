import { describe, it, expect, vi } from "vitest";
import { validatePlaywrightConfig } from "../../src/evidence/preflight.js";
import type { ExecResult } from "../../src/types.js";

function createMockExec(exitCode: number, stdout = "", stderr = "") {
  return vi.fn(async (): Promise<ExecResult> => ({ exitCode, stdout, stderr, timedOut: false }));
}

function createMockExists(result: boolean) {
  return vi.fn(async () => result);
}

const VALID_CONFIG = `
import { defineConfig } from '@playwright/test';
export default defineConfig({
  retries: 1,
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  reporter: [
    ['json', { outputFile: 'test-results/results.json' }],
  ],
});
`;

const MISSING_TRACE_CONFIG = `
import { defineConfig } from '@playwright/test';
export default defineConfig({
  retries: 1,
  use: {
    screenshot: 'only-on-failure',
  },
  reporter: [
    ['json', { outputFile: 'test-results/results.json' }],
  ],
});
`;

const MISSING_REPORTER_CONFIG = `
import { defineConfig } from '@playwright/test';
export default defineConfig({
  retries: 1,
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
`;

const ZERO_RETRIES_CONFIG = `
import { defineConfig } from '@playwright/test';
export default defineConfig({
  retries: 0,
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  reporter: [
    ['json', { outputFile: 'test-results/results.json' }],
  ],
});
`;

describe("validatePlaywrightConfig", () => {
  it("passes with valid config", async () => {
    const result = await validatePlaywrightConfig({
      configPath: "/project/playwright.config.ts",
      exec: createMockExec(0),
      exists: createMockExists(true),
      readFile: vi.fn(async () => VALID_CONFIG),
    });
    expect(result.ready).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("fails when playwright.config.ts does not exist", async () => {
    const result = await validatePlaywrightConfig({
      configPath: "/project/playwright.config.ts",
      exec: createMockExec(0),
      exists: createMockExists(false),
      readFile: vi.fn(async () => ""),
    });
    expect(result.ready).toBe(false);
    expect(result.issues[0]).toContain("not found");
  });

  it("fails when Playwright is not installed", async () => {
    const result = await validatePlaywrightConfig({
      configPath: "/project/playwright.config.ts",
      exec: createMockExec(1, "", "command not found: playwright"),
      exists: createMockExists(true),
      readFile: vi.fn(async () => VALID_CONFIG),
    });
    expect(result.ready).toBe(false);
    expect(result.issues[0]).toContain("Playwright");
  });

  it("fails when trace is not configured", async () => {
    const result = await validatePlaywrightConfig({
      configPath: "/project/playwright.config.ts",
      exec: createMockExec(0),
      exists: createMockExists(true),
      readFile: vi.fn(async () => MISSING_TRACE_CONFIG),
    });
    expect(result.ready).toBe(false);
    expect(result.issues.some((i) => i.includes("trace"))).toBe(true);
  });

  it("fails when json reporter is missing", async () => {
    const result = await validatePlaywrightConfig({
      configPath: "/project/playwright.config.ts",
      exec: createMockExec(0),
      exists: createMockExists(true),
      readFile: vi.fn(async () => MISSING_REPORTER_CONFIG),
    });
    expect(result.ready).toBe(false);
    expect(result.issues.some((i) => i.includes("json reporter"))).toBe(true);
  });

  it("fails when retries is 0", async () => {
    const result = await validatePlaywrightConfig({
      configPath: "/project/playwright.config.ts",
      exec: createMockExec(0),
      exists: createMockExists(true),
      readFile: vi.fn(async () => ZERO_RETRIES_CONFIG),
    });
    expect(result.ready).toBe(false);
    expect(result.issues.some((i) => i.includes("retries"))).toBe(true);
  });
});

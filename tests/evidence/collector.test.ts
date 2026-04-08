import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { collectEvidence } from "../../src/evidence/collector.js";
import type { EvidenceSummary } from "../../src/evidence/types.js";

const TMP = join(import.meta.dirname, ".tmp-collector");

function makeSummary(overrides: Partial<EvidenceSummary> = {}): EvidenceSummary {
  return {
    totalTests: 4,
    passed: 1,
    failed: 3,
    skipped: 0,
    durationMs: 11900,
    failures: [
      {
        testName: "upload flow > rejects invalid file type",
        testFile: "upload.e2e.ts:42",
        error: "Expected: visible",
        tracePath: join(TMP, "test-results/upload-rejects/trace.zip"),
        screenshotPath: join(TMP, "test-results/upload-rejects/test-failed-1.png"),
      },
      {
        testName: "login > redirects after success",
        testFile: "auth.e2e.ts:23",
        error: "Expected URL: /dashboard",
        tracePath: join(TMP, "test-results/login-redirects/trace.zip"),
      },
    ],
    manifestPath: "",
    ...overrides,
  };
}

function createTestFile(filePath: string, content: string): void {
  mkdirSync(join(filePath, ".."), { recursive: true });
  writeFileSync(filePath, content);
}

beforeEach(() => {
  createTestFile(join(TMP, "test-results/upload-rejects/trace.zip"), "fake-trace");
  createTestFile(join(TMP, "test-results/upload-rejects/test-failed-1.png"), "fake-png");
  createTestFile(join(TMP, "test-results/login-redirects/trace.zip"), "fake-trace-2");
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("collectEvidence", () => {
  it("copies trace and screenshot to evidence directory", () => {
    const summary = makeSummary();
    const collectTo = join(TMP, ".orchestrator/evidence");
    const result = collectEvidence(summary, "test-suite:0", collectTo);

    expect(existsSync(join(collectTo, "test-suite:0", "upload-flow-rejects-invalid-file-type", "trace.zip"))).toBe(true);
    expect(existsSync(join(collectTo, "test-suite:0", "upload-flow-rejects-invalid-file-type", "screenshot.png"))).toBe(true);
    expect(existsSync(join(collectTo, "test-suite:0", "login-redirects-after-success", "trace.zip"))).toBe(true);
  });

  it("writes evidence-manifest.json", () => {
    const summary = makeSummary();
    const collectTo = join(TMP, ".orchestrator/evidence");
    const result = collectEvidence(summary, "test-suite:0", collectTo);

    const manifestPath = join(collectTo, "test-suite:0", "evidence-manifest.json");
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    expect(manifest.stepId).toBe("test-suite:0");
    expect(manifest.totalTests).toBe(4);
    expect(manifest.failed).toBe(3);
    expect(manifest.failures).toHaveLength(2);
  });

  it("returns updated summary with canonical paths", () => {
    const summary = makeSummary();
    const collectTo = join(TMP, ".orchestrator/evidence");
    const result = collectEvidence(summary, "test-suite:0", collectTo);

    expect(result.manifestPath).toBe(join(collectTo, "test-suite:0", "evidence-manifest.json"));
    expect(result.failures[0].tracePath).toContain(".orchestrator/evidence/test-suite:0");
    expect(result.failures[0].screenshotPath).toContain(".orchestrator/evidence/test-suite:0");
  });

  it("handles missing source files gracefully", () => {
    const summary = makeSummary({
      failures: [
        {
          testName: "ghost test",
          testFile: "ghost.e2e.ts:1",
          error: "fail",
          tracePath: join(TMP, "test-results/nonexistent/trace.zip"),
        },
      ],
    });
    const collectTo = join(TMP, ".orchestrator/evidence");
    const result = collectEvidence(summary, "test-suite:0", collectTo);
    expect(result.failures[0].tracePath).toBeUndefined();
  });
});

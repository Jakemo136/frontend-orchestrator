import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parsePlaywrightReport } from "../../src/evidence/parser.js";

const FIXTURES = join(import.meta.dirname, "fixtures");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf-8"));
}

describe("parsePlaywrightReport", () => {
  it("parses a passing report with zero failures", () => {
    const report = loadFixture("passing-report.json");
    const summary = parsePlaywrightReport(report);
    expect(summary.totalTests).toBe(2);
    expect(summary.passed).toBe(2);
    expect(summary.failed).toBe(0);
    expect(summary.skipped).toBe(0);
    expect(summary.durationMs).toBe(2000);
    expect(summary.failures).toEqual([]);
  });

  it("parses a failing report with structured failure evidence", () => {
    const report = loadFixture("failing-report.json");
    const summary = parsePlaywrightReport(report);
    expect(summary.totalTests).toBe(4);
    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(3);
    expect(summary.failures).toHaveLength(3);
  });

  it("extracts trace and screenshot paths from attachments", () => {
    const report = loadFixture("failing-report.json");
    const summary = parsePlaywrightReport(report);
    const first = summary.failures[0];
    expect(first.testName).toBe("upload flow > rejects invalid file type");
    expect(first.tracePath).toBe("test-results/upload-flow-rejects/trace.zip");
    expect(first.screenshotPath).toBe("test-results/upload-flow-rejects/test-failed-1.png");
  });

  it("extracts error message from failure", () => {
    const report = loadFixture("failing-report.json");
    const summary = parsePlaywrightReport(report);
    expect(summary.failures[0].error).toBe("Expected: visible\nReceived: hidden");
  });

  it("extracts test file from error stack", () => {
    const report = loadFixture("failing-report.json");
    const summary = parsePlaywrightReport(report);
    expect(summary.failures[0].testFile).toContain("upload.e2e.ts");
  });

  it("handles missing attachments gracefully", () => {
    const report = loadFixture("failing-report.json");
    const summary = parsePlaywrightReport(report);
    const networkFailure = summary.failures.find(
      (f) => f.testName === "upload flow > shows error on network failure",
    );
    expect(networkFailure).toBeDefined();
    expect(networkFailure!.tracePath).toBe("test-results/upload-flow-network/trace.zip");
    expect(networkFailure!.screenshotPath).toBeUndefined();
  });
});

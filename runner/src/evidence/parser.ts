import type { EvidenceSummary, FailureEvidence } from "./types.js";

interface PlaywrightAttachment {
  name: string;
  path?: string;
  contentType: string;
}

interface PlaywrightResult {
  status: string;
  duration: number;
  error?: { message: string; stack?: string };
  attachments: PlaywrightAttachment[];
}

interface PlaywrightSpec {
  title: string;
  ok: boolean;
  tests: Array<{ status: string; results: PlaywrightResult[] }>;
}

interface PlaywrightSuite {
  title: string;
  file?: string;
  specs: PlaywrightSpec[];
  suites?: PlaywrightSuite[];
}

interface PlaywrightReport {
  suites: PlaywrightSuite[];
  stats: { expected: number; unexpected: number; skipped: number; duration: number };
}

function extractSpecs(suite: PlaywrightSuite, parentFile?: string): Array<{ spec: PlaywrightSpec; file: string }> {
  const file = suite.file ?? parentFile ?? suite.title;
  const results: Array<{ spec: PlaywrightSpec; file: string }> = [];

  for (const spec of suite.specs) {
    results.push({ spec, file });
  }
  for (const child of suite.suites ?? []) {
    results.push(...extractSpecs(child, file));
  }
  return results;
}

function buildFailureEvidence(spec: PlaywrightSpec, file: string): FailureEvidence | null {
  if (spec.ok) return null;

  const results = spec.tests[0]?.results;
  const lastResult = results?.at(-1);
  if (!lastResult || lastResult.status !== "failed") return null;

  const tracePath = lastResult.attachments.find((a) => a.name === "trace")?.path;
  const screenshotPath = lastResult.attachments.find((a) => a.name === "screenshot")?.path;

  const errorMessage = lastResult.error?.message ?? "Unknown error";
  const errorStack = lastResult.error?.stack ?? "";

  const stackMatch = errorStack.match(/at\s+(.+\.(?:e2e|test|spec)\.[tj]sx?:\d+)/);
  const testFile = stackMatch?.[1] ?? file;

  return {
    testName: spec.title,
    testFile,
    error: errorMessage,
    ...(tracePath && { tracePath }),
    ...(screenshotPath && { screenshotPath }),
  };
}

export function parsePlaywrightReport(raw: unknown): EvidenceSummary {
  const report = raw as PlaywrightReport;
  const allSpecs = report.suites.flatMap((s) => extractSpecs(s));

  const failures: FailureEvidence[] = [];
  for (const { spec, file } of allSpecs) {
    const evidence = buildFailureEvidence(spec, file);
    if (evidence) failures.push(evidence);
  }

  const total = report.stats.expected + report.stats.unexpected + report.stats.skipped;

  return {
    totalTests: total,
    passed: report.stats.expected,
    failed: report.stats.unexpected,
    skipped: report.stats.skipped,
    durationMs: report.stats.duration,
    failures,
    manifestPath: "",
  };
}

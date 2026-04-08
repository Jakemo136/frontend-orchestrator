import { mkdirSync, copyFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { EvidenceSummary, FailureEvidence } from "./types.js";

function slugify(testName: string): string {
  return testName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function copyArtifactIfExists(
  source: string | undefined,
  destDir: string,
  filename: string,
): string | undefined {
  if (!source || !existsSync(source)) return undefined;
  const dest = join(destDir, filename);
  copyFileSync(source, dest);
  return dest;
}

export function collectEvidence(
  summary: EvidenceSummary,
  stepId: string,
  collectTo: string,
): EvidenceSummary {
  const stepDir = join(collectTo, stepId);
  mkdirSync(stepDir, { recursive: true });

  const updatedFailures: FailureEvidence[] = summary.failures.map((failure) => {
    const slug = slugify(failure.testName);
    const failDir = join(stepDir, slug);
    mkdirSync(failDir, { recursive: true });

    const tracePath = copyArtifactIfExists(failure.tracePath, failDir, "trace.zip");
    const screenshotPath = copyArtifactIfExists(failure.screenshotPath, failDir, "screenshot.png");
    const domSnapshot = copyArtifactIfExists(failure.domSnapshot, failDir, "snapshot.html");

    const updated: FailureEvidence = {
      testName: failure.testName,
      testFile: failure.testFile,
      error: failure.error,
      ...(tracePath && { tracePath }),
      ...(screenshotPath && { screenshotPath }),
      ...(domSnapshot && { domSnapshot }),
      ...(failure.consoleLogs && { consoleLogs: failure.consoleLogs }),
    };

    return updated;
  });

  const manifestPath = join(stepDir, "evidence-manifest.json");
  const manifest = {
    generatedAt: new Date().toISOString(),
    stepId,
    totalTests: summary.totalTests,
    passed: summary.passed,
    failed: summary.failed,
    skipped: summary.skipped,
    durationMs: summary.durationMs,
    failures: updatedFailures.map((f) => {
      const entry: Record<string, unknown> = {
        testName: f.testName,
        testFile: f.testFile,
        error: f.error,
      };
      if (f.tracePath) entry.trace = f.tracePath;
      if (f.screenshotPath) entry.screenshot = f.screenshotPath;
      if (f.domSnapshot) entry.snapshot = f.domSnapshot;
      if (f.consoleLogs) entry.logs = f.consoleLogs;
      return entry;
    }),
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  return {
    ...summary,
    failures: updatedFailures,
    manifestPath,
  };
}

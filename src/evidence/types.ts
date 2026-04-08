export interface FailureEvidence {
  testName: string;
  testFile: string;
  error: string;
  tracePath?: string;
  screenshotPath?: string;
  consoleLogs?: string[];
  domSnapshot?: string;
}

export interface EvidenceSummary {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  failures: FailureEvidence[];
  manifestPath: string;
}

export interface EvidenceConfig {
  playwright_config: string;
  output_dir: string;
  json_report: string;
  collect_to: string;
}

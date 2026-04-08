import { readFileSync, existsSync } from "fs";
import { parsePlaywrightReport, collectEvidence } from "./index.js";
import type { RunContext } from "../types.js";
import type { EvidenceSummary } from "./types.js";

export function tryParseEvidence(ctx: RunContext, stepId: string): EvidenceSummary | undefined {
  const reportPath = ctx.resolve(ctx.config.evidence.json_report);
  if (!existsSync(reportPath)) return undefined;

  try {
    const raw = JSON.parse(readFileSync(reportPath, "utf-8"));
    const summary = parsePlaywrightReport(raw);
    const collectTo = ctx.resolve(ctx.config.evidence.collect_to);
    return collectEvidence(summary, stepId, collectTo);
  } catch {
    return undefined;
  }
}

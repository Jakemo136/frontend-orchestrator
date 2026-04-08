import type { StepDescription, WorkflowState, StepState } from "../types.js";

function statusIcon(state: StepState | undefined): string {
  if (!state) return "[ ]";
  switch (state.status) {
    case "passed": return "[x]";
    case "in_progress": return "[>]";
    case "failed": return "[!]";
    case "skipped": return "[~]";
  }
}

export function formatExplain(
  project: string,
  scopeType: string,
  descriptions: StepDescription[],
  state: WorkflowState,
): string {
  const lines: string[] = [];
  lines.push(`Frontend Orchestrator — ${project} (scope: ${scopeType})`);
  lines.push("");

  for (const desc of descriptions) {
    const stepState = state.steps[desc.id];
    const icon = statusIcon(stepState);
    const msg = stepState?.message ? ` — ${stepState.message}` : "";
    lines.push(`  ${icon} ${desc.id} — ${desc.summary}${msg}`);
    lines.push(`      Pass: ${desc.passCondition}`);
    if (desc.failCondition !== "never") {
      lines.push(`      Fail: ${desc.failCondition}`);
    }
  }

  return lines.join("\n");
}

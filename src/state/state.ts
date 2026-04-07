import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import type { WorkflowState, PipelineScope, StepResult } from "../types.js";

const STATE_DIR = ".orchestrator";
const STATE_FILE = "WORKFLOW_STATE.json";

export class StateManager {
  private stateDir: string;
  private statePath: string;

  constructor(projectRoot: string) {
    this.stateDir = join(projectRoot, STATE_DIR);
    this.statePath = join(this.stateDir, STATE_FILE);
  }

  load(project: string, scope: PipelineScope): WorkflowState {
    if (existsSync(this.statePath)) {
      const raw = readFileSync(this.statePath, "utf-8");
      return JSON.parse(raw) as WorkflowState;
    }

    return {
      project,
      scope,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      steps: {},
    };
  }

  save(state: WorkflowState): void {
    mkdirSync(this.stateDir, { recursive: true });
    state.updated_at = new Date().toISOString();
    writeFileSync(this.statePath, JSON.stringify(state, null, 2) + "\n");
  }

  markInProgress(state: WorkflowState, stepId: string): void {
    state.steps[stepId] = {
      status: "in_progress",
      started_at: new Date().toISOString(),
      artifacts: [],
      metrics: {},
      message: "",
    };
  }

  update(state: WorkflowState, stepId: string, result: StepResult): void {
    const existing = state.steps[stepId];
    state.steps[stepId] = {
      status: result.status,
      started_at: existing?.started_at,
      completed_at: new Date().toISOString(),
      artifacts: result.artifacts,
      metrics: result.metrics,
      message: result.message,
    };
  }
}

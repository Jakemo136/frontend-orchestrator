import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { createHash } from "crypto";
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
      evidence: result.evidence,
    };
  }

  computeFileHash(filePath: string): string {
    if (!existsSync(filePath)) return "";
    const content = readFileSync(filePath, "utf-8");
    return createHash("sha256").update(content).digest("hex").slice(0, 16);
  }

  checkForStaleState(
    state: WorkflowState,
    artifactPaths: Record<string, string>,
  ): string[] {
    if (!state.artifact_hashes) return [];
    const staleArtifacts: string[] = [];
    for (const [name, path] of Object.entries(artifactPaths)) {
      const currentHash = this.computeFileHash(path);
      const savedHash = state.artifact_hashes[name];
      if (savedHash && currentHash !== savedHash) {
        staleArtifacts.push(name);
      }
    }
    return staleArtifacts;
  }

  updateArtifactHashes(
    state: WorkflowState,
    artifactPaths: Record<string, string>,
  ): void {
    state.artifact_hashes = {};
    for (const [name, path] of Object.entries(artifactPaths)) {
      state.artifact_hashes[name] = this.computeFileHash(path);
    }
  }

  invalidateDownstream(
    state: WorkflowState,
    fromStepId: string,
    allSteps: Array<{ id: string; deps: string[] }>,
  ): string[] {
    const invalidated: string[] = [];
    const queue = [fromStepId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const step of allSteps) {
        if (step.deps.includes(current) && !invalidated.includes(step.id)) {
          invalidated.push(step.id);
          delete state.steps[step.id];
          queue.push(step.id);
        }
      }
    }
    return invalidated;
  }
}

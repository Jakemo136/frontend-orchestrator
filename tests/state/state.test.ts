// tests/state/state.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { StateManager } from "../../src/state/state.js";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { PipelineScope, StepResult } from "../../src/types.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `orchestrator-state-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("StateManager", () => {
  let dir: string;
  let mgr: StateManager;
  const scope: PipelineScope = { type: "app", target: null };

  beforeEach(() => {
    dir = makeTempDir();
    mgr = new StateManager(dir);
  });

  it("initializes fresh state when no file exists", () => {
    const state = mgr.load("test-project", scope);
    expect(state.project).toBe("test-project");
    expect(state.scope.type).toBe("app");
    expect(Object.keys(state.steps)).toHaveLength(0);
  });

  it("creates .orchestrator directory on save", () => {
    const state = mgr.load("test-project", scope);
    const result: StepResult = {
      status: "passed",
      artifacts: [],
      metrics: {},
      message: "done",
    };
    mgr.update(state, "session-start", result);
    mgr.save(state);
    expect(existsSync(join(dir, ".orchestrator", "WORKFLOW_STATE.json"))).toBe(true);
    rmSync(dir, { recursive: true });
  });

  it("round-trips state through save and load", () => {
    const state = mgr.load("test-project", scope);
    const result: StepResult = {
      status: "passed",
      artifacts: ["docs/UI_REQUIREMENTS.md"],
      metrics: { components: 34 },
      message: "Requirements approved.",
    };
    mgr.update(state, "ui-interview", result);
    mgr.save(state);

    const loaded = mgr.load("test-project", scope);
    expect(loaded.steps["ui-interview"]?.status).toBe("passed");
    expect(loaded.steps["ui-interview"]?.metrics.components).toBe(34);
    rmSync(dir, { recursive: true });
  });

  it("marks step as in_progress with started_at", () => {
    const state = mgr.load("test-project", scope);
    mgr.markInProgress(state, "build-wave:0");
    expect(state.steps["build-wave:0"]?.status).toBe("in_progress");
    expect(state.steps["build-wave:0"]?.started_at).toBeDefined();
    rmSync(dir, { recursive: true });
  });

  it("sets completed_at when updating with a terminal status", () => {
    const state = mgr.load("test-project", scope);
    mgr.markInProgress(state, "build-wave:0");
    mgr.update(state, "build-wave:0", {
      status: "passed",
      artifacts: [],
      metrics: {},
      message: "done",
    });
    expect(state.steps["build-wave:0"]?.completed_at).toBeDefined();
    rmSync(dir, { recursive: true });
  });
});

// tests/runner/dag.test.ts
import { describe, it, expect } from "vitest";
import { topologicalSort, getRunnable } from "../../src/runner/dag.js";
import type { StepDefinition, WorkflowState } from "../../src/types.js";

const STEPS: StepDefinition[] = [
  { id: "a", type: "session-start", deps: [], params: {} },
  { id: "b", type: "requirements-gate", deps: ["a"], params: {} },
  { id: "c", type: "e2e-scaffold", deps: ["b"], params: {} },
  { id: "d", type: "dependency-resolve", deps: ["b"], params: {} },
  { id: "e", type: "e2e-green", deps: ["c", "d"], params: {} },
];

describe("topologicalSort", () => {
  it("sorts steps in dependency order", () => {
    const sorted = topologicalSort(STEPS);
    const ids = sorted.map((s) => s.id);
    expect(ids.indexOf("a")).toBeLessThan(ids.indexOf("b"));
    expect(ids.indexOf("b")).toBeLessThan(ids.indexOf("c"));
    expect(ids.indexOf("b")).toBeLessThan(ids.indexOf("d"));
    expect(ids.indexOf("c")).toBeLessThan(ids.indexOf("e"));
    expect(ids.indexOf("d")).toBeLessThan(ids.indexOf("e"));
  });

  it("throws on circular dependency", () => {
    const circular: StepDefinition[] = [
      { id: "x", type: "t", deps: ["y"], params: {} },
      { id: "y", type: "t", deps: ["x"], params: {} },
    ];
    expect(() => topologicalSort(circular)).toThrow(/circular/i);
  });
});

describe("getRunnable", () => {
  it("returns steps with all deps passed and not yet started", () => {
    const state: WorkflowState = {
      project: "test",
      scope: { type: "app", target: null },
      started_at: "",
      updated_at: "",
      steps: {
        a: { status: "passed", artifacts: [], metrics: {}, message: "" },
      },
    };
    const runnable = getRunnable(STEPS, state);
    expect(runnable.map((s) => s.id)).toEqual(["b"]);
  });

  it("returns multiple steps when parallel deps are met", () => {
    const state: WorkflowState = {
      project: "test",
      scope: { type: "app", target: null },
      started_at: "",
      updated_at: "",
      steps: {
        a: { status: "passed", artifacts: [], metrics: {}, message: "" },
        b: { status: "passed", artifacts: [], metrics: {}, message: "" },
      },
    };
    const runnable = getRunnable(STEPS, state);
    const ids = runnable.map((s) => s.id);
    expect(ids).toContain("c");
    expect(ids).toContain("d");
    expect(ids).not.toContain("e");
  });

  it("treats skipped as passed for dependency resolution", () => {
    const state: WorkflowState = {
      project: "test",
      scope: { type: "app", target: null },
      started_at: "",
      updated_at: "",
      steps: {
        a: { status: "skipped", artifacts: [], metrics: {}, message: "" },
      },
    };
    const runnable = getRunnable(STEPS, state);
    expect(runnable.map((s) => s.id)).toEqual(["b"]);
  });

  it("does not return steps that are in_progress or already passed", () => {
    const state: WorkflowState = {
      project: "test",
      scope: { type: "app", target: null },
      started_at: "",
      updated_at: "",
      steps: {
        a: { status: "passed", artifacts: [], metrics: {}, message: "" },
        b: { status: "in_progress", artifacts: [], metrics: {}, message: "" },
      },
    };
    const runnable = getRunnable(STEPS, state);
    expect(runnable).toHaveLength(0);
  });
});

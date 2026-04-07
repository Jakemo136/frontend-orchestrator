import { describe, it, expect } from "vitest";
import { formatExplain } from "../../src/explain/explain.js";
import type { StepDescription, WorkflowState } from "../../src/types.js";

const DESCRIPTIONS: StepDescription[] = [
  {
    id: "session-start",
    type: "session-start",
    summary: "Read project docs, produce briefing",
    prerequisites: [],
    artifacts: [],
    passCondition: "briefing generated",
    failCondition: "never",
    scope: "component",
  },
  {
    id: "ui-interview",
    type: "requirements-gate",
    summary: "Interactive requirements interview",
    prerequisites: ["session-start"],
    artifacts: ["docs/UI_REQUIREMENTS.md"],
    passCondition: "both docs exist and approved",
    failCondition: "user cancels",
    scope: "component",
  },
];

describe("formatExplain", () => {
  it("shows [x] for passed steps", () => {
    const state: WorkflowState = {
      project: "test",
      scope: { type: "app", target: null },
      started_at: "",
      updated_at: "",
      steps: {
        "session-start": { status: "passed", artifacts: [], metrics: {}, message: "done" },
      },
    };
    const output = formatExplain("test", "app", DESCRIPTIONS, state);
    expect(output).toContain("[x] session-start");
    expect(output).toContain("[ ] ui-interview");
  });

  it("shows [>] for in_progress steps", () => {
    const state: WorkflowState = {
      project: "test",
      scope: { type: "app", target: null },
      started_at: "",
      updated_at: "",
      steps: {
        "session-start": { status: "in_progress", artifacts: [], metrics: {}, message: "" },
      },
    };
    const output = formatExplain("test", "app", DESCRIPTIONS, state);
    expect(output).toContain("[>] session-start");
  });

  it("shows [~] for skipped steps", () => {
    const state: WorkflowState = {
      project: "test",
      scope: { type: "app", target: null },
      started_at: "",
      updated_at: "",
      steps: {
        "session-start": { status: "skipped", artifacts: [], metrics: {}, message: "skipped" },
      },
    };
    const output = formatExplain("test", "app", DESCRIPTIONS, state);
    expect(output).toContain("[~] session-start");
  });

  it("includes project name and scope in header", () => {
    const state: WorkflowState = {
      project: "test",
      scope: { type: "app", target: null },
      started_at: "",
      updated_at: "",
      steps: {},
    };
    const output = formatExplain("test", "app", DESCRIPTIONS, state);
    expect(output).toContain("test");
    expect(output).toContain("app");
  });
});

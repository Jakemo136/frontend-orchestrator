import { describe, it, expect } from "vitest";
import { parseArgs, getWaveCount } from "../src/cli.js";

describe("parseArgs", () => {
  it("defaults to 'run' command", () => {
    const cmd = parseArgs([]);
    expect(cmd.command).toBe("run");
  });

  it("parses 'status' command", () => {
    const cmd = parseArgs(["status"]);
    expect(cmd.command).toBe("status");
  });

  it("parses '--explain' flag", () => {
    const cmd = parseArgs(["--explain"]);
    expect(cmd.command).toBe("explain");
  });

  it("parses 'run <step-id>' command", () => {
    const cmd = parseArgs(["run", "build-wave:0"]);
    expect(cmd.command).toBe("run-step");
    expect(cmd.stepId).toBe("build-wave:0");
  });

  it("parses 'reset <step-id>' command", () => {
    const cmd = parseArgs(["reset", "build-wave:0"]);
    expect(cmd.command).toBe("reset");
    expect(cmd.stepId).toBe("build-wave:0");
  });

  it("parses 'init' command", () => {
    const cmd = parseArgs(["init"]);
    expect(cmd.command).toBe("init");
  });

  it("parses --command-result flag", () => {
    const encoded = Buffer.from(JSON.stringify({ success: true, output: "ok", artifacts: [] })).toString("base64");
    const cmd = parseArgs(["--command-result", `/test=${encoded}`]);
    expect(cmd.command).toBe("run");
    expect(cmd.commandResults?.get("/test")).toBeDefined();
    expect(cmd.commandResults?.get("/test")?.success).toBe(true);
  });

  it("ignores malformed --command-result", () => {
    const cmd = parseArgs(["--command-result", "/test=notbase64json"]);
    expect(cmd.command).toBe("run");
    expect(cmd.commandResults?.size).toBe(0);
  });

  it("extracts --approval-result flags", () => {
    const result = parseArgs(["--approval-result", "dep-resolve=approved"]);
    expect(result.approvalResults?.get("dep-resolve")).toBe(true);
  });

  it("extracts rejected --approval-result flags", () => {
    const result = parseArgs(["--approval-result", "dep-resolve=rejected"]);
    expect(result.approvalResults?.get("dep-resolve")).toBe(false);
  });

  it("extracts both --command-result and --approval-result flags", () => {
    const b64 = Buffer.from(JSON.stringify({ success: true, output: "", artifacts: [] })).toString("base64");
    const result = parseArgs([
      "--command-result", `cmd=${b64}`,
      "--approval-result", "step1=approved",
    ]);
    expect(result.commandResults?.has("cmd")).toBe(true);
    expect(result.approvalResults?.get("step1")).toBe(true);
  });
});

describe("getWaveCount", () => {
  it("returns 1 when no dependency-resolve state exists", () => {
    const state = { project: "test", scope: { type: "app" as const, target: null }, started_at: "", updated_at: "", steps: {} };
    expect(getWaveCount(state)).toBe(1);
  });

  it("returns wave_count when dependency-resolve passed with wave_count", () => {
    const state = {
      project: "test",
      scope: { type: "app" as const, target: null },
      started_at: "", updated_at: "",
      steps: {
        "dependency-resolve": {
          status: "passed" as const,
          artifacts: ["docs/BUILD_PLAN.md"],
          metrics: { wave_count: 3 },
          message: "Build plan approved.",
        },
      },
    };
    expect(getWaveCount(state)).toBe(3);
  });

  it("returns 1 when dependency-resolve failed", () => {
    const state = {
      project: "test",
      scope: { type: "app" as const, target: null },
      started_at: "", updated_at: "",
      steps: {
        "dependency-resolve": {
          status: "failed" as const,
          artifacts: [],
          metrics: {},
          message: "failed",
        },
      },
    };
    expect(getWaveCount(state)).toBe(1);
  });

  it("returns 1 when dependency-resolve passed but no wave_count metric", () => {
    const state = {
      project: "test",
      scope: { type: "app" as const, target: null },
      started_at: "", updated_at: "",
      steps: {
        "dependency-resolve": {
          status: "passed" as const,
          artifacts: ["docs/BUILD_PLAN.md"],
          metrics: {},
          message: "passed",
        },
      },
    };
    expect(getWaveCount(state)).toBe(1);
  });
});

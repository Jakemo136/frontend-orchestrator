import { describe, it, expect } from "vitest";
import { fanOutSteps } from "../../src/runner/parallel.js";
import type { NeedsCommandSignal, NeedsApprovalSignal } from "../../src/types.js";

describe("fanOutSteps", () => {
  it("runs independent steps concurrently", async () => {
    const executionOrder: string[] = [];

    const tasks = [
      {
        id: "a",
        run: async () => {
          executionOrder.push("a-start");
          await new Promise((r) => setTimeout(r, 50));
          executionOrder.push("a-end");
          return { status: "passed" as const, artifacts: [], metrics: {}, message: "ok" };
        },
      },
      {
        id: "b",
        run: async () => {
          executionOrder.push("b-start");
          await new Promise((r) => setTimeout(r, 10));
          executionOrder.push("b-end");
          return { status: "passed" as const, artifacts: [], metrics: {}, message: "ok" };
        },
      },
    ];

    const results = await fanOutSteps(tasks);

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.result.status === "passed")).toBe(true);
    // b finishes before a due to shorter delay
    expect(executionOrder.indexOf("b-end")).toBeLessThan(executionOrder.indexOf("a-end"));
  });

  it("collects failures without aborting other steps", async () => {
    const tasks = [
      {
        id: "pass",
        run: async () => ({ status: "passed" as const, artifacts: [], metrics: {}, message: "ok" }),
      },
      {
        id: "fail",
        run: async () => ({ status: "failed" as const, artifacts: [], metrics: {}, message: "broke" }),
      },
    ];

    const results = await fanOutSteps(tasks);
    expect(results).toHaveLength(2);
    expect(results.find((r) => r.stepId === "pass")!.result.status).toBe("passed");
    expect(results.find((r) => r.stepId === "fail")!.result.status).toBe("failed");
  });

  it("handles thrown errors gracefully", async () => {
    const tasks = [
      {
        id: "crash",
        run: async () => { throw new Error("boom"); },
      },
      {
        id: "ok",
        run: async () => ({ status: "passed" as const, artifacts: [], metrics: {}, message: "ok" }),
      },
    ];

    const results = await fanOutSteps(tasks);
    expect(results).toHaveLength(2);
    expect(results.find((r) => r.stepId === "crash")!.result.status).toBe("failed");
    expect(results.find((r) => r.stepId === "ok")!.result.status).toBe("passed");
  });

  it("surfaces NeedsCommandSignal as a signal on the result", async () => {
    const signal: NeedsCommandSignal = { __type: "needs_command", command: "/build", args: "--prod" };
    const tasks = [
      {
        id: "needs-cmd",
        run: async () => { throw signal; },
      },
      {
        id: "ok",
        run: async () => ({ status: "passed" as const, artifacts: [], metrics: {}, message: "ok" }),
      },
    ];

    const results = await fanOutSteps(tasks);
    expect(results).toHaveLength(2);

    const signaled = results.find((r) => r.stepId === "needs-cmd")!;
    expect(signaled.signal).toBeDefined();
    expect(signaled.signal!.command).toBe("/build");
    expect(signaled.signal!.args).toBe("--prod");
    expect(signaled.result.message).toContain("needs command");

    const passed = results.find((r) => r.stepId === "ok")!;
    expect(passed.result.status).toBe("passed");
    expect(passed.signal).toBeUndefined();
  });

  it("distinguishes NeedsCommandSignal from regular errors", async () => {
    const signal: NeedsCommandSignal = { __type: "needs_command", command: "/test" };
    const tasks = [
      { id: "signal", run: async () => { throw signal; } },
      { id: "error", run: async () => { throw new Error("real error"); } },
      { id: "ok", run: async () => ({ status: "passed" as const, artifacts: [], metrics: {}, message: "ok" }) },
    ];

    const results = await fanOutSteps(tasks);
    expect(results).toHaveLength(3);

    const sigResult = results.find((r) => r.stepId === "signal")!;
    expect(sigResult.signal).toBeDefined();

    const errResult = results.find((r) => r.stepId === "error")!;
    expect(errResult.signal).toBeUndefined();
    expect(errResult.result.status).toBe("failed");
    expect(errResult.result.message).toContain("Uncaught error");
  });

  it("surfaces NeedsApprovalSignal as a signal on the result without crashing other tasks", async () => {
    const signal: NeedsApprovalSignal = { __type: "needs_approval", stepId: "needs-approval", prompt: "Deploy to prod?" };
    const tasks = [
      {
        id: "needs-approval",
        run: async () => { throw signal; },
      },
      {
        id: "ok",
        run: async () => ({ status: "passed" as const, artifacts: [], metrics: {}, message: "ok" }),
      },
    ];

    const results = await fanOutSteps(tasks);
    expect(results).toHaveLength(2);

    const signaled = results.find((r) => r.stepId === "needs-approval")!;
    expect(signaled.signal).toBeDefined();
    expect(signaled.signal!.__type).toBe("needs_approval");
    expect((signaled.signal as NeedsApprovalSignal).prompt).toBe("Deploy to prod?");
    expect(signaled.result.message).toContain("needs approval");

    const passed = results.find((r) => r.stepId === "ok")!;
    expect(passed.result.status).toBe("passed");
    expect(passed.signal).toBeUndefined();
  });
});

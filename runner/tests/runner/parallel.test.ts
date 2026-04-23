import { describe, it, expect } from "vitest";
import { fanOutSteps } from "../../src/runner/parallel.js";

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
});

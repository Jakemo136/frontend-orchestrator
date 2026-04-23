import { describe, it, expect, vi } from "vitest";
import { AwaitMergeStep } from "../../src/steps/await-merge.js";
import { makeDefinition, makeMockContext } from "./helpers.js";

describe("AwaitMergeStep", () => {
  it("describe() includes wave in summary", () => {
    const step = new AwaitMergeStep(makeDefinition({ params: { wave: 2 } }));
    const desc = step.describe();
    expect(desc.summary).toContain("wave 2");
    expect(desc.scope).toBe("component");
  });

  it("preflight always ready", async () => {
    const step = new AwaitMergeStep(makeDefinition());
    const result = await step.preflight(makeMockContext());
    expect(result.ready).toBe(true);
  });

  it("execute passes when all wave PRs are merged", async () => {
    const prs = [
      { number: 1, state: "MERGED", title: "PR 1", statusCheckRollup: [] },
      { number: 2, state: "MERGED", title: "PR 2", statusCheckRollup: [] },
    ];
    const exec = vi.fn(async () => ({
      exitCode: 0,
      stdout: JSON.stringify(prs),
      stderr: "",
      timedOut: false,
    }));
    const ctx = makeMockContext({ exec });
    const step = new AwaitMergeStep(makeDefinition({ params: { wave: 1 } }));
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
    expect(result.metrics).toMatchObject({ merged_count: 2 });
  });

  it("execute fails when some PRs are not merged", async () => {
    const prs = [
      { number: 1, state: "MERGED", title: "PR 1", statusCheckRollup: [] },
      { number: 2, state: "OPEN", title: "PR 2 still open", statusCheckRollup: [] },
    ];
    const exec = vi.fn(async () => ({
      exitCode: 0,
      stdout: JSON.stringify(prs),
      stderr: "",
      timedOut: false,
    }));
    const ctx = makeMockContext({ exec });
    const step = new AwaitMergeStep(makeDefinition({ params: { wave: 1 } }));
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("PR 2 still open");
  });

  it("execute fails when no PRs found", async () => {
    const exec = vi.fn(async () => ({
      exitCode: 0,
      stdout: "[]",
      stderr: "",
      timedOut: false,
    }));
    const ctx = makeMockContext({ exec });
    const step = new AwaitMergeStep(makeDefinition({ params: { wave: 1 } }));
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("No PRs found for wave 1");
  });

  it("execute fails when gh command fails", async () => {
    const exec = vi.fn(async () => ({
      exitCode: 1,
      stdout: "",
      stderr: "gh: command not found",
      timedOut: false,
    }));
    const ctx = makeMockContext({ exec });
    const step = new AwaitMergeStep(makeDefinition({ params: { wave: 1 } }));
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("gh pr list failed");
  });

  it("execute fails when output is invalid JSON", async () => {
    const exec = vi.fn(async () => ({
      exitCode: 0,
      stdout: "not valid json {{{",
      stderr: "",
      timedOut: false,
    }));
    const ctx = makeMockContext({ exec });
    const step = new AwaitMergeStep(makeDefinition({ params: { wave: 1 } }));
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("parse");
  });
});

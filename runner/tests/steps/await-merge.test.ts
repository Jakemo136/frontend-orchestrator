import { describe, it, expect, vi } from "vitest";
import { AwaitMergeStep } from "../../src/steps/await-merge.js";
import { makeDefinition, makeMockContext } from "./helpers.js";
import type { RunContext } from "../../src/types.js";

function makeCtxWithCi(
  ciOverrides: Partial<RunContext["config"]["ci"]>,
  execOverride?: RunContext["exec"],
): RunContext {
  const base = makeMockContext(execOverride ? { exec: execOverride } : {});
  return {
    ...base,
    config: {
      ...base.config,
      ci: { ...base.config.ci, ...ciOverrides },
    },
  };
}

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

  it("execute passes when all PRs merged and required checks passed", async () => {
    const prs = [
      {
        number: 1,
        state: "MERGED",
        title: "PR 1",
        statusCheckRollup: [
          { name: "ci/build", state: "SUCCESS" },
          { name: "ci/test", state: "SUCCESS" },
        ],
      },
    ];
    const exec = vi.fn(async () => ({
      exitCode: 0,
      stdout: JSON.stringify(prs),
      stderr: "",
      timedOut: false,
    }));
    const ctx = makeCtxWithCi({ required_on_feature: ["ci/build", "ci/test"] }, exec);
    const step = new AwaitMergeStep(makeDefinition({ params: { wave: 1 } }));
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
    expect(result.message).not.toContain("Warning");
  });

  it("execute passes when required check is SKIPPED", async () => {
    const prs = [
      {
        number: 1,
        state: "MERGED",
        title: "PR 1",
        statusCheckRollup: [{ name: "ci/build", state: "SKIPPED" }],
      },
    ];
    const exec = vi.fn(async () => ({
      exitCode: 0,
      stdout: JSON.stringify(prs),
      stderr: "",
      timedOut: false,
    }));
    const ctx = makeCtxWithCi({ required_on_feature: ["ci/build"] }, exec);
    const step = new AwaitMergeStep(makeDefinition({ params: { wave: 1 } }));
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
  });

  it("execute fails when required check failed", async () => {
    const prs = [
      {
        number: 3,
        state: "MERGED",
        title: "My PR",
        statusCheckRollup: [
          { name: "ci/build", state: "SUCCESS" },
          { name: "ci/e2e", state: "FAILURE" },
        ],
      },
    ];
    const exec = vi.fn(async () => ({
      exitCode: 0,
      stdout: JSON.stringify(prs),
      stderr: "",
      timedOut: false,
    }));
    const ctx = makeCtxWithCi({ required_on_feature: ["ci/build", "ci/e2e"] }, exec);
    const step = new AwaitMergeStep(makeDefinition({ params: { wave: 1 } }));
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("ci/e2e");
    expect(result.message).toContain("#3");
  });

  it("execute passes with warning when informational check failed", async () => {
    const prs = [
      {
        number: 5,
        state: "MERGED",
        title: "PR 5",
        statusCheckRollup: [{ name: "ci/lint", state: "FAILURE" }],
      },
    ];
    const exec = vi.fn(async () => ({
      exitCode: 0,
      stdout: JSON.stringify(prs),
      stderr: "",
      timedOut: false,
    }));
    const ctx = makeCtxWithCi({ informational_on_feature: ["ci/lint"] }, exec);
    const step = new AwaitMergeStep(makeDefinition({ params: { wave: 1 } }));
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
    expect(result.message).toContain("ci/lint");
    expect(result.message).toContain("Warnings");
  });

  it("execute passes with no CI config (backwards compat)", async () => {
    const prs = [
      { number: 1, state: "MERGED", title: "PR 1", statusCheckRollup: [] },
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
  });
});

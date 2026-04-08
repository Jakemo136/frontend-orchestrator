// tests/runner/context.test.ts
import { describe, it, expect } from "vitest";
import { createRunContext } from "../../src/runner/context.js";
import { StateManager } from "../../src/state/state.js";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { OrchestratorConfig } from "../../src/types.js";

function makeTempProject(): string {
  const dir = join(tmpdir(), `orchestrator-ctx-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

const CONFIG: OrchestratorConfig = {
  project: "test",
  scope: { type: "app", target: null },
  branches: { main: "main", feature: null },
  artifacts: {
    requirements: "docs/reqs.md",
    inventory: "docs/inv.md",
    build_plan: "docs/plan.md",
    build_status: "docs/status.md",
    design_audit: "docs/audit.md",
    visual_qa: "docs/qa.md",
  },
  commands: {
    test_client: "echo pass",
    test_server: "echo pass",
    test_e2e: "echo pass",
    build_client: "echo pass",
    dev_server: "echo pass",
    typecheck: "echo pass",
  },
  ci: {
    required_on_main: [],
    required_on_feature: [],
    informational_on_feature: [],
  },
  evidence: {
    playwright_config: "playwright.config.ts",
    output_dir: "test-results",
    json_report: "test-results/results.json",
    collect_to: ".orchestrator/evidence",
  },
  dev_server_url: "http://localhost:3000",
};

describe("RunContext", () => {
  it("resolves paths relative to project root", () => {
    const dir = makeTempProject();
    const stateMgr = new StateManager(dir);
    const state = stateMgr.load("test", CONFIG.scope);
    const ctx = createRunContext(CONFIG, state, dir, stateMgr);
    expect(ctx.resolve("docs/reqs.md")).toBe(join(dir, "docs/reqs.md"));
    rmSync(dir, { recursive: true });
  });

  it("checks file existence", async () => {
    const dir = makeTempProject();
    mkdirSync(join(dir, "docs"), { recursive: true });
    writeFileSync(join(dir, "docs/reqs.md"), "# Reqs");
    const stateMgr = new StateManager(dir);
    const state = stateMgr.load("test", CONFIG.scope);
    const ctx = createRunContext(CONFIG, state, dir, stateMgr);
    expect(await ctx.exists("docs/reqs.md")).toBe(true);
    expect(await ctx.exists("docs/nope.md")).toBe(false);
    rmSync(dir, { recursive: true });
  });

  it("executes shell commands and returns result", async () => {
    const dir = makeTempProject();
    const stateMgr = new StateManager(dir);
    const state = stateMgr.load("test", CONFIG.scope);
    const ctx = createRunContext(CONFIG, state, dir, stateMgr);
    const result = await ctx.exec("echo hello");
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hello");
    expect(result.timedOut).toBe(false);
    rmSync(dir, { recursive: true });
  });

  it("returns non-zero exit code for failing commands", async () => {
    const dir = makeTempProject();
    const stateMgr = new StateManager(dir);
    const state = stateMgr.load("test", CONFIG.scope);
    const ctx = createRunContext(CONFIG, state, dir, stateMgr);
    const result = await ctx.exec("exit 1");
    expect(result.exitCode).toBe(1);
    rmSync(dir, { recursive: true });
  });

  it("invokeCommand throws NeedsCommandSignal when no result pre-supplied", async () => {
    const dir = makeTempProject();
    const stateMgr = new StateManager(dir);
    const state = stateMgr.load("test", CONFIG.scope);
    const ctx = createRunContext(CONFIG, state, dir, stateMgr);

    try {
      await ctx.invokeCommand("/some-command");
      expect.fail("Should have thrown");
    } catch (err) {
      expect((err as any).__type).toBe("needs_command");
      expect((err as any).command).toBe("/some-command");
    }
    rmSync(dir, { recursive: true });
  });

  it("invokeCommand returns pre-supplied result when available", async () => {
    const dir = makeTempProject();
    const stateMgr = new StateManager(dir);
    const state = stateMgr.load("test", CONFIG.scope);
    const commandResults = new Map();
    commandResults.set("/some-command", { success: true, output: "ok", artifacts: [] });
    const ctx = createRunContext(CONFIG, state, dir, stateMgr, commandResults);

    const result = await ctx.invokeCommand("/some-command");
    expect(result.success).toBe(true);
    expect(result.output).toBe("ok");
    rmSync(dir, { recursive: true });
  });
});

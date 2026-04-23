// src/runner/context.ts
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { exec as execCb } from "child_process";
import { promisify } from "util";
import { StateManager } from "../state/state.js";
import { createApprovalHandler } from "./approval.js";
import type {
  OrchestratorConfig,
  WorkflowState,
  RunContext,
  ExecOpts,
  ExecResult,
  CommandResult,
  StepResult,
  NeedsCommandSignal,
} from "../types.js";

const execAsync = promisify(execCb);

export function createRunContext(
  config: OrchestratorConfig,
  state: WorkflowState,
  projectRoot: string,
  stateManager: StateManager,
  commandResults?: Map<string, CommandResult>,
  stepId?: string,
): RunContext {
  return {
    config,
    state,
    projectRoot,
    scope: config.scope,

    resolve(path: string): string {
      return join(projectRoot, path);
    },

    async exists(path: string): Promise<boolean> {
      return existsSync(join(projectRoot, path));
    },

    async readFile(path: string): Promise<string> {
      return readFileSync(join(projectRoot, path), "utf-8");
    },

    async exec(cmd: string, opts?: ExecOpts): Promise<ExecResult> {
      const cwd = opts?.cwd ?? projectRoot;
      const timeout = opts?.timeout ?? 120_000;
      const env = { ...process.env, ...opts?.env };

      try {
        const { stdout, stderr } = await execAsync(cmd, {
          cwd,
          timeout,
          env,
          shell: "/bin/bash",
        });
        return { exitCode: 0, stdout, stderr, timedOut: false };
      } catch (err: unknown) {
        if (typeof err === "object" && err !== null) {
          const e = err as Record<string, unknown>;
          return {
            exitCode: typeof e.code === "number" ? e.code : 1,
            stdout: typeof e.stdout === "string" ? e.stdout : "",
            stderr: typeof e.stderr === "string" ? e.stderr : "",
            timedOut: e.killed === true,
          };
        }
        return { exitCode: 1, stdout: "", stderr: "", timedOut: false };
      }
    },

    async invokeCommand(command: string, args?: string): Promise<CommandResult> {
      const key = args ? `${command} ${args}` : command;
      const existing = commandResults?.get(key);
      if (existing) return existing;

      throw { __type: "needs_command", command, args } satisfies NeedsCommandSignal;
    },

    awaitApproval: createApprovalHandler(
      config.approval_mode ?? "auto",
      state,
      stepId ?? "unknown",
    ),

    updateState(stepId: string, result: StepResult): void {
      stateManager.update(state, stepId, result);
      stateManager.save(state);
    },
  };
}

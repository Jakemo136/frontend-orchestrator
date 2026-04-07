// src/runner/context.ts
import { join } from "path";
import { existsSync } from "fs";
import { exec as execCb } from "child_process";
import { promisify } from "util";
import { StateManager } from "../state/state.js";
import type {
  OrchestratorConfig,
  WorkflowState,
  RunContext,
  ExecOpts,
  ExecResult,
  CommandResult,
  StepResult,
} from "../types.js";

const execAsync = promisify(execCb);

export function createRunContext(
  config: OrchestratorConfig,
  state: WorkflowState,
  projectRoot: string,
  stateManager: StateManager,
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
        const e = err as { code?: number; stdout?: string; stderr?: string; killed?: boolean };
        return {
          exitCode: e.code ?? 1,
          stdout: e.stdout ?? "",
          stderr: e.stderr ?? "",
          timedOut: e.killed === true,
        };
      }
    },

    async invokeCommand(command: string, args?: string): Promise<CommandResult> {
      // Plugin commands are invoked through Claude Code's skill system.
      // Placeholder — wired at integration time.
      return {
        success: false,
        output: "",
        artifacts: [],
        error: `invokeCommand not yet wired: ${command} ${args ?? ""}`,
      };
    },

    async awaitApproval(prompt: string): Promise<void> {
      console.log(`\n⏸  APPROVAL REQUIRED: ${prompt}`);
      console.log("   (auto-approved in development mode)\n");
    },

    updateState(stepId: string, result: StepResult): void {
      stateManager.update(state, stepId, result);
      stateManager.save(state);
    },
  };
}

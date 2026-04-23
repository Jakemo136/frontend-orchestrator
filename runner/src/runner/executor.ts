// src/runner/executor.ts
import { getRunnable } from "./dag.js";
import { createRunContext } from "./context.js";
import { StateManager } from "../state/state.js";
import { getStepClass } from "../steps/registry.js";
import { isNeedsCommandSignal } from "../types.js";
import type {
  OrchestratorConfig,
  StepDefinition,
  StepResult,
  WorkflowState,
  RunnerOutput,
  CommandResult,
} from "../types.js";

export class Executor {
  private stateManager: StateManager;
  private state: WorkflowState;

  constructor(
    private config: OrchestratorConfig,
    private steps: StepDefinition[],
    private projectRoot: string,
    private commandResults?: Map<string, CommandResult>,
  ) {
    this.stateManager = new StateManager(projectRoot);
    this.state = this.stateManager.load(config.project, config.scope);
  }

  async runNext(): Promise<RunnerOutput> {
    const runnable = getRunnable(this.steps, this.state);
    if (runnable.length === 0) return { type: "pipeline_done" };
    return this.executeStepDef(runnable[0]!);
  }

  async runStep(stepId: string): Promise<RunnerOutput> {
    const stepDef = this.steps.find((s) => s.id === stepId);
    if (!stepDef) {
      const result: StepResult = {
        status: "failed",
        artifacts: [],
        metrics: {},
        message: `Unknown step: ${stepId}`,
      };
      return { type: "pipeline_failed", stepId, result };
    }
    return this.executeStepDef(stepDef);
  }

  private async executeStepDef(stepDef: StepDefinition): Promise<RunnerOutput> {
    const StepClass = getStepClass(stepDef.type);

    if (!StepClass) {
      const result: StepResult = {
        status: "failed",
        artifacts: [],
        metrics: {},
        message: `Unknown step type: ${stepDef.type}`,
      };
      this.persistAndFail(stepDef.id, result);
      return { type: "pipeline_failed", stepId: stepDef.id, result };
    }

    const step = new StepClass(stepDef);

    if (step.shouldSkip(this.config.scope.type)) {
      const result: StepResult = {
        status: "skipped",
        artifacts: [],
        metrics: {},
        message: `Skipped — below scope threshold for ${this.config.scope.type}`,
      };
      this.persistAndComplete(stepDef.id, result);
      return this.completeStep(stepDef.id, result);
    }

    const ctx = createRunContext(
      this.config,
      this.state,
      this.projectRoot,
      this.stateManager,
      this.commandResults,
      stepDef.id,
    );

    const preflight = await step.preflight(ctx);
    if (!preflight.ready) {
      const result: StepResult = {
        status: "failed",
        artifacts: [],
        metrics: {},
        message: `Preflight failed: ${preflight.issues.join("; ")}`,
      };
      this.persistAndFail(stepDef.id, result);
      return { type: "pipeline_failed", stepId: stepDef.id, result };
    }

    this.stateManager.markInProgress(this.state, stepDef.id);
    this.stateManager.save(this.state);

    try {
      const result = await step.execute(ctx);
      this.persistAndComplete(stepDef.id, result);

      if (result.status === "failed") {
        return { type: "pipeline_failed", stepId: stepDef.id, result };
      }

      return this.completeStep(stepDef.id, result);
    } catch (err) {
      if (isNeedsCommandSignal(err)) {
        return { type: "needs_command", stepId: stepDef.id, command: err.command, args: err.args };
      }
      throw err;
    }
  }

  private persistAndComplete(stepId: string, result: StepResult): void {
    this.stateManager.update(this.state, stepId, result);
    this.stateManager.save(this.state);
  }

  private persistAndFail(stepId: string, result: StepResult): void {
    this.stateManager.update(this.state, stepId, result);
    this.stateManager.save(this.state);
  }

  private completeStep(stepId: string, result: StepResult): RunnerOutput {
    // Reload runnable after state has been updated
    const runnable = getRunnable(this.steps, this.state);
    const nextStepId = runnable.length > 0 ? runnable[0]!.id : null;
    return { type: "step_complete", stepId, result, nextStepId };
  }

  getState(): WorkflowState {
    return this.state;
  }
}

// src/runner/executor.ts
import { getRunnable } from "./dag.js";
import { createRunContext } from "./context.js";
import { StateManager } from "../state/state.js";
import { getStepClass } from "../steps/registry.js";
import type {
  OrchestratorConfig,
  StepDefinition,
  StepResult,
  WorkflowState,
} from "../types.js";

export interface ExecutionResult {
  stepId: string;
  result: StepResult;
}

export class Executor {
  private stateManager: StateManager;
  private state: WorkflowState;

  constructor(
    private config: OrchestratorConfig,
    private steps: StepDefinition[],
    private projectRoot: string,
  ) {
    this.stateManager = new StateManager(projectRoot);
    this.state = this.stateManager.load(config.project, config.scope);
  }

  async runNext(): Promise<ExecutionResult | null> {
    const runnable = getRunnable(this.steps, this.state);
    if (runnable.length === 0) return null;

    const stepDef = runnable[0]!;
    const StepClass = getStepClass(stepDef.type);

    if (!StepClass) {
      const result: StepResult = {
        status: "failed",
        artifacts: [],
        metrics: {},
        message: `Unknown step type: ${stepDef.type}`,
      };
      this.stateManager.update(this.state, stepDef.id, result);
      this.stateManager.save(this.state);
      return { stepId: stepDef.id, result };
    }

    const step = new StepClass(stepDef);

    // Check scope — skip if below threshold
    if (step.shouldSkip(this.config.scope.type)) {
      const result: StepResult = {
        status: "skipped",
        artifacts: [],
        metrics: {},
        message: `Skipped — below scope threshold for ${this.config.scope.type}`,
      };
      this.stateManager.update(this.state, stepDef.id, result);
      this.stateManager.save(this.state);
      return { stepId: stepDef.id, result };
    }

    const ctx = createRunContext(
      this.config,
      this.state,
      this.projectRoot,
      this.stateManager,
    );

    // Preflight
    const preflight = await step.preflight(ctx);
    if (!preflight.ready) {
      const result: StepResult = {
        status: "failed",
        artifacts: [],
        metrics: {},
        message: `Preflight failed: ${preflight.issues.join("; ")}`,
      };
      this.stateManager.update(this.state, stepDef.id, result);
      this.stateManager.save(this.state);
      return { stepId: stepDef.id, result };
    }

    // Execute
    this.stateManager.markInProgress(this.state, stepDef.id);
    this.stateManager.save(this.state);

    const result = await step.execute(ctx);

    this.stateManager.update(this.state, stepDef.id, result);
    this.stateManager.save(this.state);

    return { stepId: stepDef.id, result };
  }

  getState(): WorkflowState {
    return this.state;
  }
}

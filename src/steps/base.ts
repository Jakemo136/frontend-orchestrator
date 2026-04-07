// src/steps/base.ts
import type {
  StepDefinition,
  Step,
  StepDescription,
  PreflightResult,
  StepResult,
  RunContext,
  ScopeThreshold,
} from "../types.js";
import { scopeMeetsThreshold } from "../types.js";

export abstract class BaseStep implements Step {
  constructor(public readonly definition: StepDefinition) {}

  abstract describe(): StepDescription;
  abstract preflight(ctx: RunContext): Promise<PreflightResult>;
  abstract execute(ctx: RunContext): Promise<StepResult>;

  shouldSkip(pipelineScope: ScopeThreshold): boolean {
    const threshold = this.describe().scope;
    return !scopeMeetsThreshold(pipelineScope, threshold);
  }
}

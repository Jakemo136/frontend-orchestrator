// src/steps/registry.ts
import type { StepDefinition } from "../types.js";
import type { BaseStep } from "./base.js";

type StepConstructor = new (definition: StepDefinition) => BaseStep;

const registry = new Map<string, StepConstructor>();

export function registerStep(type: string, ctor: StepConstructor): void {
  registry.set(type, ctor);
}

export function getStepClass(type: string): StepConstructor | undefined {
  return registry.get(type);
}

export { registry as stepRegistry };

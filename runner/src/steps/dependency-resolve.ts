import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import { BaseStep } from "./base.js";
import { registerStep } from "./registry.js";
import type { StepDescription, PreflightResult, StepResult, RunContext } from "../types.js";

export function countWaves(planContent: string): number {
  const matches = planContent.match(/^##\s*wave\s+\d+/gim);
  return Math.max(1, matches?.length ?? 1);
}

export interface WavePlan {
  wave_count: number;
  waves: Record<string, string[]>;
}

export function parseWavePlan(planContent: string): WavePlan {
  const waveCount = countWaves(planContent);
  const waves: Record<string, string[]> = {};

  const wavePattern = /^##\s*wave\s+(\d+)/gim;
  let match: RegExpExecArray | null;
  const wavePositions: Array<{ index: number; waveNum: string }> = [];

  while ((match = wavePattern.exec(planContent)) !== null) {
    wavePositions.push({ index: match.index, waveNum: match[1]! });
  }

  for (let i = 0; i < wavePositions.length; i++) {
    const start = wavePositions[i]!.index;
    const end = i + 1 < wavePositions.length ? wavePositions[i + 1]!.index : planContent.length;
    const section = planContent.slice(start, end);
    const components = [...section.matchAll(/^[-*]\s+(.+)/gm)].map(m => m[1]!.trim());
    waves[wavePositions[i]!.waveNum] = components;
  }

  return { wave_count: waveCount, waves };
}

export class DependencyResolveStep extends BaseStep {
  describe(): StepDescription {
    return {
      id: this.definition.id,
      type: "dependency-resolve",
      summary: "Resolve component dependencies and produce BUILD_PLAN.md. Requires user approval.",
      prerequisites: ["COMPONENT_INVENTORY.md"],
      artifacts: ["BUILD_PLAN.md"],
      passCondition: "BUILD_PLAN.md exists and user approves the plan.",
      failCondition: "Inventory missing, BUILD_PLAN.md not generated, or user rejects.",
      scope: "page",
    };
  }

  async preflight(ctx: RunContext): Promise<PreflightResult> {
    const exists = await ctx.exists(ctx.config.artifacts.inventory);
    return {
      ready: exists,
      issues: exists ? [] : [`Missing ${ctx.config.artifacts.inventory}`],
    };
  }

  async execute(ctx: RunContext): Promise<StepResult> {
    await ctx.invokeCommand("/build-pipeline:resolve-deps");

    const planPath = ctx.config.artifacts.build_plan;
    const planExists = await ctx.exists(planPath);
    if (!planExists) {
      return {
        status: "failed",
        artifacts: [],
        metrics: {},
        message: `${planPath} not generated after dependency resolution.`,
      };
    }

    try {
      await ctx.awaitApproval(`Review and approve build plan: ${planPath}`);
    } catch {
      return {
        status: "failed",
        artifacts: [],
        metrics: {},
        message: "User rejected the build plan.",
      };
    }

    const content = await ctx.readFile(planPath);
    const wavePlan = parseWavePlan(content);

    const wavePlanPath = ".orchestrator/wave-plan.json";
    const absWavePlanPath = ctx.resolve(wavePlanPath);
    mkdirSync(dirname(absWavePlanPath), { recursive: true });
    writeFileSync(absWavePlanPath, JSON.stringify(wavePlan, null, 2) + "\n");

    return {
      status: "passed",
      artifacts: [planPath, wavePlanPath],
      metrics: { wave_count: wavePlan.wave_count },
      message: `Build plan approved. ${wavePlan.wave_count} wave(s) identified.`,
    };
  }
}

registerStep("dependency-resolve", DependencyResolveStep);

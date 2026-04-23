import { isNeedsCommandSignal, isNeedsApprovalSignal } from "../types.js";
import type { StepResult, NeedsCommandSignal, NeedsApprovalSignal } from "../types.js";

export interface ParallelTask {
  id: string;
  run: () => Promise<StepResult>;
}

export interface ParallelResult {
  stepId: string;
  result: StepResult;
  signal?: NeedsCommandSignal | NeedsApprovalSignal;
}

export async function fanOutSteps(tasks: ParallelTask[]): Promise<ParallelResult[]> {
  const settled = await Promise.allSettled(
    tasks.map(async (task) => {
      const result = await task.run();
      return { stepId: task.id, result };
    }),
  );

  return settled.map((outcome, i) => {
    if (outcome.status === "fulfilled") return outcome.value;

    if (isNeedsCommandSignal(outcome.reason)) {
      return {
        stepId: tasks[i]!.id,
        result: {
          status: "failed" as const,
          artifacts: [],
          metrics: {},
          message: `Paused — needs command: ${outcome.reason.command}`,
        },
        signal: outcome.reason,
      };
    }

    if (isNeedsApprovalSignal(outcome.reason)) {
      return {
        stepId: tasks[i]!.id,
        result: {
          status: "failed" as const,
          artifacts: [],
          metrics: {},
          message: `Paused — needs approval: ${outcome.reason.prompt}`,
        },
        signal: outcome.reason,
      };
    }

    return {
      stepId: tasks[i]!.id,
      result: {
        status: "failed" as const,
        artifacts: [],
        metrics: {},
        message: `Uncaught error: ${outcome.reason}`,
      },
    };
  });
}

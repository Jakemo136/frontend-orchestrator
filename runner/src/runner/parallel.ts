import type { StepResult } from "../types.js";

export interface ParallelTask {
  id: string;
  run: () => Promise<StepResult>;
}

export interface ParallelResult {
  stepId: string;
  result: StepResult;
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

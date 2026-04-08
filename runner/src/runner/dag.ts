import type { StepDefinition, WorkflowState } from "../types.js";

/**
 * Kahn's algorithm for topological sort.
 * Throws if the graph contains a cycle.
 */
export function topologicalSort(steps: StepDefinition[]): StepDefinition[] {
  const idToStep = new Map(steps.map((s) => [s.id, s]));
  const inDegree = new Map(steps.map((s) => [s.id, 0]));
  const adjacency = new Map<string, string[]>();

  for (const step of steps) {
    adjacency.set(step.id, []);
  }

  for (const step of steps) {
    for (const dep of step.deps) {
      if (!adjacency.has(dep)) continue;
      adjacency.get(dep)!.push(step.id);
      inDegree.set(step.id, (inDegree.get(step.id) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted: StepDefinition[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(idToStep.get(id)!);
    for (const neighbor of adjacency.get(id) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== steps.length) {
    throw new Error(
      `Circular dependency detected. Resolved ${sorted.length}/${steps.length} steps.`,
    );
  }

  return sorted;
}

/**
 * Returns steps whose dependencies are all satisfied (passed or skipped)
 * and that haven't started yet.
 */
export function getRunnable(
  steps: StepDefinition[],
  state: WorkflowState,
): StepDefinition[] {
  const satisfiedStatuses = new Set(["passed", "skipped"]);

  return steps.filter((step) => {
    const stepState = state.steps[step.id];
    if (stepState) return false;

    return step.deps.every((dep) => {
      const depState = state.steps[dep];
      return depState != null && satisfiedStatuses.has(depState.status);
    });
  });
}

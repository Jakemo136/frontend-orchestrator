import type { OrchestratorConfig, StepDefinition } from "../types.js";
import { scopeMeetsThreshold } from "../types.js";

export function generateDefaultPipeline(
  config: OrchestratorConfig,
  waveCount: number = 1,
): StepDefinition[] {
  const s = config.scope.type;
  const steps: StepDefinition[] = [];

  function add(
    id: string,
    type: string,
    deps: string[],
    params: Record<string, unknown>,
    threshold: typeof s,
  ) {
    if (scopeMeetsThreshold(s, threshold)) {
      steps.push({ id, type, deps, params });
    }
  }

  // Phase 1: Requirements
  add("session-start", "session-start", [], {}, "component");
  add("ui-interview", "requirements-gate", ["session-start"], {}, "component");
  add("review-requirements", "review-requirements", ["ui-interview"], {}, "page");

  // Phase 2: Planning
  add("user-story-generation", "user-story-generation", ["ui-interview"], {}, "page");
  add("e2e-scaffold", "e2e-scaffold", ["user-story-generation"], {}, "page");
  add("dependency-resolve", "dependency-resolve", ["e2e-scaffold"], {}, "page");

  // Phase 3: Build waves — component/feature depend on ui-interview; page/app depend on dependency-resolve
  const effectiveWaves = Math.max(1, Math.floor(waveCount));
  const waveDep =
    s === "component" || s === "feature" ? "ui-interview" : "dependency-resolve";

  for (let w = 0; w < effectiveWaves; w++) {
    const dep = w === 0 ? waveDep : `await-merge:${w - 1}`;
    add(`build-wave:${w}`, "build-wave", [dep], { wave: w }, "component");
    add(`test-suite:${w}`, "test-suite", [`build-wave:${w}`], { wave: w, e2e_blocking: false }, "component");
    add(`post-wave-review:${w}`, "post-wave-review", [`test-suite:${w}`], { wave: w }, "component");
    add(`open-prs:${w}`, "open-prs", [`post-wave-review:${w}`], { wave: w }, "component");
    add(`await-merge:${w}`, "await-merge", [`open-prs:${w}`], { wave: w }, "component");
  }

  const lastWave = effectiveWaves - 1;

  // Phase 4: Quality — e2e-green runs after build waves complete
  add("e2e-green", "e2e-green", [`await-merge:${lastWave}`], {}, "page");
  add("design-audit", "design-audit", ["e2e-green"], {}, "page");
  add("visual-qa", "visual-qa", ["design-audit"], {}, "page");
  add("set-baseline", "set-baseline", ["design-audit"], {}, "page");

  // Phase 5: Ship
  const shipDeps =
    s === "component" || s === "feature"
      ? [`await-merge:${lastWave}`]
      : ["visual-qa", "set-baseline"];
  add("pre-commit-review", "pre-commit-review", shipDeps, {}, "component");
  add("merge-to-main", "merge-to-main", ["pre-commit-review"], {}, "app");

  return steps;
}

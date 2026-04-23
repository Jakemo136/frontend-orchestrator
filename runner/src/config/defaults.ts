import type { OrchestratorConfig, StepDefinition } from "../types.js";
import { scopeMeetsThreshold } from "../types.js";

export function generateDefaultPipeline(
  config: OrchestratorConfig,
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
  const waveDep =
    s === "component" || s === "feature" ? "ui-interview" : "dependency-resolve";
  add("build-wave:0", "build-wave", [waveDep], { wave: 0 }, "component");
  add("test-suite:0", "test-suite", ["build-wave:0"], { wave: 0, e2e_blocking: false }, "component");
  add("post-wave-review:0", "post-wave-review", ["test-suite:0"], { wave: 0 }, "component");
  add("open-prs:0", "open-prs", ["post-wave-review:0"], { wave: 0 }, "component");
  add("await-merge:0", "await-merge", ["open-prs:0"], { wave: 0 }, "component");

  // Phase 4: Quality — e2e-green runs after build waves complete
  add("e2e-green", "e2e-green", ["await-merge:0"], {}, "page");
  add("design-audit", "design-audit", ["e2e-green"], {}, "page");
  add("visual-qa", "visual-qa", ["design-audit"], {}, "page");
  add("set-baseline", "set-baseline", ["design-audit"], {}, "page");

  // Phase 5: Ship
  const shipDeps =
    s === "component" || s === "feature"
      ? ["await-merge:0"]
      : ["visual-qa", "set-baseline"];
  add("pre-commit-review", "pre-commit-review", shipDeps, {}, "component");
  add("merge-to-main", "merge-to-main", ["pre-commit-review"], {}, "app");

  return steps;
}

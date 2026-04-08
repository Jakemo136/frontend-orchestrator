import { loadConfig } from "./config/loader.js";
import { generateDefaultPipeline } from "./config/defaults.js";
import { Executor } from "./runner/executor.js";
import { StateManager } from "./state/state.js";
import { formatExplain } from "./explain/explain.js";
import { getStepClass } from "./steps/registry.js";
import { writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { CommandResult } from "./types.js";

// Import all steps to trigger registration
import "./steps/session-start.js";
import "./steps/requirements-gate.js";
import "./steps/review-requirements.js";
import "./steps/e2e-scaffold.js";
import "./steps/dependency-resolve.js";
import "./steps/build-wave.js";
import "./steps/test-suite.js";
import "./steps/post-wave-review.js";
import "./steps/e2e-green.js";
import "./steps/design-audit.js";
import "./steps/visual-qa.js";
import "./steps/set-baseline.js";
import "./steps/pre-commit-review.js";
import "./steps/open-prs.js";
import "./steps/await-merge.js";
import "./steps/merge-to-main.js";
import "./steps/user-story-generation.js";

export interface ParsedCommand {
  command: "run" | "status" | "explain" | "run-step" | "reset" | "init";
  stepId?: string;
  commandResults?: Map<string, CommandResult>;
}

export function parseArgs(args: string[]): ParsedCommand {
  const commandResults = new Map<string, CommandResult>();

  // Extract --command-result flags before parsing command
  const filtered: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--command-result" && args[i + 1]) {
      const arg = args[i + 1]!;
      const eqIndex = arg.indexOf("=");
      if (eqIndex > 0) {
        const key = arg.slice(0, eqIndex);
        const b64 = arg.slice(eqIndex + 1);
        try {
          const result = JSON.parse(Buffer.from(b64, "base64").toString("utf-8")) as CommandResult;
          commandResults.set(key, result);
        } catch {
          // Skip malformed results
        }
      }
      i++; // skip the value arg
    } else {
      filtered.push(args[i]!);
    }
  }

  if (filtered.length === 0) return { command: "run", commandResults };

  const first = filtered[0]!;

  if (first === "--explain") return { command: "explain" };
  if (first === "status") return { command: "status" };
  if (first === "init") return { command: "init" };

  if (first === "run" && filtered[1]) {
    return { command: "run-step", stepId: filtered[1], commandResults };
  }

  if (first === "reset" && filtered[1]) {
    return { command: "reset", stepId: filtered[1] };
  }

  return { command: "run", commandResults };
}

const TEMPLATE_CONFIG = `# orchestrator.config.yaml
project: my-project

scope:
  type: app
  target: null

branches:
  main: main
  feature: null

artifacts:
  requirements: docs/UI_REQUIREMENTS.md
  inventory: docs/COMPONENT_INVENTORY.md
  build_plan: docs/BUILD_PLAN.md
  build_status: docs/BUILD_STATUS.md
  design_audit: docs/DESIGN_AUDIT.md
  visual_qa: docs/VISUAL_QA.md

commands:
  test_client: "npm test"
  test_server: "cd server && npm test"
  test_e2e: "npx playwright test"
  build_client: "npm run build"
  dev_server: "npm run dev"
  typecheck: "npx tsc --noEmit"

ci:
  required_on_main: [server, client, e2e]
  required_on_feature: [server, client]
  informational_on_feature: [e2e]
`;

async function main() {
  const cmd = parseArgs(process.argv.slice(2));
  const projectRoot = process.cwd();

  switch (cmd.command) {
    case "init": {
      const configPath = join(projectRoot, "orchestrator.config.yaml");
      if (existsSync(configPath)) {
        process.stderr.write("orchestrator.config.yaml already exists\n");
        process.exit(1);
      }
      writeFileSync(configPath, TEMPLATE_CONFIG);
      process.stdout.write("Created orchestrator.config.yaml\n");
      break;
    }

    case "explain": {
      const config = loadConfig(projectRoot);
      const steps = config.steps ?? generateDefaultPipeline(config);
      const stateMgr = new StateManager(projectRoot);
      const state = stateMgr.load(config.project, config.scope);
      const descriptions = steps.map((stepDef) => {
        const StepClass = getStepClass(stepDef.type);
        if (!StepClass) {
          return {
            id: stepDef.id,
            type: stepDef.type,
            summary: `Unknown step type: ${stepDef.type}`,
            prerequisites: stepDef.deps,
            artifacts: [],
            passCondition: "N/A",
            failCondition: "N/A",
            scope: "component" as const,
          };
        }
        return new StepClass(stepDef).describe();
      });
      console.log(formatExplain(config.project, config.scope.type, descriptions, state));
      break;
    }

    case "status": {
      const config = loadConfig(projectRoot);
      const stateMgr = new StateManager(projectRoot);
      const state = stateMgr.load(config.project, config.scope);
      const entries = Object.entries(state.steps);
      if (entries.length === 0) {
        console.log("No steps have run yet.");
      } else {
        for (const [id, s] of entries) {
          console.log(`  ${s.status.padEnd(12)} ${id} — ${s.message}`);
        }
      }
      break;
    }

    case "run": {
      const config = loadConfig(projectRoot);
      const steps = config.steps ?? generateDefaultPipeline(config);
      const executor = new Executor(config, steps, projectRoot, cmd.commandResults);
      const output = await executor.runNext();
      process.stdout.write(JSON.stringify(output) + "\n");

      if (output.type === "pipeline_failed") {
        process.exit(1);
      }
      break;
    }

    case "reset": {
      if (!cmd.stepId) {
        process.stderr.write("Usage: orchestrate reset <step-id>\n");
        process.exit(1);
      }
      const config = loadConfig(projectRoot);
      const stateMgr = new StateManager(projectRoot);
      const state = stateMgr.load(config.project, config.scope);
      delete state.steps[cmd.stepId];
      stateMgr.save(state);
      process.stdout.write(`Reset step: ${cmd.stepId}\n`);
      break;
    }

    case "run-step": {
      if (!cmd.stepId) {
        process.stderr.write("Usage: orchestrate run <step-id>\n");
        process.exit(1);
      }
      const config = loadConfig(projectRoot);
      const steps = config.steps ?? generateDefaultPipeline(config);
      const executor = new Executor(config, steps, projectRoot, cmd.commandResults);

      const runnable = steps.filter((s) => s.id === cmd.stepId);
      if (runnable.length === 0) {
        process.stderr.write(`Unknown step: ${cmd.stepId}\n`);
        process.exit(1);
      }

      const output = await executor.runNext();
      process.stdout.write(JSON.stringify(output) + "\n");

      if (output.type === "pipeline_failed") {
        process.exit(1);
      }
      break;
    }
  }
}

const isDirectRun = process.argv[1]?.endsWith("cli.ts") || process.argv[1]?.endsWith("cli.js");
if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

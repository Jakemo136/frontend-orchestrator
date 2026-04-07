import { readFileSync, existsSync } from "fs";
import { join } from "path";
import YAML from "yaml";
import { configSchema } from "./schema.js";
import type { OrchestratorConfig } from "../types.js";

const CONFIG_FILENAME = "orchestrator.config.yaml";

export function loadConfig(projectRoot: string): OrchestratorConfig {
  const configPath = join(projectRoot, CONFIG_FILENAME);

  if (!existsSync(configPath)) {
    throw new Error(
      `Config not found: ${configPath}\nRun 'orchestrate init' to create one.`,
    );
  }

  const raw = readFileSync(configPath, "utf-8");
  const parsed = YAML.parse(raw);
  const result = configSchema.safeParse(parsed);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid config in ${configPath}:\n${issues}`);
  }

  return result.data as OrchestratorConfig;
}

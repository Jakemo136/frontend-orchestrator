import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { createFixtureProject } from "./fixture-project.js";

describe("createFixtureProject", () => {
  it("creates directory with required structure", () => {
    const fixture = createFixtureProject();
    try {
      expect(fixture.dir).toBeTruthy();
      expect(fixture.config.project).toBe("fixture");
      expect(existsSync(join(fixture.dir, "docs"))).toBe(true);
      expect(existsSync(join(fixture.dir, ".orchestrator"))).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("accepts config overrides", () => {
    const fixture = createFixtureProject({ project: "custom" });
    try {
      expect(fixture.config.project).toBe("custom");
    } finally {
      fixture.cleanup();
    }
  });

  it("can pre-populate artifacts", () => {
    const fixture = createFixtureProject({}, {
      inventory: "## Components\n- Header\n- Footer",
      wavePlan: { wave_count: 1, waves: { "0": ["Header", "Footer"] } },
    });
    try {
      const inv = readFileSync(join(fixture.dir, "docs/COMPONENT_INVENTORY.md"), "utf-8");
      expect(inv).toContain("Header");
      const plan = JSON.parse(readFileSync(join(fixture.dir, ".orchestrator/wave-plan.json"), "utf-8"));
      expect(plan.wave_count).toBe(1);
    } finally {
      fixture.cleanup();
    }
  });
});

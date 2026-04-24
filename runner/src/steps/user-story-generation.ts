import { BaseStep } from "./base.js";
import { registerStep } from "./registry.js";
import type { StepDescription, PreflightResult, StepResult, RunContext } from "../types.js";

export class UserStoryGenerationStep extends BaseStep {
  describe(): StepDescription {
    return {
      id: this.definition.id,
      type: "user-story-generation",
      summary: "Generate USER_STORIES.md with PM-voice interaction sequences for every form, modal, and multi-step flow. Stories include Data flow annotations tracing prop chains across component boundaries.",
      prerequisites: ["UI_REQUIREMENTS.md", "COMPONENT_INVENTORY.md"],
      artifacts: ["USER_STORIES.md"],
      passCondition: "USER_STORIES.md exists, covers all forms/modals in inventory, includes Data flow annotations for cross-component flows, user approves.",
      failCondition: "Missing source docs, incomplete coverage, or user rejects.",
      scope: "page",
      verification: "command-result",
    };
  }

  async preflight(ctx: RunContext): Promise<PreflightResult> {
    const issues: string[] = [];
    if (!(await ctx.exists(ctx.config.artifacts.requirements))) {
      issues.push(`Missing ${ctx.config.artifacts.requirements}`);
    }
    if (!(await ctx.exists(ctx.config.artifacts.inventory))) {
      issues.push(`Missing ${ctx.config.artifacts.inventory}`);
    }
    return { ready: issues.length === 0, issues };
  }

  async execute(ctx: RunContext): Promise<StepResult> {
    const result = await ctx.invokeCommand("/user-story-generation");

    if (!result.success) {
      return {
        status: "failed",
        artifacts: [],
        metrics: {},
        message: `User story generation failed: ${result.error ?? "unknown error"}`,
      };
    }

    // Verify artifact was created
    const storiesPath = "docs/USER_STORIES.md";
    if (!(await ctx.exists(storiesPath))) {
      return {
        status: "failed",
        artifacts: [],
        metrics: {},
        message: "USER_STORIES.md was not created by the generation step.",
      };
    }

    // User approval gate
    try {
      await ctx.awaitApproval(`Review and approve: ${storiesPath}\n\nVerify:\n- All forms/modals have stories\n- Cross-component flows have Data flow annotations\n- Stories trace prop chains across component boundaries`);
    } catch {
      return {
        status: "failed",
        artifacts: [],
        metrics: {},
        message: "User rejected user stories.",
      };
    }

    return {
      status: "passed",
      artifacts: [storiesPath],
      metrics: {},
      message: "User stories generated and approved.",
    };
  }
}

registerStep("user-story-generation", UserStoryGenerationStep);

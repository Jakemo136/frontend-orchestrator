import { describe, it, expect, vi } from "vitest";
import { UserStoryGenerationStep } from "../../src/steps/user-story-generation.js";
import { makeDefinition, makeMockContext } from "./helpers.js";

describe("UserStoryGenerationStep", () => {
  it("describe() returns correct metadata", () => {
    const step = new UserStoryGenerationStep(makeDefinition({ type: "user-story-generation" }));
    const desc = step.describe();
    expect(desc.type).toBe("user-story-generation");
    expect(desc.scope).toBe("page");
    expect(desc.passCondition).toContain("Data flow");
    expect(desc.artifacts).toContain("USER_STORIES.md");
    expect(desc.prerequisites).toContain("UI_REQUIREMENTS.md");
    expect(desc.prerequisites).toContain("COMPONENT_INVENTORY.md");
  });

  it("preflight fails when requirements missing", async () => {
    const step = new UserStoryGenerationStep(makeDefinition());
    const ctx = makeMockContext({ exists: vi.fn(async () => false) });
    const result = await step.preflight(ctx);
    expect(result.ready).toBe(false);
    expect(result.issues).toHaveLength(2);
  });

  it("preflight fails when only inventory missing", async () => {
    const step = new UserStoryGenerationStep(makeDefinition());
    const exists = vi.fn(async (path: string) => path.includes("REQUIREMENTS"));
    const ctx = makeMockContext({ exists });
    const result = await step.preflight(ctx);
    expect(result.ready).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain("COMPONENT_INVENTORY");
  });

  it("preflight passes when both docs exist", async () => {
    const step = new UserStoryGenerationStep(makeDefinition());
    const ctx = makeMockContext({ exists: vi.fn(async () => true) });
    const result = await step.preflight(ctx);
    expect(result.ready).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("execute invokes /user-story-generation command", async () => {
    const invokeCommand = vi.fn(async () => ({ success: true, output: "done", artifacts: [] }));
    const exists = vi.fn(async () => true);
    const ctx = makeMockContext({ invokeCommand, exists });
    const step = new UserStoryGenerationStep(makeDefinition());
    await step.execute(ctx);
    expect(invokeCommand).toHaveBeenCalledWith("/user-story-generation");
  });

  it("execute fails if command fails", async () => {
    const invokeCommand = vi.fn(async () => ({ success: false, output: "", artifacts: [], error: "gen error" }));
    const ctx = makeMockContext({ invokeCommand });
    const step = new UserStoryGenerationStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("gen error");
  });

  it("execute fails if USER_STORIES.md not created", async () => {
    const invokeCommand = vi.fn(async () => ({ success: true, output: "done", artifacts: [] }));
    const exists = vi.fn(async (path: string) => !path.includes("USER_STORIES"));
    const ctx = makeMockContext({ invokeCommand, exists });
    const step = new UserStoryGenerationStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("USER_STORIES.md was not created");
  });

  it("execute requires user approval", async () => {
    const invokeCommand = vi.fn(async () => ({ success: true, output: "done", artifacts: [] }));
    const exists = vi.fn(async () => true);
    const awaitApproval = vi.fn(async () => {});
    const ctx = makeMockContext({ invokeCommand, exists, awaitApproval });
    const step = new UserStoryGenerationStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("passed");
    expect(awaitApproval).toHaveBeenCalledTimes(1);
    expect(awaitApproval.mock.calls[0]![0]).toContain("Data flow annotations");
  });

  it("execute fails when user rejects stories", async () => {
    const invokeCommand = vi.fn(async () => ({ success: true, output: "done", artifacts: [] }));
    const exists = vi.fn(async () => true);
    const awaitApproval = vi.fn(async () => { throw new Error("rejected"); });
    const ctx = makeMockContext({ invokeCommand, exists, awaitApproval });
    const step = new UserStoryGenerationStep(makeDefinition());
    const result = await step.execute(ctx);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("User rejected");
  });
});

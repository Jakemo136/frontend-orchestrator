import type { EvidenceConfig, EvidenceSummary } from "./evidence/types.js";

// ─── Scope ───────────────────────────────────────────

export const SCOPE_ORDER = ["component", "feature", "page", "app"] as const;
export type ScopeThreshold = (typeof SCOPE_ORDER)[number];

export interface PipelineScope {
  type: ScopeThreshold;
  target: string | null;
}

export function scopeMeetsThreshold(
  pipelineScope: ScopeThreshold,
  threshold: ScopeThreshold,
): boolean {
  return SCOPE_ORDER.indexOf(pipelineScope) >= SCOPE_ORDER.indexOf(threshold);
}

// ─── Config ──────────────────────────────────────────

export interface OrchestratorConfig {
  project: string;
  scope: PipelineScope;
  branches: {
    main: string;
    feature: string | null;
  };
  artifacts: {
    requirements: string;
    inventory: string;
    build_plan: string;
    build_status: string;
    design_audit: string;
    visual_qa: string;
  };
  commands: {
    test_client: string;
    test_server: string;
    test_e2e: string;
    build_client: string;
    dev_server: string;
    typecheck: string;
  };
  ci: {
    required_on_main: string[];
    required_on_feature: string[];
    informational_on_feature: string[];
  };
  dev_server_url: string;
  evidence: EvidenceConfig;
  steps?: StepDefinition[];
  approval_mode?: ApprovalMode;
}

// ─── Step Definition (from config) ───────────────────

export interface StepDefinition {
  id: string;
  type: string;
  deps: string[];
  params: Record<string, unknown>;
}

// ─── Step Result ─────────────────────────────────────

export interface StepResult {
  status: "passed" | "failed" | "skipped";
  artifacts: string[];
  metrics: Record<string, number>;
  message: string;
  evidence?: EvidenceSummary;
}

// ─── Step Description (for --explain) ────────────────

export type VerificationBasis =
  | "exit-code"
  | "file-check"
  | "ci-check"
  | "approval"
  | "command-result";

export interface StepDescription {
  id: string;
  type: string;
  summary: string;
  prerequisites: string[];
  artifacts: string[];
  passCondition: string;
  failCondition: string;
  scope: ScopeThreshold;
  verification: VerificationBasis;
}

// ─── Preflight ───────────────────────────────────────

export interface PreflightResult {
  ready: boolean;
  issues: string[];
}

// ─── Exec ────────────────────────────────────────────

export interface ExecOpts {
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

// ─── Command ─────────────────────────────────────────

export interface CommandResult {
  success: boolean;
  output: string;
  artifacts: string[];
  error?: string;
}

// ─── Approval ────────────────────────────────────────

export type ApprovalMode = "auto" | "ci" | "interactive";

export interface ApprovalRecord {
  stepId: string;
  prompt: string;
  mode: ApprovalMode;
  approved_at: string;
}

// ─── Command Signal ─────────────────────────────────
export interface NeedsCommandSignal {
  __type: "needs_command";
  command: string;
  args?: string;
}

export function isNeedsCommandSignal(err: unknown): err is NeedsCommandSignal {
  return (
    typeof err === "object" &&
    err !== null &&
    "__type" in err &&
    "command" in err &&
    (err as NeedsCommandSignal).__type === "needs_command"
  );
}

export interface NeedsApprovalSignal {
  __type: "needs_approval";
  stepId: string;
  prompt: string;
}

export function isNeedsApprovalSignal(err: unknown): err is NeedsApprovalSignal {
  return (
    typeof err === "object" &&
    err !== null &&
    "__type" in err &&
    (err as NeedsApprovalSignal).__type === "needs_approval"
  );
}

// ─── Runner Output ──────────────────────────────────
export type RunnerOutput =
  | { type: "step_complete"; stepId: string; result: StepResult; nextStepId: string | null }
  | { type: "steps_complete"; results: Array<{ stepId: string; result: StepResult }>; nextStepId: string | null }
  | { type: "needs_command"; stepId: string; command: string; args?: string }
  | { type: "needs_approval"; stepId: string; prompt: string }
  | { type: "pipeline_done" }
  | { type: "pipeline_failed"; stepId: string; result: StepResult };

// ─── Run Context ─────────────────────────────────────

export interface RunContext {
  config: OrchestratorConfig;
  state: WorkflowState;
  projectRoot: string;
  scope: PipelineScope;
  resolve(path: string): string;
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  exec(cmd: string, opts?: ExecOpts): Promise<ExecResult>;
  invokeCommand(command: string, args?: string): Promise<CommandResult>;
  awaitApproval(prompt: string): Promise<void>;
  updateState(stepId: string, result: StepResult): void;
}

// ─── Step Interface ──────────────────────────────────

export interface Step {
  describe(): StepDescription;
  preflight(ctx: RunContext): Promise<PreflightResult>;
  execute(ctx: RunContext): Promise<StepResult>;
}

// ─── Workflow State ──────────────────────────────────

export interface StepState {
  status: "in_progress" | "passed" | "failed" | "skipped";
  started_at?: string;
  completed_at?: string;
  artifacts: string[];
  metrics: Record<string, number>;
  message: string;
  evidence?: EvidenceSummary;
}

export interface WorkflowState {
  project: string;
  scope: PipelineScope;
  started_at: string;
  updated_at: string;
  steps: Record<string, StepState>;
  artifact_hashes?: Record<string, string>;
  approvals?: ApprovalRecord[];
}

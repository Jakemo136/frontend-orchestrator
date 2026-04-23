import { z } from "zod";

const scopeTypeSchema = z.enum(["app", "page", "component", "feature"]);

const pipelineScopeSchema = z.object({
  type: scopeTypeSchema,
  target: z.string().nullable(),
});

const evidenceConfigSchema = z.object({
  playwright_config: z.string().default("playwright.config.ts"),
  output_dir: z.string().default("test-results"),
  json_report: z.string().default("test-results/results.json"),
  collect_to: z.string().default(".orchestrator/evidence"),
});

const breakpointSchema = z.object({
  name: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const designAuditConfigSchema = z.object({
  breakpoints: z.array(breakpointSchema).default([
    { name: "mobile", width: 375, height: 812 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1280, height: 900 },
    { name: "lgDesktop", width: 1440, height: 900 },
  ]),
  wcag_target: z.string().default("WCAG22AA"),
});

const approvalModeSchema = z.enum(["auto", "ci", "interactive"]).default("auto");

const stepDefinitionSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  deps: z.array(z.string()),
  params: z.record(z.unknown()),
});

export const configSchema = z.object({
  project: z.string().min(1),
  scope: pipelineScopeSchema,
  branches: z.object({
    main: z.string().min(1),
    feature: z.string().nullable(),
  }),
  artifacts: z.object({
    requirements: z.string().min(1),
    inventory: z.string().min(1),
    build_plan: z.string().min(1),
    build_status: z.string().min(1),
    design_audit: z.string().min(1),
    visual_qa: z.string().min(1),
  }),
  commands: z.object({
    test_client: z.string().min(1),
    test_server: z.string().min(1),
    test_e2e: z.string().min(1),
    build_client: z.string().min(1),
    dev_server: z.string().min(1),
    typecheck: z.string().min(1),
  }),
  dev_server_url: z.string().url().default("http://localhost:3000"),
  ci: z.object({
    required_on_main: z.array(z.string()),
    required_on_feature: z.array(z.string()),
    informational_on_feature: z.array(z.string()),
  }),
  evidence: evidenceConfigSchema.default({}),
  design_audit: designAuditConfigSchema.default({}),
  steps: z.array(stepDefinitionSchema).optional(),
  approval_mode: approvalModeSchema,
});

export type ValidatedConfig = z.infer<typeof configSchema>;

import { z } from "zod";

const scopeTypeSchema = z.enum(["app", "page", "component", "feature"]);

const pipelineScopeSchema = z.object({
  type: scopeTypeSchema,
  target: z.string().nullable(),
});

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
  ci: z.object({
    required_on_main: z.array(z.string()),
    required_on_feature: z.array(z.string()),
    informational_on_feature: z.array(z.string()),
  }),
  steps: z.array(stepDefinitionSchema).optional(),
});

export type ValidatedConfig = z.infer<typeof configSchema>;

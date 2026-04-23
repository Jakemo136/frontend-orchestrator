# Quality Matrix — What Is Actually Enforced

This document maps every quality claim to its enforcement
mechanism so users know exactly what to trust.

## Enforcement Levels

| Level | Meaning |
|-------|---------|
| **Runner-enforced** | TypeScript code executes the check. Failure blocks the pipeline. |
| **Prompt-delegated** | Runner invokes a slash command. The check runs inside the LLM session, not runner code. Quality depends on prompt adherence. |
| **User-gated** | Runner pauses for user confirmation. No automated validation — user is the check. |
| **Manual-only** | Documented as best practice. Not executed by any automation. |

## Check Matrix

### Build Phase

| Check | Level | Runner Code | Notes |
|-------|-------|-------------|-------|
| TypeScript typecheck | Runner-enforced | `test-suite.ts` runs `config.commands.typecheck` | Fails pipeline on non-zero exit |
| Client unit tests | Runner-enforced | `test-suite.ts` runs `config.commands.test_client` | Fails pipeline on non-zero exit |
| E2E tests | Runner-enforced | `test-suite.ts` / `e2e-green.ts` runs `config.commands.test_e2e` | Fails pipeline on non-zero exit |
| Component TDD protocol | Prompt-delegated | `build-wave.ts` → `/build-component` | TDD steps are prompt instructions, not verified by runner |
| Code review | Prompt-delegated | `post-wave-review.ts` → `/code-review` | LLM performs review; runner checks pass/fail signal |
| Code simplification | Prompt-delegated | `post-wave-review.ts` → `/code-simplify` | LLM performs cleanup; runner checks pass/fail signal |

### Quality Phase

| Check | Level | Runner Code | Notes |
|-------|-------|-------------|-------|
| Dev server health | Runner-enforced | `design-audit.ts` preflight | Checks HTTP status, redirects, auth walls |
| Playwright config | Runner-enforced | `preflight.ts` validates config | Regex-based — checks settings exist, not correctness |
| Design audit (a11y) | Prompt-delegated | `design-audit.ts` → `/design-audit` | Axe-core scan runs in MCP server; analysis is prompt-guided |
| Visual QA | Prompt-delegated | `visual-qa.ts` → `/visual-qa` | Screenshot capture is MCP; evaluation is prompt-guided |
| Visual regression | Runner-enforced | `screenshot-review` MCP `compare` tool | Pixel-level diff with configurable threshold |
| Wiring audit | Prompt-delegated | `post-wave-review.ts` → `/wiring-audit` | Integration test existence checked by prompt |

### Ship Phase

| Check | Level | Runner Code | Notes |
|-------|-------|-------------|-------|
| PR creation | Runner-enforced | `merge-to-main.ts` runs `gh pr create` | Fails on non-zero exit |
| CI check validation | Runner-enforced | `merge-to-main.ts` runs `gh pr checks` | Validates required checks pass |
| PR merge verification | Runner-enforced | `await-merge.ts` runs `gh pr list` | Validates all wave PRs have MERGED state |
| Build plan approval | User-gated | `dependency-resolve.ts` → `awaitApproval` | User reviews BUILD_PLAN.md |
| Baseline promotion | User-gated | `set-baseline.ts` → `awaitApproval` | User confirms visual state is acceptable |

### Not Automated

| Check | Level | Where Documented |
|-------|-------|-----------------|
| Security review | Manual-only | Not in pipeline |
| Performance testing | Manual-only | Not in pipeline |
| Cross-browser testing | Manual-only | Not in pipeline |
| Content review | Manual-only | Not in pipeline |
| Server-side test coverage | Manual-only | `config.commands.test_server` exists but not wired into default pipeline |
| End-to-end fixture test | Manual-only | Not yet implemented — runner tests validate mechanics, not operational completeness against a real project |

## How to Read This

- **Runner-enforced** checks are your safety net. They run deterministically.
- **Prompt-delegated** checks depend on LLM adherence to instructions. They are valuable but not deterministic — treat their output as advisory, not guaranteed.
- **User-gated** checks are only as strong as the human reviewing them.
- If a check is not in this matrix, it is not automated.

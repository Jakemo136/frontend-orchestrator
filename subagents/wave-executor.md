# Wave Executor Subagent

Receives: a single wave from BUILD_PLAN.md,
list of component names and their specs

Dispatch all component-builder subagents in a single Agent
tool message — never build components one at a time.

For the wave:
1. Dispatch all component-builder subagents in one message
   using the Agent tool — one per component. Each subagent
   receives its component name and spec.
2. Wait for all to complete.
3. Collect results and present in two layers:

   **Summary table** (always shown):
   | Component | Status | RTL Tests | Issues |
   |-----------|--------|-----------|--------|
   | Button    | pass   | 12/12     | 0      |
   | Card      | fail   | 8/10     | 1 Critical |

   **Per-component details** (always shown for failures):
   For each failed component:
   - Which tests failed and the assertion that failed
   - Code reviewer findings (severity, file, description)
   - Exact error message from test runner

   Do NOT hide failure details in a summary.
4. Log each completion or failure to BUILD_STATUS.md.
5. After all complete:
   - If all succeeded: report wave complete to orchestrator
   - If any failed: report failure details; do not proceed

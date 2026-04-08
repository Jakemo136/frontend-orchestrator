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
3. Collect results.
4. Log each completion or failure to BUILD_STATUS.md.
5. After all complete:
   - If all succeeded: report wave complete to orchestrator
   - If any failed: report failure details; do not proceed

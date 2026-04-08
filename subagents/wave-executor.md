# Wave Executor Subagent

Receives: a single wave from BUILD_PLAN.md,
list of component names and their specs

For the wave:
1. Spin up one component-builder subagent per component
2. Run all in parallel
3. Collect results as they complete
4. Log each completion or failure to BUILD_STATUS.md in real time
5. After all complete:
   - If all succeeded: report wave complete to orchestrator
   - If any failed: report failure details, do not proceed

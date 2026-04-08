---
description: Orchestrate TDD build of all components for a page in dependency order with PR per component
---

# /build-page [PageName]

Orchestrate TDD build of all components for a page in
correct dependency order.

Protocol:
1. Read /docs/COMPONENT_INVENTORY.md
2. Identify all components for [PageName] plus any shared
   components they depend on
3. Invoke the dependency-resolver subagent to produce
   a wave plan for this page's components
4. Write wave plan to /docs/BUILD_PLAN.md
5. Present plan to user and wait for explicit approval
6. On approval, invoke wave-executor subagent to build
   each wave

Wave execution per wave:
- Spin up one component-builder subagent per component
- Run all subagents in the wave in parallel
- Wait for all to complete before starting next wave
- After each wave: run E2E suite, log results to
  BUILD_STATUS.md
- If any component fails: stop, surface failure, wait
  for user direction

On completion:
- Run full RTL suite — all must pass
- Run full E2E suite — log results
- Report summary to user

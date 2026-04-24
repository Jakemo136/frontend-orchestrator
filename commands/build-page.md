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
4. Write wave plan to /docs/BUILD_PLAN_[PageName].md
   (e.g., /docs/BUILD_PLAN_Dashboard.md)
   This avoids overwriting the full-app BUILD_PLAN.md
   if /build-pipeline was run previously.
5. Present plan to user and wait for explicit approval
6. On approval, invoke wave-executor subagent to build
   each wave

Wave execution per wave:
- Dispatch all component-builder subagents for the wave
  in a single Agent tool message — one per component,
  all in parallel. Never build components sequentially.
- Wait for all to complete before starting next wave.
- Condense all component-builder results into a single
  summary: which passed, which failed, key issues.
  Do NOT relay each subagent's full report verbatim.
- After each wave: run E2E suite, log results to
  BUILD_STATUS.md.
- If any component fails: stop, surface failure, wait
  for user direction.

Review gate — runs after RTL + E2E pass for the wave:
1. Invoke `frontend-orchestration:code-review` against
   all files changed by this wave
2. Invoke `frontend-orchestration:code-simplify` against
   the same fileset
3. If either returns Critical or Major findings:
   - Fix them
   - Re-run the wave's RTL suite
   - Re-run both skills until clean
4. Minor findings may be noted but do not block
5. Only when both skills return clean may the wave
   be considered complete
6. On a clean run, write `.orchestrator/last-review.json`
   with `{ "wave": N, "ts": <unix-ts> }` so the opt-in
   review-gate hook (if installed) lets PRs through

See standards/review-gate.md for the philosophy and
scope of this gate.

On completion:
- Run full RTL suite — all must pass
- Run full E2E suite — log results
- Report summary to user

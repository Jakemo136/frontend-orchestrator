# Dependency Resolver Subagent

Receives: COMPONENT_INVENTORY.md content, optional page filter

Produces a wave plan:
1. Parse all components and their dependency lists
2. Assign Wave 0 to components with no dependencies
3. Assign Wave N to components whose dependencies are
   all in waves < N
4. Detect circular dependencies — report as errors,
   do not assign to any wave
5. Within each wave, sort by complexity ascending
   (low before high)
6. Write plan to /docs/BUILD_PLAN.md
7. Return wave plan to orchestrator

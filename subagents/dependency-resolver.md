# Dependency Resolver Subagent

Receives: COMPONENT_INVENTORY.md content, optional page filter

Produces a wave plan:
1. Parse all components and their dependency lists
2. Assign Wave 0 to components with no dependencies
3. Assign Wave N to components whose dependencies are
   all in waves < N
4. Detect circular dependencies:
   - Report each cycle with the specific component chain
     (e.g., "Button -> Icon -> Button")
   - Mark cyclic components with "CIRCULAR" in BUILD_PLAN.md
   - Do not assign cyclic components to any wave
   - If cycles exist, add a ## Circular Dependencies section
     at the top of BUILD_PLAN.md listing all cycles
5. Within each wave, sort by complexity ascending
   (low before high)
6. Write plan to /docs/BUILD_PLAN.md with wave explanations:

   ## Wave 0 (Leaf components — no dependencies)
   - Button: no dependencies
   - Input: no dependencies

   ## Wave 1 (depends on Wave 0)
   - Form: depends on Button, Input
     Reason: needs Button and Input to be built first
7. Return wave plan to orchestrator

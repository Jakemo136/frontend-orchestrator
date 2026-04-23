---
description: Resolve component dependencies and group into build waves
---

# /build-pipeline:resolve-deps

Analyze component dependency graph and group components into build waves.

## Inputs

- `/docs/COMPONENT_INVENTORY.md` — list of all components with their dependencies

## Behavior

1. Read COMPONENT_INVENTORY.md
2. Analyze the dependency graph:
   - Wave 0: components with no dependencies
   - Wave N: components whose dependencies are all in waves 0 through N-1
3. Detect circular dependencies:
   - If any circular dependency exists, flag it and stop
4. Group components by wave
5. Write BUILD_PLAN.md with the complete wave structure:
   - One section per wave (## Wave 0, ## Wave 1, etc.)
   - List components under each wave as bullet points
   - Include a summary line: "Wave N: M components"
6. Log results to BUILD_STATUS.md

## Expected Outputs

- `/docs/BUILD_PLAN.md` — markdown file with wave structure:
  ```
  # Build Plan
  
  ## Wave 0
  - Component1
  - Component2
  
  ## Wave 1
  - Component3
  - Component4
  ```

## Success Criteria

- BUILD_PLAN.md exists
- All components from COMPONENT_INVENTORY.md appear in exactly one wave
- No circular dependencies detected
- Waves are sequential (wave 0, then 1, then 2, etc.)
- All dependencies for wave N are satisfied by waves 0...N-1

## Failure Criteria

- COMPONENT_INVENTORY.md missing
- Circular dependencies detected in the graph
- BUILD_PLAN.md not generated
- Any component missing required dependencies

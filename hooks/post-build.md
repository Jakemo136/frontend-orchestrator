# Post-Build Hook

Runs automatically after any component-builder subagent
completes.

1. Run the test file for the component that was just built
2. If tests pass: confirm and continue
3. If tests fail:
   - Log failure to BUILD_STATUS.md
   - Block the wave-executor from marking this component done
   - Surface failure details

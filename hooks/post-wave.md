# Post-Wave Hook

Runs automatically after wave-executor confirms all
components in a wave are complete and RTL tests pass.

1. Invoke code-simplifier agent against all component files,
   test files, and CSS modules built or modified in this wave
   - Simplifier reviews for reuse, consistency, and
     maintainability across the wave as a batch
   - Apply suggested changes, re-run RTL tests to confirm
     no regressions
2. Invoke design-auditor subagent against all routes
   touched by components in this wave
3. If Critical violations found:
   - Fix before opening any PRs for this wave
   - Re-run design-auditor to confirm resolved
4. If Major violations found:
   - Note in each PR body for this wave
   - Do not block PRs
5. Attach screenshot paths for all four breakpoints 
   to each PR body
6. On first wave that passes audit clean:
   - Run /set-baseline to establish visual baseline
7. On subsequent waves:
   - Diff against baseline at all four breakpoints
   - Flag unexpected visual changes in PR body

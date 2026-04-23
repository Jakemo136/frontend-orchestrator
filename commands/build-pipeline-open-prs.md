---
description: Create branches and open pull requests for a build wave
---

# /build-pipeline:open-prs --wave N

Create git branches and open pull requests for all components in the specified build wave.

## Inputs

- `--wave N` — wave number (0-indexed)
- `/docs/BUILD_PLAN.md` — build plan with wave structure
- `.orchestrator/wave-plan.json` — parsed wave data (if available)

## Behavior

1. Read wave N from BUILD_PLAN.md (or wave-plan.json)
2. For each component in the wave:
   - Create a feature branch: `feat/[ComponentName]` (kebab-case)
   - Create an initial commit with component scaffold
3. Open a pull request for each branch:
   - Title: `feat: implement [ComponentName]`
   - Body includes:
     - "## Summary\n[Component description from COMPONENT_INVENTORY.md]"
     - "## Tests\n- RTL: tests to be written\n- E2E: flows to be validated"
     - "## Checklist\n- [ ] Tests passing\n- [ ] CSS Modules only\n- [ ] Tokens from tokens.css only\n- [ ] Loading, error, and empty states\n"
   - Label with `wave-N` for tracking
   - Set as draft if any CI checks are failing
4. Ensure CI is queued for each PR
5. Collect PR URLs in result artifacts

## Expected Outputs

Artifacts: array of PR URLs created
```
[
  "https://github.com/repo/pull/123",
  "https://github.com/repo/pull/124",
  "https://github.com/repo/pull/125"
]
```

## Success Criteria

- One branch created per component in the wave
- One PR opened per branch
- All PRs have wave-N label
- CI checks are queued (not yet passing — components don't exist yet)
- PR URLs are returned in result.artifacts

## Failure Criteria

- BUILD_PLAN.md missing or invalid
- Wave N not found in BUILD_PLAN.md
- Branch creation fails
- PR creation fails
- Invalid component names or branch conflicts

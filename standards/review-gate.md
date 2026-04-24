# Review Gate Standard

Feature-complete is not the same as shippable.

Tests passing proves the component does what its tests assert.
It does not prove the code is clean, consistent, simplifiable,
or free of latent issues. Code review and simplification are
part of the build cycle, not optional afterthoughts applied when
someone remembers.

## The rule

Every skill that produces code must pass through three gates
before it reports success or opens a PR:

1. **Tests gate** — RTL (and E2E where applicable) pass
2. **Review gate** — `frontend-orchestration:code-review`
   returns zero Critical or Major findings
3. **Simplify gate** — `frontend-orchestration:code-simplify`
   returns clean, or its proposed changes have been accepted
   and re-verified against the tests gate

If Review or Simplify returns findings, the skill loops back
to fix them and re-runs all gates. A skill only reports
"complete" when all three gates are clean on the same run.

## Where this applies

- `/build-component` — gates run per component
- `/build-page` — gates run at the end of each wave, against
  the set of files changed by that wave
- `/build-pipeline` — gates run at the end of each wave, same
  as `/build-page`

## Why per-wave, not only per-component

Per-component review (already baked into `/build-component`)
catches issues in isolation. Per-wave review catches emergent
issues across sibling components: inconsistent prop shapes,
duplicated helpers, divergent state patterns, and missed
opportunities to share a primitive. The two gates are
complementary — keep both.

## Philosophy

The point is not to be exhaustive. The point is that review
and simplification are part of the normal cost of building,
priced into the skill itself so the user never has to
remember to run them. If a finding is truly trivial, the
reviewer will mark it Minor and it won't block. If it's
Critical or Major, the skill deals with it before declaring
done.

This doc is the canonical reference. Project `CLAUDE.md`
files can point here rather than restating the philosophy.

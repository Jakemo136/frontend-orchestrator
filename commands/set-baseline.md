---
description: Promote current screenshots to visual regression baseline after design audit passes
---

# /set-baseline [route?]

Promote current screenshots to visual regression baseline.
Use after a design audit passes and you are satisfied
with the current visual state.

If route provided: baseline that route only.
If no route: baseline all routes.

Baselines all four breakpoints: 
mobile, tablet, desktop, lg-desktop.

Confirm with user before promoting — this overwrites
the previous baseline.

Uses screenshot-review MCP setBaseline method.

After baselining, write metadata to
screenshots/baseline/metadata.json:

```json
{
  "baselined_at": "ISO timestamp",
  "routes": {
    "[route]": {
      "baselined_at": "ISO timestamp",
      "component_hashes": {
        "[ComponentName]": "short file hash"
      }
    }
  }
}
```

On subsequent baselines, warn if any component file
has changed since the baseline was set:
"⚠️ [ComponentName] was modified since baseline was set.
Review screenshots before promoting."

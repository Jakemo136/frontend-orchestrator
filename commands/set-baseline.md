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

After baselining, the MCP server writes metadata to
screenshots/baseline/metadata.json:

```json
{
  "baselined_at": "ISO timestamp",
  "routes": {
    "[route]": {
      "baselined_at": "ISO timestamp",
      "breakpoints": ["mobile", "tablet", "desktop", "lgDesktop"]
    }
  }
}
```

On subsequent baselines, check git status for files in
the component directory related to this route. If any
component source files have been modified since the
baseline timestamp, warn:
"⚠️ Component files modified since last baseline.
Review screenshots before promoting."

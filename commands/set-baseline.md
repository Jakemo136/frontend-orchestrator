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

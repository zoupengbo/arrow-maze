---
name: arrow-maze-ui
description: Project-specific UI design and implementation guidance for the current Arrow Maze WeChat Mini Game. Use when Codex needs to design, refine, or implement UI for this project, including the start screen, top HUD, circular maze board, bottom hint bar, failure/revive overlays, button styling, Canvas layout fixes, visual consistency, and WeChat Mini Game Canvas UI issues. Do not use for pure gameplay logic, procedural maze generation, unrelated web UI, or non-WeChat-native app interfaces.
---

# Arrow Maze UI

Read the current UI implementation before making changes. Start with `js/app.js`, then read `js/config.js`, and read `js/levels.js` when the request touches maze readability or line layout.

Treat this skill as project-specific. Preserve the existing visual language and improve it iteratively instead of replacing it with a generic mobile game skin.

## Core workflow

1. Inspect the current Canvas drawing flow and identify which screen or state the user is talking about.
2. Keep all new UI compatible with the existing WeChat Mini Game Canvas approach unless the user explicitly asks to refactor the rendering architecture.
3. Define every UI change in four dimensions before implementing:
   - Visual style
   - State changes
   - Touch target
   - Draw order / layering
4. Prefer improving clarity and consistency over adding decorative detail.
5. After changes, verify that the UI still reads well on a small portrait screen.

## Project visual direction

Keep the current direction unless the user explicitly asks for a re-theme:

- Cool-toned background with soft atmospheric depth
- Light maze lines and panels over a darker field
- Accent colors only for success, warning, danger, and focus
- Rounded panels and a circular main board
- Minimal iconography with clear silhouette-first readability

Read [references/ui-rules.md](references/ui-rules.md) for detailed style rules.

## UI areas to prioritize

Handle requests with this priority order when multiple surfaces are involved:

1. Start screen
2. Top HUD
3. Circular maze board
4. Bottom hint / message bar
5. Failure and revive overlays

## Default review checklist

When the user asks to "optimize UI" or gives a vague UI request, review and improve these first:

- Readability
- Direction expression
- State feedback
- Density / crowding

## Maze-specific visual checks

Always check these before finalizing any board-related UI change:

- Arrows clearly express movement direction
- Barriers cannot be mistaken for arrows
- Lines do not create fake intersections
- Touch targets align with the visible lines
- Small-screen spacing remains readable

If the user says "make it closer to the screenshot", interpret that as:

- Cleaner linework
- Clearer direction arrows
- No false crossing illusion
- More balanced spacing and composition

## Boundaries

Do not use this skill for:

- Pure gameplay rules or combat logic
- Pure algorithm or generation work with no UI impact
- Generic DOM/React website styling
- Native app UI outside WeChat Mini Game Canvas

## References

- Use [references/ui-rules.md](references/ui-rules.md) for style and layout rules.
- Use [references/canvas-patterns.md](references/canvas-patterns.md) for Canvas implementation patterns and pitfalls.

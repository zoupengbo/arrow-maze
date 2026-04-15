# Canvas Patterns

## Render Order

Use this order for the playing screen:

1. Background gradient and atmosphere.
2. Board frame and subtle grid.
3. Static line bodies.
4. Moving line bodies.
5. Integrated line-head arrows.
6. HUD panels and controls.
7. Bottom hint/message bar.
8. Modal overlays.

Keep board geometry below HUD and bottom UI. Do not let controls overlap line touch areas.

## Wrapped Text

Use a Canvas text wrapping helper for user-facing copy that can exceed the available width.

Recommended behavior:

- Measure with `ctx.measureText`.
- Split Chinese text by character when needed.
- Limit line count.
- Keep line height explicit.
- Prefer rewriting long copy when wrapping still feels crowded.

Do not rely on `fillText` to clip or wrap automatically.

## Line And Arrow Drawing

For each line:

- Draw the body with stable `PATH_WIDTH`.
- Use rounded caps and joins for the body.
- Calculate the head from the current visible samples.
- Build the arrow head from the head point and a point behind the head along the actual visible path.
- Use the line's current state color for both body and head.

Avoid deriving arrow shape only from a configured exit direction if it can disagree with the final segment.

## Snake-Style Movement

Current movement uses a visible sample window along a travel path.

When editing UI around movement:

- Preserve the "body exits along itself" illusion.
- Treat moving lines as visually present but not blocking.
- Ensure active color does not obscure neighboring static lines.
- Keep the arrow head attached to the current moving head.

## Hit Testing

Touch detection should remain more forgiving than the visible stroke.

- Use a larger touch radius than line width.
- Ignore escaped or moving lines for new taps.
- Keep hit testing based on the line geometry the player sees.

## Validation Checklist

After UI edits, run or reason through:

- Syntax parse of `game.js` and `js/*.js`.
- Arrow direction matches the final line segment.
- First several levels have no segment intersections.
- Start screen and bottom bar text stay inside screen width.
- No draw method assumes `levelState` exists before a level loads.

## Polish Checklist

Before finalizing a UI pass, ask:

- Does the screen look intentional enough for a store screenshot?
- Does the player understand the next action within two seconds?
- Are success and failure states visually distinct without being noisy?
- Can a future ad/revive/share entry fit without breaking the layout?
- Does the UI still read clearly on a small phone?

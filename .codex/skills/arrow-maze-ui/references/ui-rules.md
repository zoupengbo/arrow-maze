# UI Rules

## Visual Baseline

Use the current project aesthetic as the default:

- Cool indigo/slate background.
- Dark translucent HUD and bottom panels.
- Pale line bodies with strong contrast on the board.
- Mint/green for active or successful motion.
- Coral/red for failed or blocked attempts.
- Rounded panels, soft board frame, and subtle grid texture.

Do not make the game look like a generic H5 landing page. Keep it game-like, compact, and Canvas-native.

## Commercial Quality Goals

- Make the first screen feel like a real published casual game, not a prototype.
- Use clear hierarchy: title, primary action, progress, and hint copy should each have a clear role.
- Keep the game board as the hero element; decorative UI should support the puzzle, not compete with it.
- Make failure and revive states feel helpful and recoverable, not punishing or noisy.
- Use repeatable component styling so future levels and features feel consistent.

## Layout

- Preserve the portrait layout: top HUD, board, bottom bar.
- Keep the board as the visual center.
- Keep top HUD text short and stable; avoid crowding the status bar.
- Keep the bottom bar high enough for two wrapped text lines.
- On narrow screens, reduce text length before reducing line readability.

## Text

Canvas text does not wrap automatically. Any variable or long Chinese copy must use a wrapping helper or a clipped safe region.

Check these text surfaces every time:

- Start screen instructions.
- Bottom message bar.
- Fail/revive overlay copy.
- Top HUD labels such as remaining count and timer.

Prefer short phrases:

- "点线头，全部移出。"
- "前方有线会被挡。"
- "全部清空才过关。"

## Board And Lines

- Lines must feel independent and should not visually cross.
- Keep enough spacing between neighboring bodies.
- Avoid line endpoints touching another line unless it is intentional and readable.
- Do not add standalone blockers; current blockers are other non-moving line bodies.
- Moving lines should look like they are leaving along their own body, not sliding as a rigid block.

## Arrow Head Rules

- The arrow is part of the line head.
- Do not draw a separate arrow icon on top of the line.
- Direction must follow the final visible segment of the line head.
- Arrow head should be short, solid, and readable at small sizes.
- Avoid V-shaped floating heads that look disconnected from the line body.

## Anti-Patterns

- No X-shaped blockers.
- No fake intersections.
- No arrow heads that point away from the line's final segment.
- No text that extends beyond the screen edge.
- No decorative glow that blurs line readability.
- No random visual elements that do not support player understanding, progression, or commercial polish.

# Canvas Patterns

## Read order

Prefer this render order for game screens:

1. Background and atmosphere
2. Board frame / board backdrop
3. Maze lines
4. Direction arrows
5. Barriers / blockers
6. Moving player marker
7. HUD panels and controls
8. Overlays and modal states

## Common drawing patterns

### HUD

- Draw HUD panels before text
- Keep icon buttons visually aligned and consistently sized
- Reserve the strongest contrast for the current level, health, and primary action

### Maze lines

- Use rounded line caps and joins
- Keep line width stable within the same board
- Prefer spacing fixes over thicker lines when readability drops

### Direction arrows

- Use a visible shaft plus head, not only a triangle
- Keep arrow size proportional to line spacing
- Ensure arrows do not blend into barrier marks

### Barriers

- Draw barriers perpendicular to the line direction when possible
- Use a compact stop-mark silhouette
- Keep the barrier legible without making it look like a collectible or arrow

### Overlays

- Dim the background enough to separate the modal
- Preserve some board visibility so the player keeps context
- Keep primary and secondary modal actions visually distinct

## Touch targets

- Touch detection should follow the visible geometry closely
- If the visible line is thin, use a wider invisible touch radius
- Avoid controls whose hit areas overlap the board unintentionally

## State handling

For every UI element, define:

- Default state
- Active or pressed state
- Disabled or unavailable state
- Success / error feedback if relevant

Avoid adding new UI without clarifying those states first.

## WeChat Mini Game Canvas pitfalls

- Re-check readability on small portrait screens
- Avoid text-heavy panels
- Avoid relying on browser DOM layout assumptions
- Keep rendering logic explicit and deterministic
- When changing icons or symbols, test that they still read correctly on lower-density screens

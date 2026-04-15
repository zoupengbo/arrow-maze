# UI Rules

## Visual baseline

Use the current project aesthetic as the default baseline:

- Cool indigo or slate background tones
- Light maze lines and light panel text
- Accent colors reserved for success, warning, error, and focus states
- Rounded cards, rounded buttons, and a circular primary play area
- Simple, readable shapes over decorative flourishes

## Color usage

- Primary surfaces: dark blue-gray panels
- Primary content: near-white text and line work
- Success / correct route: mint or soft green
- Warning / attention: warm coral or orange-red
- Focus / action buttons: brighter cyan or blue accent
- Keep accent colors sparse so game states remain legible

## Typography

- Favor short text strings and strong hierarchy
- Title text should be bold and highly readable
- HUD text should be compact and stable in width
- Bottom guidance text should be concise and never wrap into clutter

## Layout rules

- Preserve a clear separation between HUD, board, and bottom guidance
- Leave breathing room around the circular maze board
- Avoid putting controls too close to the maze edge
- Ensure touchable controls have visibly comfortable hit areas
- Avoid crowding the bottom bar with too many simultaneous actions

## Buttons and panels

- Use rounded rectangles for utility buttons and overlays
- Match button emphasis to action importance
- Keep destructive or risky actions visually distinct
- Ensure overlays remain readable above the board without fully obscuring the game identity

## Maze readability rules

- Paths must remain visually independent
- Do not create fake crossings or pseudo-intersections
- Keep enough spacing between neighboring lines to preserve separation
- Arrows must remain distinct from both line bodies and barriers
- If a line is blocked, the barrier should read as a stop marker, not a direction marker

## Visual anti-patterns

- Do not draw barriers as X marks
- Do not allow line joints to look like crossovers
- Do not make arrow shafts disappear into the path body
- Do not overuse glowing effects that blur path readability
- Do not introduce webpage-like UI patterns that clash with the current Canvas game look

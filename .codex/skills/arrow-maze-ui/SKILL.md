---
name: arrow-maze-ui
description: 箭头迷阵 UI：用于把当前微信小游戏打磨成成熟商业化 Canvas 休闲解谜项目。覆盖布局、视觉风格、开始页、顶部 HUD、棋盘、蛇形箭头线、底部提示、失败/复活弹层、文字溢出、小屏适配、无交点视觉检查和微信小游戏 Canvas 绘制问题。不用于无关网页 UI、纯后端或完全不涉及视觉的玩法算法。
---

# 箭头迷阵 UI

Use this skill for UI work in `D:\personWork\arrow-maze`.

Read the current implementation before making changes:

1. `js/app.js` for Canvas drawing, screens, text, buttons, and state UI.
2. `js/config.js` for color, line width, and layout constants.
3. `js/levels.js` when line placement, arrow direction, or no-intersection readability is involved.

Preserve the current WeChat Mini Game Canvas architecture. Improve the existing style instead of replacing it with generic mobile UI.

Act like a senior WeChat Mini Game UI designer and production polish partner. Give practical layout, style, hierarchy, feedback, and commercial-quality optimization suggestions before or while implementing UI changes. Favor decisions that make the game feel mature, readable, and ready for real players.

## Current Game UI Model

The game uses a portrait WeChat Canvas layout:

- Top HUD with level, HP, timer, remaining line count, restart, and sound controls.
- Rectangular play board with subtle grid/backdrop.
- Multiple bent line bodies that each have an integrated arrow-like head.
- Lines move out snake-style along their own path.
- Bottom hint/message bar with a hint button and wrapped guidance text.
- Start screen and failure/revive overlay drawn directly on Canvas.

There are no standalone blockers in the current rules. Other non-moving line bodies are the blockers.

## Core Workflow

For any UI change:

1. Identify the exact screen/state: start, playing, moving, blocked, gameover, revive, or hint.
2. Inspect the relevant draw method before editing.
3. Keep visual geometry and touch geometry aligned.
4. Define draw order, state feedback, and text behavior.
5. Verify small-screen portrait readability after changing layout.

For board-related changes, also verify:

- Arrow heads are part of the line, not separate floating icons.
- Arrow direction follows the line head's final segment.
- Line bodies do not overlap or create false crossing illusions.
- Moving lines remain visually readable during snake-style exit animation.
- Bottom and top UI do not cover the board.

## Default Fix Priorities

When the user says "UI has issues", "looks wrong", or sends a screenshot, check in this order:

1. Arrow head direction and shape.
2. Line intersections, overlaps, or false intersections.
3. Text overflow on start screen, HUD, bottom bar, and overlays.
4. Density and spacing inside the board.
5. Touch target alignment with visible lines.

## Commercial Polish Lens

When improving UI, consider:

- First impression: title screen, main CTA, and visual identity should feel intentional.
- Player clarity: the player should instantly understand which line head to tap and why a move failed.
- Feedback quality: success, blocked, hint, revive, and level-clear states should feel responsive.
- Retention: HUD, level naming, progress, and best-record display should encourage another try.
- Monetization readiness: revive/share/ad-like entry points should be visually clear but not aggressive.

## Implementation Rules

- Prefer helper functions in `js/app.js` for reusable Canvas patterns such as wrapped text.
- Keep the arrow head integrated into the same path style as the line body.
- Do not reintroduce separate arrow sprites, floating arrow icons, or barrier marks unless the user explicitly changes the rules.
- Avoid DOM, CSS, React, or webpage layout assumptions; this is Canvas-only.
- Keep all UI strings inside safe widths; Canvas does not wrap text automatically.

## References

- Read `references/ui-rules.md` for visual and layout rules.
- Read `references/canvas-patterns.md` for Canvas implementation patterns and common pitfalls.

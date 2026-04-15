"use strict";

const GRID_SIZE = 14;
const PATH_WIDTH = 5;
const TOUCH_RADIUS = 16;
const PLAYER_RADIUS = 7;
const MAX_HP = 3;

const COLORS = {
  bgTop: "#66749d",
  bgBottom: "#252b49",
  panel: "rgba(29, 33, 61, 0.88)",
  panelStrong: "rgba(19, 23, 46, 0.94)",
  panelAlt: "#6672a5",
  panelSoft: "rgba(255,255,255,0.08)",
  line: "#f8f8ff",
  lineGhost: "rgba(255,255,255,0.18)",
  active: "#73f0c8",
  blocked: "#ff767c",
  player: "#ffd36f",
  text: "#ffffff",
  subText: "rgba(255,255,255,0.72)",
  success: "#8df3c7",
  accent: "#78e7ff",
  accentSoft: "#9eb7ff",
  gold: "#ffd36f",
  boardRing: "rgba(255,255,255,0.11)",
  boardGrid: "rgba(255,255,255,0.052)",
  glow: "rgba(120,231,255,0.16)",
  overlay: "rgba(12, 12, 18, 0.42)"
};

const LEVEL_CONFIGS = [
  { name: "简单", pathCount: 8, turnsMin: 5, turnsMax: 7, hintCount: 3, moveSpeed: 230, timeLimitSeconds: 240 },
  { name: "普通", pathCount: 11, turnsMin: 6, turnsMax: 8, hintCount: 2, moveSpeed: 240, timeLimitSeconds: 300 },
  { name: "困难", pathCount: 14, turnsMin: 8, turnsMax: 10, hintCount: 1, moveSpeed: 252, timeLimitSeconds: 420 }
];

module.exports = {
  GRID_SIZE,
  PATH_WIDTH,
  TOUCH_RADIUS,
  PLAYER_RADIUS,
  MAX_HP,
  COLORS,
  LEVEL_CONFIGS
};

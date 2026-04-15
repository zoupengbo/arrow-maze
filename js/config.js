"use strict";

const GRID_SIZE = 14;
const PATH_WIDTH = 5;
const TOUCH_RADIUS = 16;
const PLAYER_RADIUS = 7;
const MAX_HP = 3;

const COLORS = {
  bgTop: "#5b5d84",
  bgBottom: "#414361",
  panel: "#2e304a",
  panelAlt: "#56608a",
  panelSoft: "rgba(255,255,255,0.08)",
  line: "#f2f2f8",
  active: "#7ff0cd",
  blocked: "#ff7d7f",
  player: "#ffd36f",
  text: "#ffffff",
  subText: "rgba(255,255,255,0.72)",
  success: "#8df3c7",
  accent: "#7ee0ff",
  accentSoft: "#9eb7ff",
  boardRing: "rgba(255,255,255,0.08)",
  boardGrid: "rgba(255,255,255,0.045)",
  glow: "rgba(126,224,255,0.12)",
  overlay: "rgba(12, 12, 18, 0.42)"
};

const LEVEL_CONFIGS = [
  { name: "初探", pathCount: 10, turnsMin: 6, turnsMax: 7, hintCount: 3, moveSpeed: 144 },
  { name: "回折", pathCount: 11, turnsMin: 6, turnsMax: 8, hintCount: 3, moveSpeed: 148 },
  { name: "穿行", pathCount: 12, turnsMin: 7, turnsMax: 8, hintCount: 2, moveSpeed: 152 },
  { name: "密阵", pathCount: 13, turnsMin: 7, turnsMax: 9, hintCount: 2, moveSpeed: 156 },
  { name: "连锁", pathCount: 14, turnsMin: 8, turnsMax: 9, hintCount: 2, moveSpeed: 160 },
  { name: "终局", pathCount: 15, turnsMin: 8, turnsMax: 10, hintCount: 1, moveSpeed: 164 }
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

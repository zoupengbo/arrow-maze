"use strict";

const { GRID_SIZE, LEVEL_CONFIGS } = require("./config");
const { clamp, buildPathMeta, samplePath, RNG } = require("./utils");

const MOVE_DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 }
};

const HANDCRAFTED_LEVELS = [
  {
    name: "新手阵",
    hintCount: 3,
    moveSpeed: 228,
    paths: [
      { cells: [[4, 5], [4, 10], [8, 10], [8, 14]], exit: "bottom" },
      { cells: [[8, 3], [8, 7], [12, 7], [12, 3]], exit: "top" },
      { cells: [[13, 5], [13, 9], [16, 9], [16, 13]], exit: "right" },
      { cells: [[15, 3], [15, 7], [18, 7]], exit: "right" },
      { cells: [[5, 12], [5, 16], [9, 16], [9, 19]], exit: "bottom" },
      { cells: [[11, 12], [11, 16], [15, 16], [15, 19]], exit: "bottom" },
      { cells: [[5, 8], [7, 8], [7, 5]], exit: "top" },
      { cells: [[14, 14], [18, 14]], exit: "right" }
    ]
  }
];

function getLevelConfig(levelIndex) {
  return LEVEL_CONFIGS[(levelIndex - 1) % LEVEL_CONFIGS.length];
}

function cellKey(x, y) {
  return `${x},${y}`;
}

function segmentCells(fromCell, toCell) {
  const cells = [];
  const dx = Math.sign(toCell[0] - fromCell[0]);
  const dy = Math.sign(toCell[1] - fromCell[1]);
  const steps = Math.max(Math.abs(toCell[0] - fromCell[0]), Math.abs(toCell[1] - fromCell[1]));
  for (let i = 0; i <= steps; i += 1) {
    cells.push([fromCell[0] + dx * i, fromCell[1] + dy * i]);
  }
  return cells;
}

function reserveCells(occupied, cells, cols, rows) {
  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i];
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const x = cell[0] + dx;
        const y = cell[1] + dy;
        if (x >= 1 && x <= cols - 1 && y >= 1 && y <= rows - 1) {
          occupied.add(cellKey(x, y));
        }
      }
    }
  }
}

function boardForLayout(layout) {
  const y = Math.max(126, (layout.topHudBottom || 102) + 24);
  const bottomReserve = 164;
  return {
    x: 28,
    y,
    width: layout.width - 56,
    height: Math.min(400, Math.max(320, layout.height - y - bottomReserve))
  };
}

function toPoint(board, cell) {
  return {
    x: board.x + cell[0] * GRID_SIZE + GRID_SIZE / 2,
    y: board.y + cell[1] * GRID_SIZE + GRID_SIZE / 2
  };
}

function getHeadDirection(points, exit) {
  const fallback = MOVE_DIRS[exit];
  if (points.length < 2) {
    return { x: fallback.x, y: fallback.y };
  }

  const head = points[points.length - 1];
  const prev = points[points.length - 2];
  const dx = head.x - prev.x;
  const dy = head.y - prev.y;

  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) {
    return { x: Math.sign(dx), y: 0 };
  }
  if (dy !== 0) {
    return { x: 0, y: Math.sign(dy) };
  }

  return { x: fallback.x, y: fallback.y };
}

function createPath(id, points, exit) {
  const dir = getHeadDirection(points, exit);
  const meta = buildPathMeta(points);
  return {
    id,
    points,
    samples: samplePath(points, 4),
    meta,
    dir: { x: dir.x, y: dir.y },
    escaped: false,
    moving: false,
    progress: 0,
    isClear: false,
    headExitDistance: 0,
    runDistance: 0,
    travelSamples: null,
    visibleSampleCount: 0,
    escapeDistance: 0,
    blockPoint: null
  };
}

function createHandcraftedLevel(levelIndex, layout) {
  const level = HANDCRAFTED_LEVELS[levelIndex - 1];
  if (!level) {
    return null;
  }

  const cycleConfig = getLevelConfig(levelIndex);
  const board = boardForLayout(layout);
  const paths = level.paths.map((pathData, index) => {
    const points = pathData.cells.map((cell) => toPoint(board, cell));
    return createPath(index, points, pathData.exit);
  });

  return {
    config: {
      name: cycleConfig.name,
      hintCount: cycleConfig.hintCount,
      moveSpeed: cycleConfig.moveSpeed,
      timeLimitSeconds: cycleConfig.timeLimitSeconds
    },
    board,
    paths,
    mode: "handcrafted"
  };
}

function buildDensePath(rng, board, config) {
  const occupied = config.occupied;
  const cols = Math.floor(board.width / GRID_SIZE);
  const rows = Math.floor(board.height / GRID_SIZE);
  let cell = {
    x: rng.int(2, cols - 4),
    y: rng.int(2, rows - 4)
  };
  const points = [{
    x: board.x + cell.x * GRID_SIZE + GRID_SIZE / 2,
    y: board.y + cell.y * GRID_SIZE + GRID_SIZE / 2
  }];
  const visited = new Set([cellKey(cell.x, cell.y)]);
  const turns = rng.int(config.turnsMin, config.turnsMax);
  let axis = rng.pick(["horizontal", "vertical"]);

  for (let stepIndex = 0; stepIndex < turns; stepIndex += 1) {
    const candidates = axis === "horizontal"
      ? [{ x: 1, y: 0 }, { x: -1, y: 0 }]
      : [{ x: 0, y: 1 }, { x: 0, y: -1 }];

    const sorted = candidates
      .map((dir) => {
        let bestLength = 0;
        for (let length = 1; length <= 4; length += 1) {
          const nx = cell.x + dir.x * length;
          const ny = cell.y + dir.y * length;
          if (nx < 1 || nx > cols - 2 || ny < 1 || ny > rows - 2) {
            break;
          }
          if (visited.has(cellKey(nx, ny))) {
            break;
          }
          if (occupied && occupied.has(cellKey(nx, ny))) {
            break;
          }
          bestLength = length;
        }
        const preview = { x: cell.x + dir.x * bestLength, y: cell.y + dir.y * bestLength };
        const outward = Math.min(preview.x, cols - preview.x, preview.y, rows - preview.y);
        return { dir, bestLength, outward };
      })
      .filter((item) => item.bestLength > 0)
      .sort((a, b) => a.outward - b.outward + rng.range(-0.4, 0.4));

    if (!sorted.length) {
      axis = axis === "horizontal" ? "vertical" : "horizontal";
      continue;
    }

    const chosen = sorted[0];
    const length = clamp(chosen.bestLength - rng.int(0, 1), 1, chosen.bestLength);
    cell = { x: cell.x + chosen.dir.x * length, y: cell.y + chosen.dir.y * length };

    for (let i = 0; i <= length; i += 1) {
      visited.add(cellKey(cell.x - chosen.dir.x * (length - i), cell.y - chosen.dir.y * (length - i)));
    }

    points.push({
      x: board.x + cell.x * GRID_SIZE + GRID_SIZE / 2,
      y: board.y + cell.y * GRID_SIZE + GRID_SIZE / 2
    });
    axis = axis === "horizontal" ? "vertical" : "horizontal";
  }

  const distancesToEdge = [
    { dir: { x: -1, y: 0 }, name: "left", dist: cell.x },
    { dir: { x: 1, y: 0 }, name: "right", dist: cols - cell.x },
    { dir: { x: 0, y: -1 }, name: "top", dist: cell.y },
    { dir: { x: 0, y: 1 }, name: "bottom", dist: rows - cell.y }
  ].sort((a, b) => a.dist - b.dist);

  const exitDir = distancesToEdge[0].dir;
  const exitName = distancesToEdge[0].name;
  let lastInside = { x: cell.x, y: cell.y };
  while (
    lastInside.x + exitDir.x >= 1 &&
    lastInside.x + exitDir.x <= cols - 1 &&
    lastInside.y + exitDir.y >= 1 &&
    lastInside.y + exitDir.y <= rows - 1 &&
    !(occupied && occupied.has(cellKey(lastInside.x + exitDir.x, lastInside.y + exitDir.y)))
  ) {
    lastInside = { x: lastInside.x + exitDir.x, y: lastInside.y + exitDir.y };
  }

  if (lastInside.x !== cell.x || lastInside.y !== cell.y) {
    points.push({
      x: board.x + lastInside.x * GRID_SIZE + GRID_SIZE / 2,
      y: board.y + lastInside.y * GRID_SIZE + GRID_SIZE / 2
    });
  }

  return { points, exit: exitName };
}

function createProceduralLevel(levelIndex, layout) {
  const baseConfig = getLevelConfig(levelIndex);
  const config = {
    name: baseConfig.name,
    pathCount: baseConfig.pathCount,
    turnsMin: baseConfig.turnsMin,
    turnsMax: baseConfig.turnsMax,
    hintCount: baseConfig.hintCount,
    moveSpeed: Math.max(220, baseConfig.moveSpeed + 78),
    timeLimitSeconds: baseConfig.timeLimitSeconds,
    occupied: new Set()
  };
  const rng = new RNG(7001 + levelIndex * 131);
  const board = boardForLayout(layout);
  const paths = [];
  const cols = Math.floor(board.width / GRID_SIZE);
  const rows = Math.floor(board.height / GRID_SIZE);

  for (let i = 0; i < config.pathCount; i += 1) {
    let pathData = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const candidate = buildDensePath(rng, board, config);
      if (candidate.points.length >= 2) {
        pathData = candidate;
        break;
      }
    }
    if (!pathData) {
      continue;
    }

    paths.push(createPath(paths.length, pathData.points, pathData.exit));

    for (let j = 0; j < pathData.points.length - 1; j += 1) {
      const from = [
        Math.round((pathData.points[j].x - board.x - GRID_SIZE / 2) / GRID_SIZE),
        Math.round((pathData.points[j].y - board.y - GRID_SIZE / 2) / GRID_SIZE)
      ];
      const to = [
        Math.round((pathData.points[j + 1].x - board.x - GRID_SIZE / 2) / GRID_SIZE),
        Math.round((pathData.points[j + 1].y - board.y - GRID_SIZE / 2) / GRID_SIZE)
      ];
      const cells = segmentCells(from, to);
      reserveCells(config.occupied, cells, cols, rows);
    }
  }

  return {
    config: {
      name: config.name,
      hintCount: config.hintCount,
      moveSpeed: config.moveSpeed,
      timeLimitSeconds: config.timeLimitSeconds
    },
    board,
    paths,
    mode: "procedural"
  };
}

function createLevel(levelIndex, layout) {
  return createHandcraftedLevel(levelIndex, layout) || createProceduralLevel(levelIndex, layout);
}

module.exports = {
  createLevel,
  HANDCRAFTED_LEVELS
};

"use strict";

const {
  PATH_WIDTH,
  TOUCH_RADIUS,
  MAX_HP,
  COLORS
} = require("./config");
const {
  clamp,
  pointToSegmentDistance,
  samplePath
} = require("./utils");
const { SoundManager } = require("./sound");
const { createLevel, HANDCRAFTED_LEVELS } = require("./levels");

const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
const pixelRatio = windowInfo.pixelRatio || 1;
const screenWidth = windowInfo.windowWidth;
const screenHeight = windowInfo.windowHeight;
const canvas = wx.createCanvas();
canvas.width = screenWidth * pixelRatio;
canvas.height = screenHeight * pixelRatio;
const ctx = canvas.getContext("2d");
ctx.scale(pixelRatio, pixelRatio);

const raf = typeof requestAnimationFrame === "function"
  ? requestAnimationFrame
  : (cb) => setTimeout(() => cb(Date.now()), 16);
const SAMPLE_STEP = 4;

function roundedRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

class ArrowMazeGame {
  constructor() {
    this.layout = { width: screenWidth, height: screenHeight };
    this.sound = new SoundManager();
    this.state = "start";
    this.level = 1;
    this.hp = MAX_HP;
    this.bestLevel = this.loadBestLevel();
    this.hintCount = 0;
    this.reviveUsed = false;
    this.levelState = null;
    this.message = "点击开始，把所有线都移出屏幕。";
    this.flashTimer = 0;
    this.failedPathId = -1;
    this.hintPathId = -1;
    this.levelClearTimer = 0;
    this.elapsedTime = 0;
    this.lastTime = 0;
    this.buttons = this.createButtons();

    if (wx.showShareMenu) {
      try {
        wx.showShareMenu({ menus: ["shareAppMessage", "shareTimeline"] });
      } catch (error) {
      }
    }

    this.bindInput();
    this.loop = this.loop.bind(this);
    raf(this.loop);
  }

  createButtons() {
    return {
      sound: { x: 66, y: 22, w: 46, h: 38 },
      titleStart: { x: 54, y: screenHeight - 204, w: screenWidth - 108, h: 50 },
      titleContinue: { x: 54, y: screenHeight - 142, w: screenWidth - 108, h: 46 },
      restart: { x: 14, y: 22, w: 44, h: 38 },
      hint: { x: 18, y: screenHeight - 74, w: 84, h: 42 },
      revive: { x: 48, y: screenHeight / 2 + 18, w: screenWidth - 96, h: 44 },
      retry: { x: 48, y: screenHeight / 2 + 74, w: screenWidth - 96, h: 44 }
    };
  }

  loadBestLevel() {
    if (!wx.getStorageSync) {
      return 1;
    }
    try {
      return Math.max(1, Number(wx.getStorageSync("arrow_maze_best_level")) || 1);
    } catch (error) {
      return 1;
    }
  }

  saveBestLevel() {
    if (!wx.setStorageSync) {
      return;
    }
    try {
      wx.setStorageSync("arrow_maze_best_level", this.bestLevel);
    } catch (error) {
    }
  }

  bindInput() {
    wx.onTouchStart((event) => {
      const touch = event.touches && event.touches[0];
      if (!touch) {
        return;
      }
      this.sound.unlock();
      this.handleTap(touch.clientX, touch.clientY);
    });
  }

  startGame() {
    this.level = 1;
    this.hp = MAX_HP;
    this.reviveUsed = false;
    this.elapsedTime = 0;
    this.state = "playing";
    this.loadLevel();
    this.sound.play("button");
  }

  continueFromBest() {
    this.level = this.bestLevel;
    this.hp = MAX_HP;
    this.reviveUsed = false;
    this.elapsedTime = 0;
    this.state = "playing";
    this.loadLevel();
    this.sound.play("button");
  }

  loadLevel() {
    this.levelState = createLevel(this.level, this.layout);
    this.hintCount = this.levelState.config.hintCount;
    this.failedPathId = -1;
    this.hintPathId = -1;
    this.flashTimer = 0;
    this.levelClearTimer = 0;
    this.refreshMovablePaths();
    this.message = this.levelState.mode === "handcrafted"
      ? "点击箭头所在的线，把所有线一条条滑出屏幕。"
      : "先移走外层线，给里面的线腾出出路。";
  }

  restartRun() {
    this.level = 1;
    this.hp = MAX_HP;
    this.reviveUsed = false;
    this.elapsedTime = 0;
    this.state = "playing";
    this.loadLevel();
    this.sound.play("button");
  }

  pointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  getRemainingCount() {
    let count = 0;
    for (let i = 0; i < this.levelState.paths.length; i += 1) {
      if (!this.levelState.paths[i].escaped) {
        count += 1;
      }
    }
    return count;
  }

  getHeadOutsideDistance(path) {
    const head = path.points[path.points.length - 1];
    const padding = 56;
    if (path.dir.x > 0) {
      return this.layout.width + padding - head.x;
    }
    if (path.dir.x < 0) {
      return head.x + padding;
    }
    if (path.dir.y > 0) {
      return this.layout.height + padding - head.y;
    }
    return head.y + padding;
  }

  buildTravelSamples(path) {
    const head = path.points[path.points.length - 1];
    const extensionEnd = {
      x: head.x + path.dir.x * path.runDistance,
      y: head.y + path.dir.y * path.runDistance
    };
    const extensionSamples = samplePath([head, extensionEnd], SAMPLE_STEP);
    return path.samples.concat(extensionSamples.slice(1));
  }

  getVisibleSamples(path) {
    if (!path.moving) {
      return path.samples;
    }

    const maxOffset = Math.max(0, path.travelSamples.length - path.visibleSampleCount);
    const offset = Math.min(maxOffset, Math.floor(path.progress / SAMPLE_STEP));
    return path.travelSamples.slice(offset, offset + path.visibleSampleCount);
  }

  getFrontSamples(path) {
    const threshold = PATH_WIDTH + 2;
    let edge = 0;

    if (path.dir.x > 0) {
      edge = Math.max(...path.samples.map((point) => point.x));
      return path.samples.filter((point) => Math.abs(point.x - edge) <= threshold);
    }
    if (path.dir.x < 0) {
      edge = Math.min(...path.samples.map((point) => point.x));
      return path.samples.filter((point) => Math.abs(point.x - edge) <= threshold);
    }
    if (path.dir.y > 0) {
      edge = Math.max(...path.samples.map((point) => point.y));
      return path.samples.filter((point) => Math.abs(point.y - edge) <= threshold);
    }

    edge = Math.min(...path.samples.map((point) => point.y));
    return path.samples.filter((point) => Math.abs(point.y - edge) <= threshold);
  }

  findBlockingPoint(path, maxDistance) {
    const threshold = PATH_WIDTH + 1.5;
    const step = 6;
    const frontSamples = this.getFrontSamples(path);

    for (let distance = step; distance < maxDistance; distance += step) {
      for (let s = 0; s < frontSamples.length; s += 1) {
        const movedPoint = {
          x: frontSamples[s].x + path.dir.x * distance,
          y: frontSamples[s].y + path.dir.y * distance
        };

        for (let i = 0; i < this.levelState.paths.length; i += 1) {
          const other = this.levelState.paths[i];
          if (other.id === path.id || other.escaped || other.moving) {
            continue;
          }

          for (let seg = 0; seg < other.points.length - 1; seg += 1) {
            if (pointToSegmentDistance(movedPoint, other.points[seg], other.points[seg + 1]) <= threshold) {
              return movedPoint;
            }
          }
        }
      }
    }

    return null;
  }

  refreshMovablePaths() {
    for (let i = 0; i < this.levelState.paths.length; i += 1) {
      const path = this.levelState.paths[i];
      if (path.escaped) {
        path.isClear = false;
        path.moving = false;
        path.progress = 0;
        path.escapeDistance = 0;
        path.blockPoint = null;
        continue;
      }
      if (path.moving) {
        path.isClear = false;
        path.blockPoint = null;
        continue;
      }

      path.headExitDistance = this.getHeadOutsideDistance(path);
      path.runDistance = path.meta.total + path.headExitDistance;
      path.travelSamples = this.buildTravelSamples(path);
      path.visibleSampleCount = path.samples.length;
      path.escapeDistance = path.headExitDistance;
      path.blockPoint = this.findBlockingPoint(path, path.headExitDistance);
      path.isClear = !path.blockPoint;
    }
  }

  handleTap(x, y) {
    if (this.pointInRect(x, y, this.buttons.sound)) {
      this.sound.toggle();
      this.message = this.sound.enabled ? "音效已开启。" : "音效已关闭。";
      return;
    }

    if (this.state === "start") {
      if (this.pointInRect(x, y, this.buttons.titleStart)) {
        this.startGame();
        return;
      }
      if (this.bestLevel > 1 && this.pointInRect(x, y, this.buttons.titleContinue)) {
        this.continueFromBest();
      }
      return;
    }

    if (this.pointInRect(x, y, this.buttons.restart)) {
      this.restartRun();
      return;
    }

    if (this.state === "gameover") {
      if (!this.reviveUsed && this.pointInRect(x, y, this.buttons.revive)) {
        this.shareToRevive();
        return;
      }
      if (this.pointInRect(x, y, this.buttons.retry)) {
        this.restartRun();
      }
      return;
    }

    if (this.state !== "playing") {
      return;
    }

    if (this.pointInRect(x, y, this.buttons.hint)) {
      this.useHint();
      return;
    }

    if (this.levelClearTimer > 0) {
      return;
    }

    const path = this.findTouchedPath({ x, y });
    if (!path) {
      return;
    }
    this.beginRun(path);
  }

  useHint() {
    if (this.hintCount <= 0) {
      return;
    }

    const clearPath = this.levelState.paths.find((path) => !path.escaped && !path.moving && path.isClear);
    if (!clearPath) {
      this.message = "当前没有能直接滑出的线，先观察外层。";
      return;
    }

    this.hintCount -= 1;
    this.hintPathId = clearPath.id;
    this.flashTimer = 1.8;
    this.message = "提示已激活，亮色线就是当前可滑出的那条。";
    this.sound.play("button");
  }

  findTouchedPath(point) {
    let best = null;
    let bestDistance = TOUCH_RADIUS;

    for (let i = 0; i < this.levelState.paths.length; i += 1) {
      const path = this.levelState.paths[i];
      if (path.escaped || path.moving) {
        continue;
      }

      for (let j = 0; j < path.points.length - 1; j += 1) {
        const d = pointToSegmentDistance(point, path.points[j], path.points[j + 1]);
        if (d < bestDistance) {
          bestDistance = d;
          best = path;
        }
      }
    }

    return best;
  }

  beginRun(path) {
    this.failedPathId = -1;
    this.hintPathId = -1;

    if (path.escaped || path.moving) {
      return;
    }
    if (!path.isClear) {
      this.failPath(path);
      return;
    }

    path.moving = true;
    path.progress = 0;
    this.refreshMovablePaths();
    this.message = "整条线正在按箭头方向滑出...";
    this.sound.play("tap");
  }

  failPath(path) {
    this.hp -= 1;
    this.failedPathId = path.id;
    this.flashTimer = 0.72;
    this.sound.play("crash");

    if (this.hp <= 0) {
      this.state = "gameover";
      this.message = "三条命用完了，可以分享复活一次。";
      return;
    }

    this.message = "这条线前面被别的线挡住了，失去 1 条血。";
  }

  finishRun(path) {
    path.escaped = true;
    path.moving = false;
    path.progress = 0;
    this.failedPathId = -1;
    this.flashTimer = 0.45;
    this.sound.play("clear");

    this.refreshMovablePaths();
    const remaining = this.getRemainingCount();
    if (remaining === 0) {
      this.bestLevel = Math.max(this.bestLevel, this.level + 1);
      this.saveBestLevel();
      this.levelClearTimer = 0.82;
      this.message = "所有线都已移出屏幕，准备进入下一关。";
      return;
    }

    this.message = `成功移出 1 条线，还剩 ${remaining} 条。`;
  }

  shareToRevive() {
    if (this.reviveUsed) {
      return;
    }
    this.reviveUsed = true;

    const revive = () => {
      this.hp = 1;
      this.state = "playing";
      this.message = "复活成功，继续把剩下的线移出去。";
      this.sound.play("revive");
    };

    if (wx.shareAppMessage) {
      try {
        wx.shareAppMessage({
          title: "我在挑战这款箭头迷阵，帮我复活继续闯关！",
          imageUrl: "",
          query: `level=${this.level}`
        });
      } catch (error) {
      }
    }

    setTimeout(revive, 600);
  }

  update(dt) {
    if (this.state === "playing" && this.levelState) {
      this.elapsedTime += dt;
    }
    this.flashTimer = Math.max(0, this.flashTimer - dt);

    if (this.levelClearTimer > 0) {
      this.levelClearTimer = Math.max(0, this.levelClearTimer - dt);
      if (this.levelClearTimer === 0 && this.state === "playing") {
        this.level += 1;
        this.loadLevel();
      }
    }

    if (!this.levelState) {
      return;
    }

    const finished = [];
    for (let i = 0; i < this.levelState.paths.length; i += 1) {
      const path = this.levelState.paths[i];
      if (!path.moving) {
        continue;
      }

      path.progress += this.levelState.config.moveSpeed * dt;
      path.progress = Math.min(path.progress, path.runDistance);
      if (path.progress >= path.runDistance) {
        finished.push(path);
      }
    }

    for (let i = 0; i < finished.length; i += 1) {
      this.finishRun(finished[i]);
    }
  }

  drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, this.layout.height);
    gradient.addColorStop(0, COLORS.bgTop);
    gradient.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.layout.width, this.layout.height);

    ctx.fillStyle = "rgba(255,255,255,0.03)";
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.arc(
        this.layout.width * (0.18 + i * 0.18),
        this.layout.height * (0.18 + (i % 2) * 0.15),
        54 + i * 8,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  drawTopBar() {
    roundedRect(12, 16, this.layout.width - 24, 86, 22);
    ctx.fillStyle = COLORS.panel;
    ctx.fill();

    ctx.fillStyle = COLORS.panelAlt;
    roundedRect(this.buttons.restart.x, this.buttons.restart.y, this.buttons.restart.w, this.buttons.restart.h, 12);
    ctx.fill();
    roundedRect(this.buttons.sound.x, this.buttons.sound.y, this.buttons.sound.w, this.buttons.sound.h, 12);
    ctx.fill();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLORS.text;
    ctx.font = "20px sans-serif";
    ctx.fillText("↺", this.buttons.restart.x + this.buttons.restart.w / 2, this.buttons.restart.y + this.buttons.restart.h / 2 + 1);
    ctx.font = "15px sans-serif";
    ctx.fillText(this.sound.enabled ? "音" : "静", this.buttons.sound.x + this.buttons.sound.w / 2, this.buttons.sound.y + this.buttons.sound.h / 2);

    ctx.textBaseline = "top";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(`关卡 ${this.level}`, this.layout.width / 2, 20);
    ctx.font = "12px sans-serif";
    ctx.fillStyle = COLORS.subText;
    ctx.fillText(this.levelState.config.name, this.layout.width / 2, 47);

    ctx.textAlign = "right";
    ctx.font = "12px sans-serif";
    ctx.fillText(`剩余 ${this.getRemainingCount()} 条`, this.layout.width - 24, 24);
    ctx.fillText(`计时 ${Math.floor(this.elapsedTime)}s`, this.layout.width - 24, 44);

    ctx.textAlign = "center";
    ctx.font = "17px sans-serif";
    for (let i = 0; i < MAX_HP; i += 1) {
      ctx.fillStyle = i < this.hp ? "#ff6b7a" : "rgba(255,255,255,0.18)";
      ctx.fillText("♥", this.layout.width / 2 - 22 + i * 22, 69);
    }
  }

  drawBoardFrame() {
    const board = this.levelState.board;
    roundedRect(board.x - 8, board.y - 8, board.width + 16, board.height + 16, 28);
    ctx.fillStyle = COLORS.boardRing;
    ctx.fill();

    roundedRect(board.x, board.y, board.width, board.height, 24);
    const panelGradient = ctx.createLinearGradient(board.x, board.y, board.x + board.width, board.y + board.height);
    panelGradient.addColorStop(0, "rgba(255,255,255,0.05)");
    panelGradient.addColorStop(1, "rgba(255,255,255,0.015)");
    ctx.fillStyle = panelGradient;
    ctx.fill();

    ctx.save();
    roundedRect(board.x, board.y, board.width, board.height, 24);
    ctx.clip();

    ctx.strokeStyle = COLORS.boardGrid;
    ctx.lineWidth = 1;
    for (let x = board.x + 18; x < board.x + board.width; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, board.y + 14);
      ctx.lineTo(x, board.y + board.height - 14);
      ctx.stroke();
    }
    for (let y = board.y + 18; y < board.y + board.height; y += 28) {
      ctx.beginPath();
      ctx.moveTo(board.x + 14, y);
      ctx.lineTo(board.x + board.width - 14, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 2;
    roundedRect(board.x, board.y, board.width, board.height, 24);
    ctx.stroke();
  }

  drawPath(path) {
    if (path.escaped) {
      return;
    }

    const visibleSamples = this.getVisibleSamples(path);
    if (!visibleSamples.length) {
      return;
    }

    const isRunning = path.moving;
    const isFailed = this.failedPathId === path.id && this.flashTimer > 0;
    const isHinted = this.hintPathId === path.id && this.flashTimer > 0;
    const stroke = isRunning
      ? COLORS.active
      : isFailed
        ? COLORS.blocked
        : isHinted
          ? COLORS.success
          : COLORS.line;

    const head = visibleSamples[visibleSamples.length - 1];
    const normal = { x: -path.dir.y, y: path.dir.x };
    const headLength = Math.max(PATH_WIDTH * 2.3, 11);
    const headWidth = Math.max(PATH_WIDTH * 1.05, 5);
    const bodyEnd = {
      x: head.x - path.dir.x * headLength,
      y: head.y - path.dir.y * headLength
    };

    ctx.strokeStyle = stroke;
    ctx.fillStyle = stroke;
    ctx.lineWidth = PATH_WIDTH;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(visibleSamples[0].x, visibleSamples[0].y);
    for (let i = 1; i < visibleSamples.length - 1; i += 1) {
      ctx.lineTo(visibleSamples[i].x, visibleSamples[i].y);
    }
    if (visibleSamples.length > 1) {
      ctx.lineTo(bodyEnd.x, bodyEnd.y);
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(head.x, head.y);
    ctx.lineTo(
      bodyEnd.x + normal.x * headWidth,
      bodyEnd.y + normal.y * headWidth
    );
    ctx.lineTo(
      bodyEnd.x - normal.x * headWidth,
      bodyEnd.y - normal.y * headWidth
    );
    ctx.closePath();
    ctx.fill();
  }

  drawBoard() {
    this.drawBoardFrame();
    for (let i = 0; i < this.levelState.paths.length; i += 1) {
      this.drawPath(this.levelState.paths[i]);
    }
  }

  drawBottomBar() {
    const y = this.layout.height - 96;
    roundedRect(12, y, this.layout.width - 24, 70, 22);
    ctx.fillStyle = COLORS.panel;
    ctx.fill();

    roundedRect(this.buttons.hint.x, this.buttons.hint.y, this.buttons.hint.w, this.buttons.hint.h, 12);
    ctx.fillStyle = this.hintCount > 0 ? COLORS.panelAlt : COLORS.panelSoft;
    ctx.fill();

    ctx.fillStyle = COLORS.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText(`提示 ${this.hintCount}`, this.buttons.hint.x + this.buttons.hint.w / 2, this.buttons.hint.y + this.buttons.hint.h / 2);

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = "16px sans-serif";
    ctx.fillStyle = COLORS.text;
    ctx.fillText(this.message, 118, y + 12);
    ctx.font = "12px sans-serif";
    ctx.fillStyle = COLORS.subText;
    ctx.fillText("通关条件：把当前关卡里的所有线都移出屏幕。", 118, y + 40);
  }

  drawGameScreen() {
    this.drawTopBar();
    this.drawBoard();
    this.drawBottomBar();
  }

  drawButton(rect, text, fillStyle, textStyle) {
    roundedRect(rect.x, rect.y, rect.w, rect.h, 16);
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.fillStyle = textStyle || COLORS.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 17px sans-serif";
    ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2);
  }

  drawStartScreen() {
    ctx.fillStyle = COLORS.overlay;
    ctx.fillRect(0, 0, this.layout.width, this.layout.height);

    roundedRect(34, 98, this.layout.width - 68, 360, 28);
    ctx.fillStyle = COLORS.panel;
    ctx.fill();

    ctx.fillStyle = COLORS.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = "bold 34px sans-serif";
    ctx.fillText("箭头迷阵", this.layout.width / 2, 132);

    ctx.font = "16px sans-serif";
    ctx.fillStyle = COLORS.subText;
    ctx.fillText("点击箭头所在的线，整条线会按箭头方向整体滑出。", this.layout.width / 2, 188);
    ctx.fillText("前方被别的线身挡住会掉血，所有线都移出屏幕才过关。", this.layout.width / 2, 214);
    ctx.fillText(`前 ${HANDCRAFTED_LEVELS.length} 关为手工关卡，后续继续自动生成。`, this.layout.width / 2, 240);

    roundedRect(62, 282, this.layout.width - 124, 94, 20);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fill();
    ctx.font = "14px sans-serif";
    ctx.fillStyle = COLORS.subText;
    ctx.fillText(`最高记录：第 ${Math.max(1, this.bestLevel - 1)} 关`, this.layout.width / 2, 306);
    ctx.fillText("支持提示、音效和分享复活。", this.layout.width / 2, 332);

    this.drawButton(this.buttons.titleStart, "开始挑战", COLORS.accent, "#183346");
    if (this.bestLevel > 1) {
      this.drawButton(this.buttons.titleContinue, `从第 ${this.bestLevel} 关继续`, COLORS.panelAlt, COLORS.text);
    }
  }

  drawGameOver() {
    ctx.fillStyle = COLORS.overlay;
    ctx.fillRect(0, 0, this.layout.width, this.layout.height);

    roundedRect(36, this.layout.height / 2 - 128, this.layout.width - 72, 230, 26);
    ctx.fillStyle = COLORS.panel;
    ctx.fill();

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 28px sans-serif";
    ctx.fillText("挑战失败", this.layout.width / 2, this.layout.height / 2 - 92);

    ctx.font = "15px sans-serif";
    ctx.fillStyle = COLORS.subText;
    ctx.fillText(`本次止步第 ${this.level} 关`, this.layout.width / 2, this.layout.height / 2 - 46);
    ctx.fillText(`还有 ${this.getRemainingCount()} 条线未移出`, this.layout.width / 2, this.layout.height / 2 - 22);

    if (!this.reviveUsed) {
      this.drawButton(this.buttons.revive, "分享复活", COLORS.success, "#164336");
    } else {
      roundedRect(this.buttons.revive.x, this.buttons.revive.y, this.buttons.revive.w, this.buttons.revive.h, 16);
      ctx.fillStyle = COLORS.panelSoft;
      ctx.fill();
      ctx.fillStyle = COLORS.subText;
      ctx.textBaseline = "middle";
      ctx.fillText("本局已使用复活", this.layout.width / 2, this.buttons.revive.y + this.buttons.revive.h / 2);
    }
    this.drawButton(this.buttons.retry, "重新开始", COLORS.panelAlt, COLORS.text);
  }

  render() {
    this.drawBackground();
    if (this.state === "start" || !this.levelState) {
      this.drawStartScreen();
      return;
    }

    this.drawGameScreen();
    if (this.state === "gameover") {
      this.drawGameOver();
    }
  }

  loop(now) {
    if (!this.lastTime) {
      this.lastTime = now;
    }
    const dt = clamp((now - this.lastTime) / 1000, 0, 0.033);
    this.lastTime = now;
    this.update(dt);
    this.render();
    raf(this.loop);
  }
}

new ArrowMazeGame();

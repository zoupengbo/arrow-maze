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
let menuButtonRect = null;
try {
  menuButtonRect = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
} catch (error) {
  menuButtonRect = null;
}
const statusBarHeight = windowInfo.statusBarHeight || 0;
const safeTop = Math.max(statusBarHeight, menuButtonRect ? menuButtonRect.bottom : statusBarHeight);
const topHudY = Math.max(44, safeTop + 20);
const topHudHeight = 76;
const topHudBottom = topHudY + topHudHeight;
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

function drawWrappedText(text, x, y, maxWidth, lineHeight, maxLines) {
  const chars = String(text).split("");
  const lines = [];
  let line = "";

  for (let i = 0; i < chars.length; i += 1) {
    const next = line + chars[i];
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = chars[i];
      if (lines.length === maxLines) {
        break;
      }
    } else {
      line = next;
    }
  }

  if (line && lines.length < maxLines) {
    lines.push(line);
  }

  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], x, y + i * lineHeight);
  }
}

function drawSoftPanel(x, y, width, height, radius, fillStyle, shadowColor) {
  ctx.save();
  ctx.shadowColor = shadowColor || "rgba(0,0,0,0.2)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  roundedRect(x, y, width, height, radius);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.restore();

  roundedRect(x, y, width, height, radius);
  ctx.strokeStyle = "rgba(255,255,255,0.11)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawGradientButton(rect, text, fromColor, toColor, textStyle) {
  const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  gradient.addColorStop(0, fromColor);
  gradient.addColorStop(1, toColor);
  drawSoftPanel(rect.x, rect.y, rect.w, rect.h, 16, gradient, "rgba(0,0,0,0.24)");
  ctx.fillStyle = textStyle || "#173345";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 17px sans-serif";
  ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2);
}

function drawSmallBadge(x, y, width, text, fillStyle) {
  roundedRect(x, y, width, 24, 12);
  ctx.fillStyle = fillStyle || "rgba(255,255,255,0.09)";
  ctx.fill();
  ctx.fillStyle = COLORS.subText;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "11px sans-serif";
  ctx.fillText(text, x + width / 2, y + 12);
}

function drawGlassPanel(x, y, width, height, radius, alpha) {
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, `rgba(32, 40, 78, ${alpha || 0.78})`);
  gradient.addColorStop(0.56, `rgba(18, 24, 51, ${(alpha || 0.78) + 0.06})`);
  gradient.addColorStop(1, `rgba(11, 15, 34, ${(alpha || 0.78) + 0.03})`);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.22)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 7;
  roundedRect(x, y, width, height, radius);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();

  roundedRect(x, y, width, height, radius);
  ctx.strokeStyle = "rgba(255,255,255,0.105)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.save();
  roundedRect(x + 1, y + 1, width - 2, Math.max(18, height * 0.42), radius - 1);
  ctx.clip();
  const shine = ctx.createLinearGradient(x, y, x, y + height * 0.48);
  shine.addColorStop(0, "rgba(255,255,255,0.07)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.fillRect(x, y, width, height * 0.48);
  ctx.restore();
}

function drawIconButton(rect, text, active) {
  const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  gradient.addColorStop(0, active ? "rgba(126,231,255,0.2)" : "rgba(255,255,255,0.105)");
  gradient.addColorStop(1, active ? "rgba(121,240,201,0.11)" : "rgba(255,255,255,0.055)");
  roundedRect(rect.x, rect.y, rect.w, rect.h, 12);
  ctx.fillStyle = gradient;
  ctx.fill();
  roundedRect(rect.x, rect.y, rect.w, rect.h, 12);
  ctx.strokeStyle = active ? "rgba(126,231,255,0.22)" : "rgba(255,255,255,0.09)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 15px sans-serif";
  ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2);
}

function drawHudMetric(x, y, label, value) {
  roundedRect(x, y, 50, 24, 12);
  ctx.fillStyle = "rgba(255,255,255,0.065)";
  ctx.fill();
  roundedRect(x, y, 50, 24, 12);
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "10px sans-serif";
  ctx.fillStyle = COLORS.subText;
  ctx.fillText(label, x + 13, y + 12);
  ctx.font = "bold 12px sans-serif";
  ctx.fillStyle = COLORS.text;
  ctx.fillText(value, x + 34, y + 12);
}

class ArrowMazeGame {
  constructor() {
    this.layout = {
      width: screenWidth,
      height: screenHeight,
      safeTop,
      topHudY,
      topHudHeight,
      topHudBottom
    };
    this.sound = new SoundManager();
    this.state = "start";
    this.level = 1;
    this.hp = MAX_HP;
    this.bestLevel = this.loadBestLevel();
    this.tutorialSeen = this.loadTutorialSeen();
    this.hintCount = 0;
    this.reviveUsed = false;
    this.levelState = null;
    this.message = "点击开始，把所有线都移出屏幕。";
    this.tutorialActive = false;
    this.tutorialStep = 0;
    this.tutorialTargetId = -1;
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
      sound: { x: 76, y: topHudY + 8, w: 44, h: 34 },
      titleStart: { x: 54, y: screenHeight - 204, w: screenWidth - 108, h: 50 },
      titleContinue: { x: 54, y: screenHeight - 142, w: screenWidth - 108, h: 46 },
      restart: { x: 24, y: topHudY + 8, w: 42, h: 34 },
      hint: { x: 18, y: screenHeight - 88, w: 84, h: 42 },
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

  loadTutorialSeen() {
    if (!wx.getStorageSync) {
      return false;
    }
    try {
      return wx.getStorageSync("arrow_maze_tutorial_seen") === 1;
    } catch (error) {
      return false;
    }
  }

  saveTutorialSeen() {
    this.tutorialSeen = true;
    if (!wx.setStorageSync) {
      return;
    }
    try {
      wx.setStorageSync("arrow_maze_tutorial_seen", 1);
    } catch (error) {
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

  vibrate(type) {
    if (!wx.vibrateShort) {
      return;
    }
    try {
      wx.vibrateShort({
        type: type || "light",
        fail: () => {
          try {
            wx.vibrateShort();
          } catch (fallbackError) {
          }
        }
      });
    } catch (error) {
      try {
        wx.vibrateShort();
      } catch (fallbackError) {
      }
    }
  }

  getTimeLimit() {
    return (this.levelState && this.levelState.config.timeLimitSeconds) || 240;
  }

  getRemainingTime() {
    return Math.max(0, this.getTimeLimit() - this.elapsedTime);
  }

  formatTime(seconds) {
    const total = Math.ceil(Math.max(0, seconds));
    const minutes = Math.floor(total / 60);
    const rest = total % 60;
    return `${minutes}:${rest < 10 ? "0" : ""}${rest}`;
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
    this.hp = MAX_HP;
    this.elapsedTime = 0;
    this.failedPathId = -1;
    this.hintPathId = -1;
    this.flashTimer = 0;
    this.levelClearTimer = 0;
    this.refreshMovablePaths();
    const minutes = Math.round(this.getTimeLimit() / 60);
    this.message = `${this.levelState.config.name}关：${minutes} 分钟内把所有线滑出屏幕。`;
    this.setupTutorial();
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

  setupTutorial() {
    this.tutorialActive = this.level === 1 && !this.tutorialSeen;
    this.tutorialStep = this.tutorialActive ? 1 : 0;
    const clearPath = this.levelState.paths.find((path) => !path.escaped && !path.moving && path.isClear);
    this.tutorialTargetId = clearPath ? clearPath.id : -1;
    if (this.tutorialActive && this.tutorialTargetId !== -1) {
      this.hintPathId = this.tutorialTargetId;
      this.flashTimer = 999;
    }
  }

  dismissTutorial() {
    this.tutorialActive = false;
    this.tutorialStep = 0;
    this.tutorialTargetId = -1;
    this.hintPathId = -1;
    this.flashTimer = 0;
    this.saveTutorialSeen();
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

    if (this.tutorialActive) {
      if (this.tutorialStep === 2) {
        this.dismissTutorial();
        return;
      }
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
    if (this.tutorialActive && this.tutorialStep === 1 && path.id !== this.tutorialTargetId) {
      this.message = "先点亮色提示的那条线，跟着指引走一步。";
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

    this.vibrate("light");
    path.moving = true;
    path.progress = 0;
    this.refreshMovablePaths();
    this.message = "整条线正在按箭头方向滑出...";
    this.sound.play("tap");
  }

  failPath(path) {
    this.vibrate("medium");
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
    if (this.tutorialActive && this.tutorialStep === 1 && path.id === this.tutorialTargetId) {
      this.tutorialStep = 2;
      this.hintPathId = -1;
      this.flashTimer = 0;
      this.message = "做得对，后面继续按这样把所有线滑出去。";
    }
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

  handleTimeExpired() {
    this.state = "gameover";
    this.reviveUsed = true;
    this.flashTimer = 0.6;
    this.message = "时间用完了，本关需要在限定时间内通关。";
    this.sound.play("crash");
    this.vibrate("heavy");
  }

  update(dt) {
    if (this.state === "playing" && this.levelState) {
      this.elapsedTime += dt;
      if (this.levelClearTimer <= 0 && this.getRemainingCount() > 0 && this.elapsedTime >= this.getTimeLimit()) {
        this.handleTimeExpired();
        return;
      }
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

    const heroGlow = ctx.createRadialGradient(
      this.layout.width / 2,
      270,
      20,
      this.layout.width / 2,
      270,
      260
    );
    heroGlow.addColorStop(0, "rgba(126,231,255,0.18)");
    heroGlow.addColorStop(0.42, "rgba(126,231,255,0.06)");
    heroGlow.addColorStop(1, "rgba(126,231,255,0)");
    ctx.fillStyle = heroGlow;
    ctx.fillRect(0, 0, this.layout.width, this.layout.height);

    ctx.fillStyle = "rgba(255,255,255,0.032)";
    for (let i = 0; i < 6; i += 1) {
      ctx.beginPath();
      ctx.arc(
        this.layout.width * (0.08 + i * 0.18),
        this.layout.height * (0.12 + (i % 3) * 0.11),
        42 + i * 7,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    const vignette = ctx.createLinearGradient(0, 0, 0, this.layout.height);
    vignette.addColorStop(0, "rgba(8,10,22,0)");
    vignette.addColorStop(1, "rgba(8,10,22,0.32)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.layout.width, this.layout.height);
  }

  drawTopBar() {
    const y = this.layout.topHudY;
    drawSoftPanel(12, y, this.layout.width - 24, this.layout.topHudHeight, 22, COLORS.panelStrong, "rgba(0,0,0,0.26)");

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
    ctx.fillText(`关卡 ${this.level}`, this.layout.width / 2, y + 8);
    ctx.font = "12px sans-serif";
    ctx.fillStyle = COLORS.subText;
    ctx.fillText(this.levelState.config.name, this.layout.width / 2, y + 35);

    ctx.textAlign = "right";
    ctx.font = "12px sans-serif";
    ctx.fillText(`剩余 ${this.getRemainingCount()} 条`, this.layout.width - 24, y + 12);
    ctx.fillText(`计时 ${Math.floor(this.elapsedTime)}s`, this.layout.width - 24, y + 32);

    ctx.textAlign = "center";
    ctx.font = "17px sans-serif";
    for (let i = 0; i < MAX_HP; i += 1) {
      ctx.fillStyle = i < this.hp ? "#ff6b7a" : "rgba(255,255,255,0.18)";
      ctx.fillText("♥", this.layout.width / 2 - 22 + i * 22, y + 56);
    }
  }

  drawTopBarPolished() {
    const y = this.layout.topHudY;
    drawGlassPanel(12, y, this.layout.width - 24, this.layout.topHudHeight, 22, 0.72);

    drawIconButton(this.buttons.restart, "↻", false);
    drawIconButton(this.buttons.sound, this.sound.enabled ? "音" : "静", this.sound.enabled);

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(`关卡 ${this.level}`, this.layout.width / 2, y + 8);
    ctx.font = "12px sans-serif";
    ctx.fillStyle = COLORS.subText;
    ctx.fillText(this.levelState.config.name, this.layout.width / 2, y + 34);

    const metricX = this.layout.width - 132;
    drawHudMetric(metricX, y + 12, "剩", `${this.getRemainingCount()}`);
    drawHudMetric(metricX + 58, y + 12, "时", this.formatTime(this.getRemainingTime()));

    ctx.textAlign = "center";
    ctx.font = "18px sans-serif";
    for (let i = 0; i < MAX_HP; i += 1) {
      ctx.fillStyle = i < this.hp ? "#ff6b7a" : "rgba(255,255,255,0.18)";
      ctx.fillText("♥", this.layout.width / 2 - 24 + i * 24, y + 56);
    }
  }

  drawBoardFrame() {
    const board = this.levelState.board;
    ctx.save();
    ctx.shadowColor = COLORS.glow;
    ctx.shadowBlur = 28;
    roundedRect(board.x - 10, board.y - 10, board.width + 20, board.height + 20, 30);
    ctx.fillStyle = COLORS.boardRing;
    ctx.fill();
    ctx.restore();

    roundedRect(board.x, board.y, board.width, board.height, 24);
    const panelGradient = ctx.createLinearGradient(board.x, board.y, board.x + board.width, board.y + board.height);
    panelGradient.addColorStop(0, "rgba(255,255,255,0.075)");
    panelGradient.addColorStop(0.52, "rgba(255,255,255,0.026)");
    panelGradient.addColorStop(1, "rgba(0,0,0,0.035)");
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

    drawSmallBadge(board.x + 14, board.y + 14, 74, "全部清空", "rgba(21,25,51,0.68)");
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

    const normal = { x: -path.dir.y, y: path.dir.x };
    const headLength = Math.max(PATH_WIDTH * 2.8, 14);
    const headWidth = Math.max(PATH_WIDTH * 1.25, 6);
    const head = visibleSamples[visibleSamples.length - 1];
    const bodyEnd = this.getHeadBasePoint(visibleSamples, path.dir, headLength);

    ctx.lineWidth = PATH_WIDTH;
    ctx.lineCap = "butt";
    ctx.lineJoin = "round";

    ctx.strokeStyle = isRunning ? "rgba(115,240,200,0.24)" : "rgba(0,0,0,0.24)";
    ctx.lineWidth = PATH_WIDTH + 5;
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
    ctx.arc(visibleSamples[0].x, visibleSamples[0].y, (PATH_WIDTH + 5) / 2, 0, Math.PI * 2);
    ctx.fillStyle = isRunning ? "rgba(115,240,200,0.24)" : "rgba(0,0,0,0.24)";
    ctx.fill();

    ctx.strokeStyle = stroke;
    ctx.fillStyle = stroke;
    ctx.lineWidth = PATH_WIDTH;
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
    ctx.arc(visibleSamples[0].x, visibleSamples[0].y, PATH_WIDTH / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.fillStyle = isRunning ? "rgba(115,240,200,0.28)" : "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.moveTo(head.x, head.y);
    ctx.lineTo(
      bodyEnd.x + normal.x * (headWidth + 2),
      bodyEnd.y + normal.y * (headWidth + 2)
    );
    ctx.lineTo(
      bodyEnd.x - normal.x * (headWidth + 2),
      bodyEnd.y - normal.y * (headWidth + 2)
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();

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

  getPointBehindHead(samples, distance) {
    let remaining = distance;
    let head = samples[samples.length - 1];

    for (let i = samples.length - 2; i >= 0; i -= 1) {
      const point = samples[i];
      const dx = head.x - point.x;
      const dy = head.y - point.y;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length >= remaining && length > 0) {
        const t = remaining / length;
        return {
          x: head.x - dx * t,
          y: head.y - dy * t
        };
      }

      remaining -= length;
      head = point;
    }

    return samples[0];
  }

  getHeadBasePoint(samples, dir, distance) {
    const head = samples[samples.length - 1];
    let available = 0;
    let cursor = head;

    for (let i = samples.length - 2; i >= 0; i -= 1) {
      const point = samples[i];
      const dx = cursor.x - point.x;
      const dy = cursor.y - point.y;
      const along = dx * dir.x + dy * dir.y;
      const cross = Math.abs(dx * dir.y - dy * dir.x);
      const length = Math.sqrt(dx * dx + dy * dy);
      if (along <= 0 || cross > 0.5 || length <= 0) {
        break;
      }
      available += length;
      if (available >= distance) {
        return {
          x: head.x - dir.x * distance,
          y: head.y - dir.y * distance
        };
      }
      cursor = point;
    }

    const safeDistance = Math.max(PATH_WIDTH * 1.8, Math.min(distance, available || distance));
    return {
      x: head.x - dir.x * safeDistance,
      y: head.y - dir.y * safeDistance
    };
  }

  drawBoard() {
    this.drawBoardFrame();
    for (let i = 0; i < this.levelState.paths.length; i += 1) {
      this.drawPath(this.levelState.paths[i]);
    }
  }

  drawBottomBar() {
    const y = this.layout.height - 106;
    drawSoftPanel(12, y, this.layout.width - 24, 82, 22, COLORS.panelStrong, "rgba(0,0,0,0.28)");

    const hintGradient = ctx.createLinearGradient(this.buttons.hint.x, this.buttons.hint.y, this.buttons.hint.x + this.buttons.hint.w, this.buttons.hint.y + this.buttons.hint.h);
    hintGradient.addColorStop(0, this.hintCount > 0 ? "#7280bd" : "rgba(255,255,255,0.08)");
    hintGradient.addColorStop(1, this.hintCount > 0 ? "#586398" : "rgba(255,255,255,0.04)");
    roundedRect(this.buttons.hint.x, this.buttons.hint.y, this.buttons.hint.w, this.buttons.hint.h, 13);
    ctx.fillStyle = hintGradient;
    ctx.fill();

    ctx.fillStyle = COLORS.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText(`提示 ${this.hintCount}`, this.buttons.hint.x + this.buttons.hint.w / 2, this.buttons.hint.y + this.buttons.hint.h / 2);

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = "15px sans-serif";
    ctx.fillStyle = COLORS.text;
    drawWrappedText(this.message, 118, y + 12, this.layout.width - 136, 18, 2);
    ctx.font = "12px sans-serif";
    ctx.fillStyle = COLORS.subText;
    drawWrappedText("通关条件：把当前关卡里的所有线都移出屏幕。", 118, y + 51, this.layout.width - 136, 14, 1);
  }

  drawBottomBarPolished() {
    const y = this.layout.height - 108;
    drawGlassPanel(12, y, this.layout.width - 24, 82, 24, 0.68);

    const accent = ctx.createLinearGradient(24, y + 18, 24, y + 70);
    accent.addColorStop(0, COLORS.accent);
    accent.addColorStop(1, COLORS.success);
    roundedRect(24, y + 18, 3, 46, 2);
    ctx.fillStyle = accent;
    ctx.fill();

    const hintY = y + 23;
    const hintGradient = ctx.createLinearGradient(this.buttons.hint.x, hintY, this.buttons.hint.x + this.buttons.hint.w, hintY + 38);
    hintGradient.addColorStop(0, this.hintCount > 0 ? "rgba(143,161,238,0.82)" : "rgba(255,255,255,0.065)");
    hintGradient.addColorStop(1, this.hintCount > 0 ? "rgba(101,114,179,0.74)" : "rgba(255,255,255,0.035)");
    roundedRect(this.buttons.hint.x, hintY, this.buttons.hint.w, 38, 14);
    ctx.fillStyle = hintGradient;
    ctx.fill();
    roundedRect(this.buttons.hint.x, hintY, this.buttons.hint.w, 38, 14);
    ctx.strokeStyle = this.hintCount > 0 ? "rgba(160,178,255,0.24)" : "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = this.hintCount > 0 ? COLORS.text : COLORS.subText;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText(`提示 ${this.hintCount}`, this.buttons.hint.x + this.buttons.hint.w / 2, hintY + 19);

    const textX = this.buttons.hint.x + this.buttons.hint.w + 18;
    const textWidth = this.layout.width - textX - 28;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = "bold 14px sans-serif";
    ctx.fillStyle = COLORS.text;
    drawWrappedText(this.message, textX, y + 14, textWidth, 17, 2);
    ctx.font = "12px sans-serif";
    ctx.fillStyle = COLORS.subText;
    drawWrappedText("目标：所有线都滑出屏幕。", textX, y + 54, textWidth, 14, 1);
  }

  drawTutorialOverlay() {
    if (!this.tutorialActive || this.state !== "playing") {
      return;
    }

    ctx.fillStyle = "rgba(8, 10, 22, 0.34)";
    ctx.fillRect(0, 0, this.layout.width, this.layout.height);

    const board = this.levelState.board;
    if (this.tutorialStep === 1 && this.tutorialTargetId !== -1) {
      const target = this.levelState.paths.find((path) => path.id === this.tutorialTargetId);
      if (target && !target.escaped) {
        const head = target.points[target.points.length - 1];
        ctx.save();
        ctx.strokeStyle = "rgba(126,231,255,0.95)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "rgba(126,231,255,0.28)";
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 28, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    const cardY = board.y + board.height + 16;
    drawGlassPanel(28, cardY, this.layout.width - 56, 96, 22, 0.76);
    drawSmallBadge(42, cardY + 14, 70, `步骤 ${this.tutorialStep}`, "rgba(120,231,255,0.12)");

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 16px sans-serif";
    const title = this.tutorialStep === 1 ? "先点亮色线头，试着滑出第一条线" : "很好，剩下的线也照这样逐条清空";
    drawWrappedText(title, 42, cardY + 46, this.layout.width - 84, 20, 2);
    ctx.font = "12px sans-serif";
    ctx.fillStyle = COLORS.subText;
    const detail = this.tutorialStep === 1 ? "规则：前方没被其他线挡住，就能直接滑出屏幕。" : "点任意位置继续，之后就按同样规则完成本关。";
    drawWrappedText(detail, 42, cardY + 72, this.layout.width - 84, 16, 2);
  }

  drawGameScreen() {
    this.drawTopBarPolished();
    this.drawBoard();
    if (!this.tutorialActive) {
      this.drawBottomBarPolished();
    }
    this.drawTutorialOverlay();
  }

  drawButton(rect, text, fillStyle, textStyle) {
    drawSoftPanel(rect.x, rect.y, rect.w, rect.h, 16, fillStyle, "rgba(0,0,0,0.24)");
    ctx.fillStyle = textStyle || COLORS.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 17px sans-serif";
    ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2);
  }

  drawStartPreview(x, y, width, height) {
    drawSoftPanel(x, y, width, height, 18, "rgba(255,255,255,0.055)", "rgba(0,0,0,0.18)");
    ctx.save();
    roundedRect(x, y, width, height, 18);
    ctx.clip();

    ctx.strokeStyle = "rgba(255,255,255,0.055)";
    ctx.lineWidth = 1;
    for (let gx = x + 18; gx < x + width; gx += 22) {
      ctx.beginPath();
      ctx.moveTo(gx, y + 12);
      ctx.lineTo(gx, y + height - 12);
      ctx.stroke();
    }
    for (let gy = y + 18; gy < y + height; gy += 22) {
      ctx.beginPath();
      ctx.moveTo(x + 12, gy);
      ctx.lineTo(x + width - 12, gy);
      ctx.stroke();
    }

    ctx.strokeStyle = COLORS.line;
    ctx.fillStyle = COLORS.line;
    ctx.lineWidth = PATH_WIDTH;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const samples = [
      [{ x: x + 32, y: y + 34 }, { x: x + 78, y: y + 34 }, { x: x + 78, y: y + 72 }],
      [{ x: x + width - 34, y: y + 38 }, { x: x + width - 86, y: y + 38 }, { x: x + width - 86, y: y + 82 }],
      [{ x: x + 52, y: y + height - 34 }, { x: x + 112, y: y + height - 34 }]
    ];

    for (let i = 0; i < samples.length; i += 1) {
      const line = samples[i];
      ctx.beginPath();
      ctx.moveTo(line[0].x, line[0].y);
      for (let j = 1; j < line.length; j += 1) {
        ctx.lineTo(line[j].x, line[j].y);
      }
      ctx.stroke();
    }

    ctx.restore();
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
    drawWrappedText("点击箭头所在的线，整条线会按箭头方向整体滑出。", this.layout.width / 2, 188, this.layout.width - 92, 22, 2);
    drawWrappedText("前方被别的线身挡住会掉血，所有线都移出屏幕才过关。", this.layout.width / 2, 236, this.layout.width - 92, 22, 2);
    drawWrappedText(`前 ${HANDCRAFTED_LEVELS.length} 关为手工关卡，后续继续自动生成。`, this.layout.width / 2, 284, this.layout.width - 92, 20, 1);
    roundedRect(62, 326, this.layout.width - 124, 74, 20);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fill();
    ctx.font = "14px sans-serif";
    ctx.fillStyle = COLORS.subText;
    drawWrappedText(`最高记录：第 ${Math.max(1, this.bestLevel - 1)} 关`, this.layout.width / 2, 345, this.layout.width - 150, 20, 1);
    drawWrappedText("支持提示、音效和分享复活。", this.layout.width / 2, 370, this.layout.width - 150, 18, 1);

    this.drawButton(this.buttons.titleStart, "开始挑战", COLORS.accent, "#183346");
    if (this.bestLevel > 1) {
      this.drawButton(this.buttons.titleContinue, `从第 ${this.bestLevel} 关继续`, COLORS.panelAlt, COLORS.text);
    }
  }

  drawStartPolishOverlay() {
    drawSoftPanel(30, 88, this.layout.width - 60, 390, 30, COLORS.panelStrong, "rgba(0,0,0,0.32)");
    drawSmallBadge(this.layout.width / 2 - 44, 112, 88, "休闲解谜", "rgba(120,231,255,0.12)");

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 34px sans-serif";
    ctx.fillText("箭头迷阵", this.layout.width / 2, 142);

    ctx.font = "16px sans-serif";
    ctx.fillStyle = COLORS.subText;
    drawWrappedText("点击线头，让每条线沿自己的轨迹滑出。", this.layout.width / 2, 190, this.layout.width - 92, 22, 2);
    drawWrappedText("前方有线会被挡住，全部清空才算过关。", this.layout.width / 2, 236, this.layout.width - 92, 22, 2);

    this.drawStartPreview(62, 286, this.layout.width - 124, 92);

    roundedRect(62, 396, this.layout.width - 124, 54, 18);
    ctx.fillStyle = "rgba(255,255,255,0.055)";
    ctx.fill();
    ctx.font = "14px sans-serif";
    ctx.fillStyle = COLORS.subText;
    drawWrappedText(`最高记录：第 ${Math.max(1, this.bestLevel - 1)} 关`, this.layout.width / 2, 407, this.layout.width - 150, 18, 1);
    drawWrappedText(`前 ${HANDCRAFTED_LEVELS.length} 关手工设计，后续自动生成`, this.layout.width / 2, 428, this.layout.width - 150, 18, 1);

    drawGradientButton(this.buttons.titleStart, "开始挑战", "#7ee7ff", "#79f0c9", "#173346");
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

  drawGameOverPolishOverlay() {
    ctx.fillStyle = COLORS.overlay;
    ctx.fillRect(0, 0, this.layout.width, this.layout.height);

    const panelY = this.layout.height / 2 - 142;
    drawSoftPanel(34, panelY, this.layout.width - 68, 252, 28, COLORS.panelStrong, "rgba(0,0,0,0.36)");
    drawSmallBadge(this.layout.width / 2 - 42, panelY + 20, 84, "本局结束", "rgba(255,118,124,0.13)");

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 27px sans-serif";
    ctx.fillText("挑战失败", this.layout.width / 2, panelY + 56);

    ctx.font = "15px sans-serif";
    ctx.fillStyle = COLORS.subText;
    drawWrappedText(`本次止步第 ${this.level} 关，还有 ${this.getRemainingCount()} 条线没有移出。`, this.layout.width / 2, panelY + 98, this.layout.width - 116, 21, 2);
    drawWrappedText("复活后保留当前局面，继续把剩余线条清空。", this.layout.width / 2, panelY + 142, this.layout.width - 116, 19, 2);

    if (!this.reviveUsed) {
      drawGradientButton(this.buttons.revive, "分享复活", "#8df3c7", "#78e7ff", "#173346");
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
      this.drawStartPolishOverlay();
      return;
    }

    this.drawGameScreen();
    if (this.state === "gameover") {
      this.drawGameOver();
      this.drawGameOverPolishOverlay();
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

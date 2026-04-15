"use strict";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function pointToSegmentDistance(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const denom = abx * abx + aby * aby || 1;
  const t = clamp((apx * abx + apy * aby) / denom, 0, 1);
  const closest = {
    x: a.x + abx * t,
    y: a.y + aby * t
  };
  return distance(point, closest);
}

function buildPathMeta(points) {
  let total = 0;
  const lengths = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    total += distance(points[i], points[i + 1]);
    lengths.push(total);
  }
  return { total, lengths };
}

function samplePath(points, step) {
  const samples = [points[0]];
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    const segmentLength = distance(start, end);
    const count = Math.max(1, Math.ceil(segmentLength / step));
    for (let j = 1; j <= count; j += 1) {
      samples.push({
        x: lerp(start.x, end.x, j / count),
        y: lerp(start.y, end.y, j / count)
      });
    }
  }
  return samples;
}

function getBounds(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, minY, maxX, maxY };
}

class RNG {
  constructor(seed) {
    this.seed = seed || 1;
  }

  next() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  range(min, max) {
    return lerp(min, max, this.next());
  }

  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  pick(list) {
    return list[this.int(0, list.length - 1)];
  }
}

module.exports = {
  clamp,
  distance,
  pointToSegmentDistance,
  buildPathMeta,
  samplePath,
  getBounds,
  RNG
};

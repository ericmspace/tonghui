// 语音引导作画系统 · 完成检测器（仅用 x,y,t）
// 规格见 handoff §4。原则：宽松容错——判断"孩子是否尝试并大致完成"，
// 不评判美观；宁可放过，不要卡住流程（ASD 儿童图形很不规则）。

import type { Stroke, Detector, DetectorName } from "./types";

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** 过滤掉过短的噪声笔（点数 < 2） */
function clean(strokes: Stroke[]): Stroke[] {
  return strokes.filter((s) => s.length >= 2);
}

function pathLength(s: Stroke): number {
  let len = 0;
  for (let i = 1; i < s.length; i++) len += dist(s[i - 1], s[i]);
  return len;
}

function bbox(s: Stroke) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of s) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function longest(strokes: Stroke[]): Stroke | null {
  let best: Stroke | null = null;
  let bestLen = -1;
  for (const s of strokes) {
    const l = pathLength(s);
    if (l > bestLen) { bestLen = l; best = s; }
  }
  return best;
}

/** 数一条笔里的角点：方向突变 > 阈值处计一个角 */
function cornersIn(s: Stroke, angleThreshDeg = 45, step = 3): number {
  if (s.length < step * 2 + 1) return 0;
  let corners = 0;
  const thresh = (angleThreshDeg * Math.PI) / 180;
  for (let i = step; i < s.length - step; i++) {
    const a = s[i - step], b = s[i], c = s[i + step];
    const v1x = b.x - a.x, v1y = b.y - a.y;
    const v2x = c.x - b.x, v2y = c.y - b.y;
    const m1 = Math.hypot(v1x, v1y), m2 = Math.hypot(v2x, v2y);
    if (m1 < 4 || m2 < 4) continue;
    let cos = (v1x * v2x + v1y * v2y) / (m1 * m2);
    cos = Math.max(-1, Math.min(1, cos));
    const turn = Math.acos(cos);
    if (turn > thresh) { corners++; i += step; } // 跳过避免同一拐角重复计数
  }
  return corners;
}

// ---- 各检测器 ----

/** 闭合曲线：最长笔的首尾足够接近 + 包围盒有一定大小 */
const closed_curve: Detector = (raw) => {
  const strokes = clean(raw);
  const s = longest(strokes);
  if (!s || s.length < 8) return false;
  const bb = bbox(s);
  const diag = Math.hypot(bb.w, bb.h);
  if (diag < 50) return false; // 太小视为没画
  return dist(s[0], s[s.length - 1]) < 0.28 * diag;
};

/** 角点数：所有新笔的角点之和 ≥ min_corners（默认 2） */
const corner_count: Detector = (raw, params) => {
  const strokes = clean(raw);
  if (!strokes.length) return false;
  const need = params?.min_corners ?? 2;
  const total = strokes.reduce((sum, s) => sum + cornersIn(s), 0);
  return total >= need;
};

/** 落笔次数 ≥ min_strokes（默认 2，胡须/光芒类） */
const stroke_count: Detector = (raw, params) => {
  const strokes = clean(raw);
  const need = params?.min_strokes ?? 2;
  return strokes.length >= need;
};

/** 点：存在一笔很短、停留也短 */
const dot: Detector = (raw) => {
  const strokes = clean(raw);
  return strokes.some((s) => {
    const dur = s[s.length - 1].t - s[0].t;
    return pathLength(s) < 36 && dur < 700;
  });
};

/** 直线：最长笔近似直线（点到首尾连线的最大偏移 < 长度的 20%） */
const line: Detector = (raw) => {
  const strokes = clean(raw);
  const s = longest(strokes);
  if (!s || s.length < 3) return false;
  const a = s[0], b = s[s.length - 1];
  const base = dist(a, b);
  if (base < 40) return false;
  let maxDev = 0;
  for (const p of s) {
    // 点到直线 ab 的距离
    const d = Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x) / base;
    if (d > maxDev) maxDev = d;
  }
  return maxDev < 0.2 * base;
};

export const DETECTORS: Record<DetectorName, Detector> = {
  closed_curve,
  corner_count,
  stroke_count,
  dot,
  line,
};

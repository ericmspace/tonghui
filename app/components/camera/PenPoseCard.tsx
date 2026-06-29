// 笔姿态实时检测：订阅笔端 IMU，用互补滤波估计朝向，把笔当作「沿 Y 轴的圆柱」实时渲染。
// 与摄像头语音引导各自独立：可单独开关、单独选数据源（模拟 / 真实笔）。

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button } from "~/components/ui/primitives";
import { cx } from "~/lib/cx";
import { useImuMonitor } from "~/lib/imu/useImuMonitor";
import { OrientationTracker, poseAngles, quatToMatrix, applyMatrix, type Quat, type Vec3 } from "~/lib/imu/orientation";
import { parseStl, type PenMesh, type PenOrient } from "~/lib/imu/stl";

const MODEL_URL = "/models/pen.stl"; // 真实笔模型；缺省时回退程序化圆柱
const MESH_COLOR: [number, number, number] = [139, 124, 246]; // 网格统一品牌紫（STL 无颜色）

// 真实笔朝向（按 签字笔666.step.STL 实测标定）：书写轴=模型 Z 轴(机械结构↔笔尖)，
// 绕 X 翻 180° 让机械结构在上、笔尖朝下。两侧保护套使两端横截面接近、自动判尖不可靠，
// 故此处显式指定。换模型时若朝向不对，改 writingAxis / flip 即可。
const PEN_ORIENT: PenOrient = { writingAxis: "z", flip: true };

/* ----------------------------- 笔的几何（本地坐标，轴沿 +Y） ----------------------------- */
const SEG = 28; // 圆周分段
const R = 0.17; // 半径
const BODY_TOP = 1.0; // 笔尾
const BODY_BOT = -0.55; // 笔身与笔尖交界
const TIP_APEX = -1.05; // 笔尖（书写端）

type Face = { pts: Vec3[]; color: [number, number, number]; normal: Vec3 };

const BODY_COLOR: [number, number, number] = [139, 124, 246]; // 品牌紫
const TIP_COLOR: [number, number, number] = [245, 158, 11]; // 笔尖琥珀
const CAP_COLOR: [number, number, number] = [180, 170, 250]; // 笔尾浅紫

// 预生成单位圆，渲染时再缩放/旋转
const RING = Array.from({ length: SEG }, (_, i) => {
  const a = (i / SEG) * Math.PI * 2;
  return [Math.cos(a), Math.sin(a)] as const;
});

function buildPenFaces(): Face[] {
  const faces: Face[] = [];
  const top = (i: number): Vec3 => [RING[i][0] * R, BODY_TOP, RING[i][1] * R];
  const bot = (i: number): Vec3 => [RING[i][0] * R, BODY_BOT, RING[i][1] * R];
  const apex: Vec3 = [0, TIP_APEX, 0];
  const capCenter: Vec3 = [0, BODY_TOP, 0];

  for (let i = 0; i < SEG; i++) {
    const j = (i + 1) % SEG;
    // 侧壁法线（径向）
    const nx = RING[i][0] + RING[j][0];
    const nz = RING[i][1] + RING[j][1];
    const sideN: Vec3 = norm([nx, 0, nz]);
    faces.push({ pts: [bot(i), bot(j), top(j), top(i)], color: BODY_COLOR, normal: sideN });
    // 笔尖锥面
    faces.push({ pts: [apex, bot(j), bot(i)], color: TIP_COLOR, normal: norm([nx, 0.8, nz]) });
    // 笔尾盖
    faces.push({ pts: [capCenter, top(i), top(j)], color: CAP_COLOR, normal: [0, 1, 0] });
  }
  return faces;
}

const PEN_FACES = buildPenFaces();

function norm(v: Vec3): Vec3 {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
}

// 程序化圆柱场景（无真实模型时的回退）
const PEN_SCENE: Scene = { faces: PEN_FACES, bottomY: TIP_APEX, topY: BODY_TOP, stroke: true };

// 真实 STL 网格 → 渲染场景（统一品牌紫、关掉逐面描边）
function meshToScene(mesh: PenMesh): Scene {
  const faces: Face[] = mesh.tris.map((t) => ({ pts: [t.a, t.b, t.c], color: MESH_COLOR, normal: t.normal }));
  return { faces, bottomY: mesh.bottomY, topY: mesh.topY, stroke: false };
}

/* ----------------------------- 视角 + 投影 ----------------------------- */
// 固定相机：稍微俯视 + 侧转，给出 3/4 立体观感
const VIEW_PITCH = -0.32; // 绕 X 俯仰
const VIEW_YAW = 0.5; // 绕 Y 偏航
function rotView(v: Vec3): Vec3 {
  // 先偏航（绕 Y）再俯仰（绕 X）
  const cy = Math.cos(VIEW_YAW), sy = Math.sin(VIEW_YAW);
  const x1 = cy * v[0] + sy * v[2];
  const z1 = -sy * v[0] + cy * v[2];
  const cp = Math.cos(VIEW_PITCH), sp = Math.sin(VIEW_PITCH);
  const y2 = cp * v[1] - sp * z1;
  const z2 = sp * v[1] + cp * z1;
  return [x1, y2, z2];
}

const LIGHT = norm([0.35, 0.7, 0.6]); // 视图空间光照方向

type Scene = { faces: Face[]; bottomY: number; topY: number; stroke: boolean };

function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, qRel: Quat, scene: Scene) {
  ctx.clearRect(0, 0, w, h);
  const cx0 = w / 2;
  const cy0 = h / 2;
  const scale = Math.min(w, h) * 0.32;
  const project = (p: Vec3): [number, number, number] => {
    const v = rotView(p);
    const persp = 1 / (1 - v[2] * 0.12); // 轻微透视
    return [cx0 + v[0] * scale * persp, cy0 - v[1] * scale * persp, v[2]];
  };

  const M = quatToMatrix(qRel);

  // —— 地面参考椭圆 + 竖直参考线（锚定倾斜感） ——
  ctx.save();
  ctx.strokeStyle = "rgba(80,70,120,0.18)";
  ctx.lineWidth = 1;
  const groundY = scene.bottomY - 0.05;
  ctx.beginPath();
  for (let i = 0; i <= SEG; i++) {
    const a = (i / SEG) * Math.PI * 2;
    const [sx, sy] = project([Math.cos(a) * 0.9, groundY, Math.sin(a) * 0.9]);
    i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
  }
  ctx.stroke();
  // 竖直参考（世界 +Y），虚线
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = "rgba(80,70,120,0.28)";
  const [vx0, vy0] = project([0, groundY, 0]);
  const [vx1, vy1] = project([0, scene.topY + 0.25, 0]);
  ctx.beginPath();
  ctx.moveTo(vx0, vy0);
  ctx.lineTo(vx1, vy1);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // —— 笔体：逐像素 Z-buffer 光栅化（凹形密网格不能用画家算法，否则背面会穿透出现棋盘格） ——
  // 在设备像素缓冲里画（getImageData/putImageData 不受 dpr 变换影响），网格参考线保留在底层。
  const canvas = ctx.canvas;
  const dw = canvas.width, dh = canvas.height;
  const sxScale = dw / w; // 设备像素 / CSS 像素
  const projDev = (p: Vec3): [number, number, number] => {
    const [px, py, pz] = project(p);
    return [px * sxScale, py * sxScale, pz];
  };
  const img = ctx.getImageData(0, 0, dw, dh);
  const data = img.data;
  const zbuf = new Float32Array(dw * dh).fill(-Infinity);

  const tri = (p0: number[], p1: number[], p2: number[], r: number, g: number, b: number) => {
    const minX = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0])));
    const maxX = Math.min(dw - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
    const minY = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1])));
    const maxY = Math.min(dh - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));
    const area = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]);
    if (Math.abs(area) < 1e-6) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const a = ((p1[0] - x) * (p2[1] - y) - (p2[0] - x) * (p1[1] - y)) / area;
        const bb = ((p2[0] - x) * (p0[1] - y) - (p0[0] - x) * (p2[1] - y)) / area;
        const cc = 1 - a - bb;
        if (a < 0 || bb < 0 || cc < 0) continue;
        const z = a * p0[2] + bb * p1[2] + cc * p2[2];
        const idx = y * dw + x;
        if (z > zbuf[idx]) {
          zbuf[idx] = z;
          const o = idx * 4;
          data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
        }
      }
    }
  };

  for (const f of scene.faces) {
    const wpts = f.pts.map((p) => applyMatrix(M, p));
    const proj = wpts.map(projDev);
    const vn = rotView(applyMatrix(M, f.normal));
    const shade = Math.max(0, vn[0] * LIGHT[0] + vn[1] * LIGHT[1] + vn[2] * LIGHT[2]);
    const k = 0.4 + 0.6 * shade;
    const r = Math.round(f.color[0] * k), g = Math.round(f.color[1] * k), b = Math.round(f.color[2] * k);
    // 扇形三角化（兼容圆柱的四边形面与网格的三角面）
    for (let i = 1; i < proj.length - 1; i++) tri(proj[0], proj[i], proj[i + 1], r, g, b);
  }
  ctx.putImageData(img, 0, 0);

  // —— 笔尖到地面的投影点（落点提示） ——
  const tipWorld = applyMatrix(M, [0, scene.bottomY, 0]);
  const [tx, ty] = project([tipWorld[0], groundY, tipWorld[2]]);
  ctx.fillStyle = "rgba(245,158,11,0.5)";
  ctx.beginPath();
  ctx.arc(tx, ty, 4, 0, Math.PI * 2);
  ctx.fill();
}

/* ----------------------------- 组件 ----------------------------- */
type ImuSource = "sim" | "ws";

export function PenPoseCard() {
  const monitor = useImuMonitor();
  const trackerRef = useRef(new OrientationTracker());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [running, setRunning] = useState(false);
  const [source, setSource] = useState<ImuSource>("ws");
  const [angles, setAngles] = useState({ tilt: 0, leanFwd: 0, leanSide: 0 });
  const lastUiRef = useRef(0);
  const sceneRef = useRef<Scene>(PEN_SCENE); // 默认圆柱，加载到 STL 后替换
  const [modelLoaded, setModelLoaded] = useState(false);

  // 启动时尝试加载真实笔模型；缺失/解析失败则保留程序化圆柱
  useEffect(() => {
    let alive = true;
    fetch(MODEL_URL)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("no model"))))
      .then((buf) => {
        if (!alive) return;
        const mesh = parseStl(buf, PEN_ORIENT);
        if (mesh.tris.length > 0) {
          sceneRef.current = meshToScene(mesh);
          setModelLoaded(true);
        }
      })
      .catch(() => {/* 用回退圆柱 */});
    return () => {
      alive = false;
    };
  }, []);

  // 真实笔：拉起 / 关闭 Python WS 桥（与语音引导同一座桥，幂等复用）
  const startBridge = useCallback(async () => {
    try {
      await fetch("/api/imu-bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", mode: "serial" }),
      });
    } catch {
      /* 连不上会自动回退本地模拟 */
    }
  }, []);
  const stopBridge = useCallback(() => {
    fetch("/api/imu-bridge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop" }),
    }).catch(() => {});
  }, []);

  // rAF 渲染循环：读取 tracker 的最新姿态画出来（不受 IMU 帧率限制，丝滑）
  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const qRel = trackerRef.current.relative();
        drawScene(ctx, w, h, qRel, sceneRef.current);
        const now = performance.now();
        if (now - lastUiRef.current > 120) {
          lastUiRef.current = now;
          setAngles(poseAngles(qRel));
        }
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const start = useCallback(async () => {
    if (running) return;
    trackerRef.current.reset();
    if (source === "ws") await startBridge();
    monitor.start({ source, onFrame: (f) => trackerRef.current.update(f) });
    setRunning(true);
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(loop);
  }, [running, source, monitor, startBridge, loop]);

  const stop = useCallback(() => {
    monitor.stop();
    stopBridge();
    setRunning(false);
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, [monitor, stopBridge]);

  const calibrate = useCallback(() => trackerRef.current.calibrate(), []);

  // 卸载清理
  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      monitor.stop();
      stopBridge();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const tiltTone = angles.tilt < 25 ? "mint" : angles.tilt < 55 ? "warn" : "brand";
  const tiltText = angles.tilt < 25 ? "握笔较直" : angles.tilt < 55 ? "略有倾斜" : "倾斜较大";

  return (
    <div className="grid sm:grid-cols-[1fr_240px] gap-5 items-start">
      {/* 3D 笔姿态 */}
      <div className="relative rounded-3xl overflow-hidden hairline bg-gradient-to-b from-white/70 to-brand-50/40 aspect-[4/3]">
        <canvas ref={canvasRef} className="w-full h-full block" />
        {!running && (
          <div className="absolute inset-0 grid place-items-center text-center">
            <div className="text-ink-faint">
              <div className="text-5xl mb-2">🖊️</div>
              <p className="text-sm">点「开始检测」实时同步笔的姿态</p>
            </div>
          </div>
        )}
        {running && (
          <div className="absolute top-3 left-3">
            <Badge tone={source === "ws" ? (monitor.status === "ws-open" ? "mint" : monitor.status === "ws-fallback" ? "warn" : "neutral") : "neutral"}>
              {source === "sim"
                ? "● 模拟数据"
                : monitor.status === "ws-open"
                ? "● 真实笔"
                : monitor.status === "ws-connecting"
                ? "○ 连接中…"
                : monitor.status === "ws-fallback"
                ? "⚠ 未连到桥 · 本地模拟"
                : "○ 准备中"}
            </Badge>
          </div>
        )}
        <div className="absolute bottom-3 left-3">
          <Badge tone={modelLoaded ? "mint" : "neutral"}>{modelLoaded ? "🖊️ 真实笔模型" : "○ 圆柱占位"}</Badge>
        </div>
      </div>

      {/* 控制 + 读数 */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-muted shrink-0">数据源</span>
          <div className="inline-flex p-1 rounded-full bg-black/[0.05]">
            {(["sim", "ws"] as ImuSource[]).map((v) => (
              <button
                key={v}
                type="button"
                disabled={running}
                onClick={() => setSource(v)}
                className={cx(
                  "px-3 h-7 rounded-full text-xs font-semibold transition disabled:opacity-50",
                  source === v ? "bg-white text-ink shadow-soft" : "text-ink-muted hover:text-ink-soft"
                )}
              >
                {v === "sim" ? "模拟" : "真实笔"}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-white/70 hairline p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-muted">笔身倾角</span>
            <Badge tone={tiltTone}>{running ? tiltText : "—"}</Badge>
          </div>
          <div className="text-2xl font-bold text-ink tabular-nums">
            {running ? `${angles.tilt.toFixed(0)}°` : "—"}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-ink-faint tabular-nums">
            <span>前后倾 {running ? `${angles.leanFwd.toFixed(0)}°` : "—"}</span>
            <span>左右倾 {running ? `${angles.leanSide.toFixed(0)}°` : "—"}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {!running ? (
            <Button onClick={start} className="w-full">▶️ 开始检测</Button>
          ) : (
            <Button variant="outline" onClick={stop} className="w-full">⏹ 停止检测</Button>
          )}
          <Button variant="ghost" onClick={calibrate} disabled={!running} className="w-full">
            🎯 归零（把当前姿态设为竖直）
          </Button>
        </div>

        <p className="text-[10px] text-ink-faint leading-relaxed">
          {modelLoaded ? "已载入真实笔 STL 模型（长轴对齐 Y 轴）" : "未找到模型，暂用沿 Y 轴的圆柱占位"}
          ，姿态由陀螺仪 + 加速度互补滤波估计。无磁力计时航向会缓慢漂移，点「归零」即可校准。
        </p>
      </div>
    </div>
  );
}

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cx } from "~/lib/cx";
import { Button } from "~/components/ui/primitives";

export type StrokePoint = { x: number; y: number; t: number };

export type DrawingCanvasHandle = {
  exportPNG: () => string;
  loadImage: (src: string) => void;
  /** 返回到目前为止记录的全部画笔笔迹（按抬笔分段，仅 brush 工具），供语音引导检测使用 */
  getStrokes: () => StrokePoint[][];
};

type Tool = "brush" | "eraser" | "fill";

const W = 1024;
const H = 768;

const PALETTE = [
  "#2b2b2e", "#ff6b2c", "#ff9eaa", "#ffd166", "#5ec8a8",
  "#5ab0ff", "#a78bfa", "#7bd389", "#f4a261", "#e76f51",
  "#ffffff", "#caa27a",
];

export const DrawingCanvas = forwardRef<DrawingCanvasHandle, { initialImage?: string | null }>(
  function DrawingCanvas({ initialImage }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const drawing = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);

    // 笔迹记录（x,y,t）：供语音引导的完成检测使用；只记 brush 笔
    const strokes = useRef<StrokePoint[][]>([]);
    const curStroke = useRef<StrokePoint[] | null>(null);

    const [tool, setTool] = useState<Tool>("brush");
    const [color, setColor] = useState("#ff6b2c");
    const [size, setSize] = useState(8);

    const history = useRef<ImageData[]>([]);
    const future = useRef<ImageData[]>([]);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    const syncFlags = () => {
      setCanUndo(history.current.length > 1);
      setCanRedo(future.current.length > 0);
    };

    const snapshot = useCallback(() => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      history.current.push(ctx.getImageData(0, 0, W, H));
      if (history.current.length > 40) history.current.shift();
      future.current = [];
      syncFlags();
    }, []);

    const clearTo = useCallback((fill = "#ffffff") => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, W, H);
    }, []);

    // 初始化
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctxRef.current = ctx;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      clearTo("#ffffff");
      history.current = [ctx.getImageData(0, 0, W, H)];
      syncFlags();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadImage = useCallback(
      (src: string) => {
        const ctx = ctxRef.current;
        if (!ctx) return;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          clearTo("#ffffff");
          // contain 适配
          const scale = Math.min(W / img.width, H / img.height);
          const dw = img.width * scale;
          const dh = img.height * scale;
          ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
          history.current = [ctx.getImageData(0, 0, W, H)];
          future.current = [];
          syncFlags();
        };
        img.src = src;
      },
      [clearTo]
    );

    useEffect(() => {
      if (initialImage) loadImage(initialImage);
    }, [initialImage, loadImage]);

    useImperativeHandle(ref, () => ({
      exportPNG: () => canvasRef.current?.toDataURL("image/png") ?? "",
      loadImage,
      getStrokes: () => strokes.current.map((s) => s.slice()),
    }));

    /* ---------- 坐标换算 ---------- */
    const pos = (e: React.PointerEvent) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * W,
        y: ((e.clientY - rect.top) / rect.height) * H,
      };
    };

    /* ---------- 填色桶 ---------- */
    const floodFill = (sx: number, sy: number, hex: string) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      const img = ctx.getImageData(0, 0, W, H);
      const data = img.data;
      const sxi = Math.floor(sx);
      const syi = Math.floor(sy);
      const idx = (syi * W + sxi) * 4;
      const target = [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
      const fill = hexToRgba(hex);
      if (colorsClose(target, fill, 0)) return;

      const tol = 48;
      const stack = [[sxi, syi]];
      const match = (i: number) =>
        Math.abs(data[i] - target[0]) <= tol &&
        Math.abs(data[i + 1] - target[1]) <= tol &&
        Math.abs(data[i + 2] - target[2]) <= tol &&
        Math.abs(data[i + 3] - target[3]) <= tol;

      while (stack.length) {
        const [x, y] = stack.pop()!;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = (y * W + x) * 4;
        if (!match(i)) continue;
        data[i] = fill[0];
        data[i + 1] = fill[1];
        data[i + 2] = fill[2];
        data[i + 3] = fill[3];
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
      ctx.putImageData(img, 0, 0);
    };

    /* ---------- 指针事件 ---------- */
    const onDown = (e: React.PointerEvent) => {
      e.preventDefault();
      const ctx = ctxRef.current;
      if (!ctx) return;
      const p = pos(e);
      if (tool === "fill") {
        floodFill(p.x, p.y, color);
        snapshot();
        return;
      }
      drawing.current = true;
      last.current = p;
      // 仅记录 brush 笔迹（橡皮不计入），开启新的一笔
      if (tool === "brush") {
        curStroke.current = [{ x: p.x, y: p.y, t: Date.now() }];
        strokes.current.push(curStroke.current);
      } else {
        curStroke.current = null;
      }
      // 画一个点
      ctx.beginPath();
      ctx.fillStyle = tool === "eraser" ? "#ffffff" : color;
      ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    };

    const onMove = (e: React.PointerEvent) => {
      if (!drawing.current) return;
      const ctx = ctxRef.current;
      if (!ctx || !last.current) return;
      const p = pos(e);
      ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last.current = p;
      if (curStroke.current) curStroke.current.push({ x: p.x, y: p.y, t: Date.now() });
    };

    const onUp = () => {
      if (!drawing.current) return;
      drawing.current = false;
      last.current = null;
      curStroke.current = null;
      snapshot();
    };

    /* ---------- 撤销 / 重做 ---------- */
    const undo = () => {
      const ctx = ctxRef.current;
      if (!ctx || history.current.length <= 1) return;
      const cur = history.current.pop()!;
      future.current.push(cur);
      ctx.putImageData(history.current[history.current.length - 1], 0, 0);
      syncFlags();
    };
    const redo = () => {
      const ctx = ctxRef.current;
      if (!ctx || future.current.length === 0) return;
      const next = future.current.pop()!;
      history.current.push(next);
      ctx.putImageData(next, 0, 0);
      syncFlags();
    };
    const clearAll = () => {
      clearTo("#ffffff");
      snapshot();
    };

    return (
      <div className="space-y-4">
        {/* 工具栏 */}
        <div className="glass rounded-4xl p-3 flex flex-wrap items-center gap-3">
          <div className="inline-flex p-1 rounded-full bg-black/[0.05]">
            {([
              ["brush", "🖌️", "画笔"],
              ["fill", "🪣", "填色"],
              ["eraser", "🧽", "橡皮"],
            ] as [Tool, string, string][]).map(([t, icon, label]) => (
              <button
                key={t}
                onClick={() => setTool(t)}
                className={cx(
                  "px-3.5 h-9 rounded-full text-sm font-semibold transition flex items-center gap-1.5",
                  tool === t ? "bg-white text-ink shadow-soft" : "text-ink-muted hover:text-ink-soft"
                )}
              >
                <span>{icon}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 px-2">
            <span className="text-xs text-ink-muted">笔触</span>
            <input
              type="range"
              min={2}
              max={48}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="accent-brand-500 w-24"
            />
            <span className="text-xs text-ink-faint w-6 tabular-nums">{size}</span>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo}>
              ↶ 撤销
            </Button>
            <Button variant="ghost" size="sm" onClick={redo} disabled={!canRedo}>
              ↷ 重做
            </Button>
            <Button variant="outline" size="sm" onClick={clearAll}>
              清空
            </Button>
          </div>
        </div>

        {/* 调色板 */}
        <div className="flex flex-wrap items-center gap-2">
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c);
                if (tool === "eraser") setTool("brush");
              }}
              className={cx(
                "w-8 h-8 rounded-full transition-transform hover:scale-110 ring-2 ring-offset-2 ring-offset-canvas",
                color === c ? "ring-ink/40 scale-110" : "ring-transparent",
                c === "#ffffff" && "border border-black/10"
              )}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
          <label className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-transparent hover:ring-ink/20 cursor-pointer relative grid place-items-center bg-gradient-to-br from-pink-400 via-yellow-300 to-sky-400">
            <span className="text-[10px]">＋</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </label>
        </div>

        {/* 画布 */}
        <div className="glass-strong rounded-4xl p-3">
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
            className="w-full rounded-3xl bg-white touch-none cursor-crosshair shadow-inner"
            style={{ aspectRatio: `${W} / ${H}` }}
          />
        </div>
      </div>
    );
  }
);

/* ---------- 颜色工具 ---------- */
function hexToRgba(hex: string): [number, number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}
function colorsClose(a: number[], b: number[], tol: number) {
  return (
    Math.abs(a[0] - b[0]) <= tol &&
    Math.abs(a[1] - b[1]) <= tol &&
    Math.abs(a[2] - b[2]) <= tol &&
    Math.abs(a[3] - b[3]) <= tol
  );
}

import { useEffect, useState } from "react";
import { Link } from "@remix-run/react";
import type { MetaFunction } from "@remix-run/node";
import { Spinner } from "~/components/ui/primitives";
import { cx } from "~/lib/cx";

export const meta: MetaFunction = () => [{ title: "探索模式 · 童绘" }];

const EXPLORE_KEY = "th_explore_image";
type Dir = "up" | "down" | "left" | "right";

export default function Explore() {
  const [image, setImage] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dir, setDir] = useState<Dir | null>(null);
  const [started, setStarted] = useState(false);
  const [trail, setTrail] = useState<Dir[]>([]);

  useEffect(() => {
    const img = sessionStorage.getItem(EXPLORE_KEY);
    if (img) setImage(img);
  }, []);

  // 生成初始图（若无来源则用 mock 简笔图作种子）
  const begin = async () => {
    setStarted(true);
    if (image) return;
    setLoading(true);
    try {
      // 用一张占位 1x1 触发服务端 mock 简笔种子
      const seed =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
      const data = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: seed, colored: true, mode: "coloring", extraPrompt: "梦幻探索世界的起点" }),
      }).then((r) => r.json());
      setImage(data.image);
    } finally {
      setLoading(false);
    }
  };

  const explore = async (d: Dir) => {
    if (!image || loading) return;
    setLoading(true);
    setDir(d);
    try {
      const next = step + 1;
      const data = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: image, mode: "direction", direction: d, step: next }),
      }).then((r) => r.json());
      setImage(data.image);
      setStep(next);
      setTrail((t) => [...t, d]);
    } finally {
      setLoading(false);
      setDir(null);
    }
  };

  const arrows: { d: Dir; icon: string; pos: string }[] = [
    { d: "up", icon: "↑", pos: "top-6 left-1/2 -translate-x-1/2" },
    { d: "down", icon: "↓", pos: "bottom-28 left-1/2 -translate-x-1/2" },
    { d: "left", icon: "←", pos: "left-6 top-1/2 -translate-y-1/2" },
    { d: "right", icon: "→", pos: "right-6 top-1/2 -translate-y-1/2" },
  ];

  const dirText: Record<Dir, string> = { up: "上", down: "下", left: "左", right: "右" };

  return (
    <div className="fixed inset-0 overflow-hidden bg-ink">
      {/* 背景图 */}
      {image && (
        <img
          src={image}
          alt="探索画面"
          className={cx(
            "absolute inset-0 w-full h-full object-cover transition-all duration-700",
            loading ? "scale-105 blur-[2px] brightness-90" : "scale-100"
          )}
          key={image}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />

      {/* 顶部栏 */}
      <div className="absolute top-0 inset-x-0 p-5 flex items-center justify-between z-20">
        <Link
          to="/video"
          className="inline-flex items-center gap-2 rounded-full bg-white/85 backdrop-blur px-4 h-10 font-semibold text-ink-soft hover:bg-white transition"
        >
          ← 返回
        </Link>
        <div className="rounded-full bg-white/85 backdrop-blur px-4 h-10 inline-flex items-center gap-2 font-semibold text-ink-soft">
          🧭 探索第 <span className="text-brand-500">{step}</span> 步
        </div>
      </div>

      {/* 起始遮罩 */}
      {!started && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-ink/40 backdrop-blur-sm">
          <div className="glass-strong rounded-5xl p-10 text-center max-w-md mx-4 animate-pop-in">
            <div className="text-6xl mb-4 animate-float">🧭</div>
            <h1 className="text-2xl font-extrabold text-ink mb-2">沉浸探索模式</h1>
            <p className="text-ink-muted mb-6">
              进入一幅会延展的画面世界。点击上 / 下 / 左 / 右，
              AI 会朝那个方向想象并生成相邻的新场景，带你不断漫游。
            </p>
            <button
              onClick={begin}
              className="rounded-full bg-brand-500 text-white px-8 h-13 h-[52px] font-semibold shadow-glow hover:bg-brand-600 transition"
            >
              ✨ 开始探索
            </button>
          </div>
        </div>
      )}

      {/* 加载指示 */}
      {loading && started && (
        <div className="absolute inset-0 z-20 grid place-items-center">
          <div className="rounded-3xl bg-white/85 backdrop-blur px-6 py-4 flex items-center gap-3 shadow-lift">
            <Spinner className="w-6 h-6 text-brand-500" />
            <span className="font-semibold text-ink-soft">
              {dir ? `正在向${dirText[dir]}延展画面…` : "正在生成起始画面…"}
            </span>
          </div>
        </div>
      )}

      {/* 四向按钮 */}
      {started && (
        <>
          {arrows.map((a) => (
            <button
              key={a.d}
              onClick={() => explore(a.d)}
              disabled={loading || !image}
              className={cx(
                "absolute z-20 w-16 h-16 rounded-full grid place-items-center text-3xl font-bold",
                "bg-white/85 backdrop-blur text-ink-soft shadow-lift transition-all",
                "hover:bg-white hover:scale-110 active:scale-95 disabled:opacity-40 disabled:pointer-events-none",
                a.pos
              )}
              aria-label={`向${dirText[a.d]}探索`}
            >
              {a.icon}
            </button>
          ))}

          {/* 底部足迹 */}
          <div className="absolute bottom-6 inset-x-0 z-20 flex justify-center">
            <div className="rounded-full bg-white/85 backdrop-blur px-5 py-2.5 flex items-center gap-2 max-w-[80vw] overflow-x-auto shadow-soft">
              <span className="text-sm text-ink-muted shrink-0">足迹</span>
              {trail.length === 0 ? (
                <span className="text-sm text-ink-faint">从中心出发，选择一个方向</span>
              ) : (
                trail.map((d, i) => (
                  <span key={i} className="shrink-0 text-lg text-brand-500">
                    {{ up: "↑", down: "↓", left: "←", right: "→" }[d]}
                  </span>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

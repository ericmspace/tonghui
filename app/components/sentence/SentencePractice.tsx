import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Badge, Spinner } from "~/components/ui/primitives";
import { cx } from "~/lib/cx";

type Tile = { id: number; text: string };
type Status = "idle" | "loading" | "ready" | "error";

/** Fisher–Yates 洗牌，尽量保证与原顺序不同（词组≥2 时） */
function shuffle(ids: number[]): number[] {
  if (ids.length < 2) return [...ids];
  let out = [...ids];
  for (let attempt = 0; attempt < 6; attempt++) {
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (out.some((id, idx) => id !== ids[idx])) break;
  }
  return out;
}

/**
 * 组句练习：把生图后的画面变成一句话，按词组打乱成卡片，
 * 孩子依次点选拼回正确顺序。点池中卡片放入答案区，点答案区卡片放回。
 */
export function SentencePractice({ image }: { image: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [mocked, setMocked] = useState(false);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [correct, setCorrect] = useState<string[]>([]);
  const [order, setOrder] = useState<number[]>([]); // 卡池展示顺序（打乱后的 id 序）
  const [placed, setPlaced] = useState<number[]>([]); // 答案区 id 序
  const [checked, setChecked] = useState<null | boolean>(null);
  const reqId = useRef(0);

  const generate = useCallback(async () => {
    if (!image) return;
    const myReq = ++reqId.current;
    setStatus("loading");
    setChecked(null);
    setPlaced([]);
    try {
      const res = await fetch("/api/sentence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: image }),
      });
      const data = await res.json();
      if (myReq !== reqId.current) return; // 已被新的请求取代
      const chunks: string[] = Array.isArray(data?.chunks) ? data.chunks : [];
      if (chunks.length < 2) throw new Error("词组不足");
      const nextTiles = chunks.map((text, id) => ({ id, text }));
      setTiles(nextTiles);
      setCorrect(chunks);
      setOrder(shuffle(nextTiles.map((t) => t.id)));
      setMocked(!!data?.mocked);
      setStatus("ready");
    } catch {
      if (myReq !== reqId.current) return;
      setStatus("error");
    }
  }, [image]);

  // 生图结果变化时自动生成一句新的练习
  useEffect(() => {
    generate();
  }, [generate]);

  const pool = order.filter((id) => !placed.includes(id));
  const allPlaced = placed.length === tiles.length && tiles.length > 0;
  const isCorrect =
    allPlaced && placed.every((id, idx) => tiles[id]?.text === correct[idx]);

  const place = (id: number) => {
    setChecked(null);
    setPlaced((p) => (p.includes(id) ? p : [...p, id]));
  };
  const take = (id: number) => {
    setChecked(null);
    setPlaced((p) => p.filter((x) => x !== id));
  };
  const reshuffle = () => {
    setChecked(null);
    setPlaced([]);
    setOrder(shuffle(tiles.map((t) => t.id)));
  };
  const check = () => setChecked(isCorrect);

  if (status === "idle" || (status === "loading" && tiles.length === 0)) {
    return (
      <div className="aspect-[5/2] min-h-[180px] rounded-4xl grid place-items-center hairline bg-white/40">
        <div className="flex flex-col items-center gap-3 text-ink-muted">
          {status === "loading" ? (
            <>
              <Spinner className="w-8 h-8 text-brand-500" />
              <p className="text-sm">正在看图编一句话…</p>
            </>
          ) : (
            <p className="text-sm text-ink-faint">先在上方生成简笔绘本，即可开始组句练习</p>
          )}
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-4xl hairline bg-white/40 p-6 text-center space-y-3">
        <p className="text-sm text-ink-muted">没能编出句子，再试一次吧</p>
        <Button variant="outline" onClick={generate}>
          重新生成
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          点下面的词卡，按顺序拼成一句完整的话 ✨
        </p>
        <div className="flex items-center gap-2">
          {mocked && <Badge tone="warn">Mock 兜底</Badge>}
          <Badge tone="brand">{correct.length} 个词组</Badge>
        </div>
      </div>

      {/* 答案区 */}
      <div
        className={cx(
          "min-h-[64px] rounded-3xl p-3 flex flex-wrap items-center gap-2.5 transition-colors",
          checked === true
            ? "bg-mint/15 ring-2 ring-mint/50"
            : checked === false
            ? "bg-peach/20 ring-2 ring-peach/60"
            : "bg-black/[0.04] hairline"
        )}
      >
        {placed.length === 0 && (
          <span className="text-sm text-ink-faint px-2">这里组成句子…</span>
        )}
        {placed.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => take(id)}
            className="px-4 h-11 rounded-2xl bg-white text-ink font-semibold shadow-soft hairline active:scale-95 transition-transform"
          >
            {tiles[id]?.text}
          </button>
        ))}
      </div>

      {/* 词卡池 */}
      <div className="min-h-[56px] flex flex-wrap items-center gap-2.5">
        {pool.length === 0 ? (
          <span className="text-sm text-ink-faint px-2">词卡都用上啦，点「检查」看看吧</span>
        ) : (
          pool.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => place(id)}
              className="px-4 h-11 rounded-2xl bg-brand-100 text-brand-600 font-semibold hover:bg-brand-200 active:scale-95 transition-all"
            >
              {tiles[id]?.text}
            </button>
          ))
        )}
      </div>

      {/* 反馈 */}
      {checked === true && (
        <div className="rounded-3xl bg-mint/15 px-4 py-3 text-emerald-700 text-sm font-semibold">
          🎉 太棒了！你拼对啦：{correct.join("")}
        </div>
      )}
      {checked === false && (
        <div className="rounded-3xl bg-peach/20 px-4 py-3 text-amber-700 text-sm font-semibold">
          再想想顺序，把词卡调整一下 💪
        </div>
      )}

      {/* 操作 */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={check} disabled={!allPlaced} size="lg">
          ✅ 检查
        </Button>
        <Button variant="outline" onClick={reshuffle}>
          🔀 打乱重玩
        </Button>
        <Button variant="ghost" onClick={generate}>
          🪄 换一句
        </Button>
      </div>
    </div>
  );
}

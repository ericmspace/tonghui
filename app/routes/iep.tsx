import { useMemo, useState } from "react";
import type { MetaFunction } from "@remix-run/node";
import { AppShell } from "~/components/layout/AppShell";
import { Badge, Button, Panel, Segmented, Spinner } from "~/components/ui/primitives";
import { RadarChart, type RadarDatum } from "~/components/charts/RadarChart";
import { TrendChart, DIM_COLORS, type TrendRow } from "~/components/charts/TrendChart";
import { ImuChart, TrajectoryPath, EmotionArea } from "~/components/charts/TrajectoryChart";
import { useRole } from "~/lib/role";
import { cx } from "~/lib/cx";

export const meta: MetaFunction = () => [{ title: "IEP 数据分析 · 童绘" }];

/* ---------------- 表现性指标（非绘画技法，而是从画作可能体现的特质） ---------------- */
const DIMS = ["探索欲", "色彩丰富度", "画幅利用率", "专注持续", "情绪表达", "细节复杂度"];
const DIM_DESC: Record<string, string> = {
  探索欲: "主动尝试新方向、新元素的倾向（探索模式使用、画面多样性）",
  色彩丰富度: "使用的不同颜色数量与搭配的丰富程度",
  画幅利用率: "画面铺展占据画布的比例（留白 ↔ 铺满）",
  专注持续: "单次创作的专注时长与笔触连贯性",
  情绪表达: "画面所传达的情绪信号强度与积极度",
  细节复杂度: "线条与元素的精细与层次程度",
};

const CHILDREN = [
  { id: "c1", name: "乐乐", age: 6, tag: "ADHD" },
  { id: "c2", name: "朵朵", age: 7, tag: "ASD" },
  { id: "c3", name: "阿福", age: 5, tag: "ADHD" },
] as const;

type Session = { date: string; scores: number[] }; // scores 对齐 DIMS 顺序

// 同一儿童的多次绘画（按时间），用于趋势分析
const INIT_SESSIONS: Record<string, Session[]> = {
  c1: [
    { date: "03-02", scores: [40, 35, 50, 30, 45, 38] },
    { date: "03-20", scores: [48, 44, 55, 38, 52, 44] },
    { date: "04-08", scores: [55, 52, 60, 46, 58, 50] },
    { date: "04-26", scores: [63, 60, 66, 52, 64, 57] },
    { date: "05-15", scores: [72, 68, 70, 58, 70, 63] },
  ],
  c2: [
    { date: "03-05", scores: [30, 62, 45, 55, 40, 48] },
    { date: "03-22", scores: [34, 68, 48, 60, 44, 52] },
    { date: "04-10", scores: [38, 74, 50, 66, 47, 55] },
    { date: "04-28", scores: [42, 78, 53, 70, 50, 58] },
    { date: "05-16", scores: [46, 82, 56, 73, 52, 60] },
  ],
  c3: [
    { date: "03-03", scores: [58, 50, 62, 36, 60, 55] },
    { date: "03-21", scores: [62, 55, 66, 40, 64, 60] },
    { date: "04-09", scores: [68, 60, 70, 44, 70, 66] },
    { date: "04-27", scores: [72, 63, 74, 47, 76, 70] },
    { date: "05-15", scores: [78, 66, 78, 50, 82, 74] },
  ],
};

const IMU = Array.from({ length: 40 }, (_, i) => ({
  t: i * 50,
  ax: +(Math.sin(i / 3) * 0.6 + Math.sin(i / 7) * 0.3).toFixed(3),
  ay: +(Math.cos(i / 4) * 0.5).toFixed(3),
  gz: +(Math.sin(i / 5 + 1) * 0.4).toFixed(3),
}));
const TRAJ = Array.from({ length: 80 }, (_, i) => {
  const a = i / 79;
  return { x: Math.cos(a * Math.PI * 3) * (1 - a) + a * 1.6, y: Math.sin(a * Math.PI * 4) * (0.6 + a * 0.3) };
});

type Emotion = {
  primary: string;
  confidence: number;
  note: string;
  distribution: { label: string; value: number }[];
  mocked: boolean;
};

export default function IepPage() {
  const { isTeacher } = useRole();
  const [mode, setMode] = useState<"detail" | "analysis">("analysis");
  const [childId, setChildId] = useState<string>("c1");
  const [sessions, setSessions] = useState<Record<string, Session[]>>(INIT_SESSIONS);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [draft, setDraft] = useState<number[] | null>(null);
  const [emotion, setEmotion] = useState<Emotion | null>(null);
  const [emoLoading, setEmoLoading] = useState(false);

  const child = CHILDREN.find((c) => c.id === childId)!;
  const list = sessions[childId];
  const first = list[0].scores;
  const latest = list[list.length - 1].scores;

  const radarData: RadarDatum[] = useMemo(
    () => DIMS.map((d, i) => ({ dimension: d, 最新: latest[i], 首次: first[i] })),
    [first, latest]
  );
  const trendRows: TrendRow[] = useMemo(
    () => list.map((s) => ({ date: s.date, ...Object.fromEntries(DIMS.map((d, i) => [d, s.scores[i]])) })),
    [list]
  );

  // 趋势洞察：对比首次→最新，找出提升最大与待加强
  const insight = useMemo(() => {
    const deltas = DIMS.map((d, i) => ({ d, delta: latest[i] - first[i] }));
    const up = [...deltas].sort((a, b) => b.delta - a.delta)[0];
    const low = DIMS.map((d, i) => ({ d, v: latest[i] })).sort((a, b) => a.v - b.v)[0];
    return { up, low };
  }, [first, latest]);

  const switchChild = (id: string) => {
    setChildId(id);
    setEmotion(null);
    setDraft(null);
    setHighlight(null);
  };

  const saveSession = () => {
    if (!draft) return;
    const d = new Date();
    const date = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setSessions((s) => ({ ...s, [childId]: [...s[childId], { date, scores: draft }] }));
    setDraft(null);
  };

  const runEmotion = async () => {
    setEmoLoading(true);
    try {
      const summary = `儿童 ${child.name}（${child.tag}）书写过程：IMU 加速度波动中等，存在 2 次明显停顿，握笔力度平稳。`;
      const data = await fetch("/api/emotion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
      }).then((r) => r.json());
      setEmotion(data);
    } finally {
      setEmoLoading(false);
    }
  };

  return (
    <AppShell
      title="IEP 数据分析"
      subtitle="个别化教育计划 · 表现性指标 / 成长趋势 / IMU 与情绪"
      actions={
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "analysis", label: "成长分析" },
            { value: "detail", label: "明细数值" },
          ]}
        />
      }
    >
      {/* 儿童选择 */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Badge tone={isTeacher ? "brand" : "sky"}>
          {isTeacher ? "👩‍🏫 教师模式 · 可新增观察会话" : "🛡️ 管理员模式 · 全部数据只读"}
        </Badge>
        <div className="flex items-center gap-2">
          {CHILDREN.map((c) => (
            <button
              key={c.id}
              onClick={() => switchChild(c.id)}
              className={cx(
                "px-3.5 h-9 rounded-full text-sm font-semibold transition flex items-center gap-1.5",
                childId === c.id ? "bg-white shadow-soft text-ink" : "bg-black/[0.04] text-ink-muted hover:text-ink-soft"
              )}
            >
              🧒 {c.name}
              <span className="text-[10px] text-ink-faint">
                {c.tag} · {list && c.id === childId ? list.length : sessions[c.id].length} 次
              </span>
            </button>
          ))}
        </div>
      </div>

      {mode === "analysis" ? (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6 items-start">
            {/* 成长快照雷达 */}
            <Panel title="成长快照" subtitle={`${child.name} · 最新一次 vs 首次观察`}>
              <RadarChart
                data={radarData}
                series={[
                  { key: "最新", color: "#ff6b2c" },
                  { key: "首次", color: "#5ab0ff" },
                ]}
              />
            </Panel>

            {/* 成长趋势 */}
            <Panel
              title="成长趋势"
              subtitle="同一儿童不同绘画随时间的指标变化"
              right={
                highlight ? (
                  <Button size="sm" variant="ghost" onClick={() => setHighlight(null)}>
                    显示全部
                  </Button>
                ) : null
              }
            >
              <TrendChart data={trendRows} dims={DIMS} highlight={highlight} />
              <div className="flex flex-wrap gap-2 mt-3">
                {DIMS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setHighlight(highlight === d ? null : d)}
                    className={cx(
                      "px-2.5 py-1 rounded-full text-xs font-semibold transition flex items-center gap-1.5",
                      highlight === d ? "text-white" : "bg-black/[0.04] text-ink-muted hover:text-ink-soft"
                    )}
                    style={highlight === d ? { background: DIM_COLORS[d] } : undefined}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: DIM_COLORS[d] }} />
                    {d}
                  </button>
                ))}
              </div>
            </Panel>
          </div>

          {/* 趋势洞察 + 指标说明 */}
          <div className="grid lg:grid-cols-2 gap-6 items-start">
            <Panel title="趋势洞察" subtitle="基于首次→最新的变化自动总结">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="rounded-3xl bg-mint/10 hairline p-5">
                  <p className="text-xs text-emerald-700 font-semibold">📈 进步最明显</p>
                  <p className="text-2xl font-extrabold text-ink mt-1">{insight.up.d}</p>
                  <p className="text-sm text-emerald-700 mt-1">较首次 +{insight.up.delta} 分</p>
                </div>
                <div className="rounded-3xl bg-brand-100/60 hairline p-5">
                  <p className="text-xs text-brand-600 font-semibold">🎯 建议加强</p>
                  <p className="text-2xl font-extrabold text-ink mt-1">{insight.low.d}</p>
                  <p className="text-sm text-brand-600 mt-1">当前 {insight.low.v} 分，可重点引导</p>
                </div>
              </div>
              <p className="text-sm text-ink-muted mt-4 leading-relaxed">
                {child.name} 在 <strong>{insight.up.d}</strong> 维度成长显著，反映其在绘本创作中逐步建立的主动性；
                建议结合 <strong>{insight.low.d}</strong> 设计针对性的引导活动，巩固个别化教育目标。
              </p>
            </Panel>

            <Panel title="指标说明" subtitle="每个雷达维度反映孩子的什么">
              <ul className="space-y-2.5">
                {DIMS.map((d) => (
                  <li key={d} className="flex gap-3">
                    <span className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ background: DIM_COLORS[d] }} />
                    <div>
                      <span className="font-semibold text-ink">{d}</span>
                      <span className="text-sm text-ink-muted"> —— {DIM_DESC[d]}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          {/* 教师录入新会话 */}
          <Panel
            title="新增观察会话"
            subtitle={isTeacher ? "录入本次绘画的指标评分，纳入趋势分析" : "仅教师模式可录入"}
            right={
              isTeacher && !draft ? (
                <Button size="sm" variant="soft" onClick={() => setDraft([...latest])}>
                  ＋ 录入本次评分
                </Button>
              ) : null
            }
          >
            {!isTeacher ? (
              <p className="text-sm text-ink-faint">🔒 管理员模式为只读。切换到「教师」身份可录入新一次观察评分。</p>
            ) : !draft ? (
              <p className="text-sm text-ink-muted">点击右上「录入本次评分」，以最近一次为基础调整六维指标后保存为新会话。</p>
            ) : (
              <div className="space-y-3">
                {DIMS.map((d, i) => (
                  <div key={d}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-ink-soft font-medium">{d}</span>
                      <span className="text-ink-muted tabular-nums">{draft[i]}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={draft[i]}
                      onChange={(e) => {
                        const next = [...draft];
                        next[i] = Number(e.target.value);
                        setDraft(next);
                      }}
                      className="w-full accent-brand-500"
                    />
                  </div>
                ))}
                <div className="flex gap-3 pt-2">
                  <Button onClick={saveSession}>✓ 保存为新会话（今天）</Button>
                  <Button variant="ghost" onClick={() => setDraft(null)}>
                    取消
                  </Button>
                </div>
              </div>
            )}
          </Panel>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <Panel title="IMU 信号" subtitle="加速度 / 角速度随时间（笔端六轴）">
            <ImuChart data={IMU} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {[
                { k: "速度积分", v: "12.4", u: "m/s" },
                { k: "笔画数", v: "37", u: "笔" },
                { k: "平均握力", v: "0.62", u: "N" },
                { k: "书写时长", v: "4.8", u: "min" },
              ].map((s) => (
                <div key={s.k} className="rounded-2xl bg-white/70 hairline p-3 text-center">
                  <p className="text-xs text-ink-muted">{s.k}</p>
                  <p className="text-xl font-extrabold text-ink mt-0.5">
                    {s.v}
                    <span className="text-xs font-semibold text-ink-faint ml-0.5">{s.u}</span>
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="书写轨迹" subtitle="由 IMU 二次积分还原的笔尖路径">
            <TrajectoryPath points={TRAJ} />
            <div className="mt-3 flex items-center gap-3 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-mint" /> 起点
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-500" /> 终点
              </span>
            </div>
          </Panel>

          <Panel
            title="情绪识别"
            subtitle="通过 chat JSON 工程，从书写过程推断情绪"
            right={emotion?.mocked ? <Badge tone="warn">Mock</Badge> : emotion ? <Badge tone="mint">已分析</Badge> : null}
            className="lg:col-span-2"
          >
            {!emotion && (
              <div className="flex items-center gap-4">
                <Button onClick={runEmotion} loading={emoLoading}>
                  🧠 运行情绪识别
                </Button>
                <p className="text-sm text-ink-muted">基于 {child.name} 当前书写会话进行分析</p>
              </div>
            )}
            {emotion && (
              <div className="grid md:grid-cols-2 gap-5 items-center">
                <div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-extrabold text-brand-500">{emotion.primary}</span>
                    <span className="text-sm text-ink-muted">置信度 {(emotion.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-sm text-ink-soft mt-3 leading-relaxed">{emotion.note}</p>
                  <Button variant="ghost" size="sm" className="mt-3" onClick={runEmotion} loading={emoLoading}>
                    重新分析
                  </Button>
                </div>
                <EmotionArea data={emotion.distribution} />
              </div>
            )}
          </Panel>
        </div>
      )}
    </AppShell>
  );
}

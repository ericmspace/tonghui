import { useState } from "react";
import { Link, useLoaderData, useRevalidator } from "@remix-run/react";
import type { MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { AppShell } from "~/components/layout/AppShell";
import { Badge, Button, Panel, Segmented, Spinner } from "~/components/ui/primitives";
import { Modal } from "~/components/ui/Modal";
import { listRecords, assetUrl, type CreationType } from "~/services/db.server";
import { cx } from "~/lib/cx";

export const meta: MetaFunction = () => [{ title: "创作记录 · 童绘" }];

export async function loader() {
  const records = listRecords().map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    status: r.status,
    mocked: r.mocked ?? false,
    imageUrl: assetUrl(r.imageAssetId),
    storyPreview: r.story ? r.story.story.slice(0, 60) : undefined,
    character: r.story?.character?.name,
    video: r.video,
  }));
  return json({ records });
}

const TYPE_LABEL: Record<CreationType, string> = { image: "绘本", story: "故事", video: "视频" };
const TYPE_ICON: Record<CreationType, string> = { image: "🎨", story: "📖", video: "🎬" };

function fmt(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function statusBadge(status: string) {
  const map: Record<string, { tone: any; text: string }> = {
    done: { tone: "mint", text: "已完成" },
    succeeded: { tone: "mint", text: "已完成" },
    pending: { tone: "warn", text: "生成中" },
    running: { tone: "warn", text: "生成中" },
    failed: { tone: "neutral", text: "失败" },
  };
  const s = map[status] ?? { tone: "neutral", text: status };
  return <Badge tone={s.tone}>{s.text}</Badge>;
}

export default function Library() {
  const { records } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [filter, setFilter] = useState<"all" | CreationType>("all");
  const [refreshing, setRefreshing] = useState<string | null>(null);

  // 回溯
  const [tracing, setTracing] = useState(false);
  const [trace, setTrace] = useState<any | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);

  const shown = records.filter((r) => filter === "all" || r.type === filter);

  const refreshVideo = async (taskId?: string) => {
    if (!taskId) return;
    setRefreshing(taskId);
    try {
      await fetch(`/api/video/status?taskId=${encodeURIComponent(taskId)}`);
      revalidator.revalidate();
    } finally {
      setRefreshing(null);
    }
  };

  const onTraceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setTracing(true);
    setTrace(null);
    setTraceOpen(true);
    const r = new FileReader();
    r.onload = async () => {
      try {
        const res = await fetch("/api/steg", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "extract", pngBase64: String(r.result) }),
        }).then((x) => x.json());
        const payload = res.ok ? res.payload : null;
        const matched = payload?.recordId ? records.find((x) => x.id === payload.recordId) : null;
        setTrace({ payload, matched, found: !!payload, uploaded: String(r.result) });
      } finally {
        setTracing(false);
      }
    };
    r.readAsDataURL(f);
    e.target.value = "";
  };

  return (
    <AppShell
      title="创作记录"
      subtitle="每一次生成经历的归档，与隐写 PNG 的回溯入口"
      actions={
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "全部" },
            { value: "image", label: "绘本" },
            { value: "story", label: "故事" },
            { value: "video", label: "视频" },
          ]}
        />
      }
    >
      {/* 回溯入口 */}
      <Panel
        title="🧬 隐写回溯"
        subtitle="上传一张隐写 PNG，自动比对库中记录，还原生成时间与角色信息"
        className="mb-6"
        right={
          <label className="inline-flex items-center gap-2 rounded-full bg-brand-500 text-white px-5 h-11 font-semibold shadow-glow cursor-pointer hover:bg-brand-600 transition">
            📥 上传 PNG 回溯
            <input type="file" accept="image/png" className="hidden" onChange={onTraceFile} />
          </label>
        }
      >
        <p className="text-sm text-ink-muted">
          讲故事时下载的隐写 PNG 内含记录编号与生成时间。上传后若命中库中记录，会展示原图、生成时刻与完整故事/角色。
        </p>
      </Panel>

      {/* 记录网格 */}
      {shown.length === 0 ? (
        <div className="glass rounded-4xl p-12 text-center text-ink-faint">
          <div className="text-5xl mb-3">🗂️</div>
          <p>还没有生成记录。去 <Link to="/capture" className="text-brand-500 font-semibold">拍照绘本</Link> 或 <Link to="/story" className="text-brand-500 font-semibold">讲故事</Link> 创建第一条吧。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {shown.map((r) => (
            <div key={r.id} className="glass rounded-4xl overflow-hidden hover:shadow-lift transition-all">
              <div className="aspect-[4/3] bg-white relative">
                {r.imageUrl ? (
                  <img src={r.imageUrl} alt={r.title} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-4xl text-ink-faint">
                    {TYPE_ICON[r.type as CreationType]}
                  </div>
                )}
                <div className="absolute top-2 left-2 flex gap-1.5">
                  <Badge tone="sky">{TYPE_ICON[r.type as CreationType]} {TYPE_LABEL[r.type as CreationType]}</Badge>
                  {r.mocked && <Badge tone="warn">Mock</Badge>}
                </div>
                {r.type === "video" && (
                  <div className="absolute top-2 right-2">{statusBadge(r.status)}</div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-bold text-ink truncate">{r.title}</h3>
                <p className="text-xs text-ink-faint mt-0.5">生成于 {fmt(r.createdAt)}</p>
                {r.storyPreview && (
                  <p className="text-xs text-ink-muted mt-2 line-clamp-2">{r.storyPreview}…</p>
                )}
                {r.type === "video" && (
                  <div className="mt-3 flex items-center gap-2">
                    {r.video?.videoUrl && (r.status === "succeeded" || r.status === "done") ? (
                      <a
                        href={r.video.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-mint/15 text-emerald-700 px-3 h-8 text-sm font-semibold"
                      >
                        ▶ 观看
                      </a>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={refreshing === r.video?.taskId}
                        onClick={() => refreshVideo(r.video?.taskId)}
                      >
                        🔄 刷新状态
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 回溯结果弹窗 */}
      <Modal open={traceOpen} onClose={() => setTraceOpen(false)} title="🧬 隐写回溯结果" className="max-w-lg">
        {tracing ? (
          <div className="flex items-center gap-3 text-ink-muted py-6">
            <Spinner className="w-6 h-6 text-brand-500" /> 正在解析隐写信息…
          </div>
        ) : !trace?.found ? (
          <div className="text-center py-6 text-ink-muted">
            <div className="text-4xl mb-2">🔍</div>
            未在该 PNG 中发现童绘隐写信息。
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-3">
              <img
                src={trace.matched?.imageUrl ?? trace.uploaded}
                alt="回溯图"
                className="w-24 h-24 rounded-2xl object-contain bg-white hairline"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {trace.matched ? <Badge tone="mint">✓ 命中库中记录</Badge> : <Badge tone="warn">仅隐写信息</Badge>}
                </div>
                <h3 className="font-bold text-ink mt-1 truncate">
                  {trace.payload.title ?? trace.matched?.title ?? "未命名"}
                </h3>
                <p className="text-xs text-ink-muted mt-1">
                  ⏱ 生成时间：{trace.payload.generatedAt ? fmt(trace.payload.generatedAt) : trace.matched ? fmt(trace.matched.createdAt) : "未知"}
                </p>
                {trace.payload.recordId && (
                  <p className="text-[11px] text-ink-faint mt-0.5">记录编号：{trace.payload.recordId.slice(0, 8)}…</p>
                )}
              </div>
            </div>

            {trace.payload.character && (
              <div className="rounded-2xl bg-white/70 hairline p-3">
                <p className="text-sm font-bold text-ink">🧸 {trace.payload.character.name}</p>
                <p className="text-xs text-ink-muted mt-1">{trace.payload.character.description}</p>
              </div>
            )}
            {trace.payload.story && (
              <div className="rounded-2xl bg-cream/60 hairline p-3 max-h-40 overflow-auto">
                <p className="text-[13px] leading-6 text-ink-soft whitespace-pre-line">{trace.payload.story}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </AppShell>
  );
}

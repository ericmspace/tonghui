import { useEffect, useRef, useState } from "react";
import { Link } from "@remix-run/react";
import type { MetaFunction } from "@remix-run/node";
import { AppShell } from "~/components/layout/AppShell";
import { Badge, Button, Panel, Spinner } from "~/components/ui/primitives";
import { sleep } from "~/lib/utils";

export const meta: MetaFunction = () => [{ title: "绘本生视频 · 童绘" }];

const VIDEO_KEY = "th_video_image";
type Phase = "idle" | "submitting" | "polling" | "done" | "error";

export default function VideoPage() {
  const [image, setImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("让画面里的角色温柔地动起来，适合儿童观看");
  const [phase, setPhase] = useState<Phase>("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [mocked, setMocked] = useState(false);
  const [log, setLog] = useState<string>("");
  const cancelled = useRef(false);

  useEffect(() => {
    const img = sessionStorage.getItem(VIDEO_KEY);
    if (img) setImage(img);
    return () => {
      cancelled.current = true;
    };
  }, []);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setImage(String(r.result));
    r.readAsDataURL(f);
  };

  const generate = async () => {
    if (!image) return;
    cancelled.current = false;
    setVideoUrl(null);
    setPhase("submitting");
    setLog("提交图生视频任务…");
    try {
      const sub = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: image, prompt }),
      }).then((r) => r.json());

      if (sub.error) throw new Error(sub.error);
      setMocked(!!sub.mocked);
      setPhase("polling");
      setLog(`任务已提交（task: ${sub.taskId}），正在生成…`);

      // 轮询
      for (let i = 0; i < 30 && !cancelled.current; i++) {
        const st = await fetch(`/api/video/status?taskId=${encodeURIComponent(sub.taskId)}`).then((r) =>
          r.json()
        );
        if (st.status === "SUCCEEDED" && st.videoUrl) {
          setVideoUrl(st.videoUrl);
          setMocked(!!st.mocked);
          setPhase("done");
          setLog("视频生成完成 🎉");
          return;
        }
        if (st.status === "FAILED") throw new Error(st.message || "任务失败");
        setLog(`生成中…（第 ${i + 1} 次轮询，状态：${st.status}）`);
        await sleep(2000);
      }
      if (!cancelled.current) throw new Error("生成超时");
    } catch (e) {
      setPhase("error");
      setLog(e instanceof Error ? e.message : "生成失败");
    }
  };

  const busy = phase === "submitting" || phase === "polling";

  return (
    <AppShell
      title="绘本生视频"
      subtitle="把一张绘本图变成会动的小动画（图生视频 · 720P · 5s）"
      actions={
        <Link
          to="/explore"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-mint to-sky text-white px-5 h-11 font-semibold shadow-soft hover:-translate-y-0.5 transition"
        >
          🧭 进入探索模式
        </Link>
      }
    >
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <Panel title="① 选择首帧" subtitle="来自画板作品，或上传一张图">
          <div className="aspect-video rounded-4xl overflow-hidden hairline bg-white grid place-items-center mb-4">
            {image ? (
              <img src={image} alt="首帧" className="w-full h-full object-contain" />
            ) : (
              <div className="text-center text-ink-faint">
                <div className="text-5xl mb-2">🎞️</div>
                <p className="text-sm">尚未选择图片</p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="inline-flex items-center gap-2 rounded-full hairline bg-white/70 px-5 h-11 font-semibold text-ink-soft cursor-pointer hover:bg-white transition">
              🖼️ 上传图片
              <input type="file" accept="image/*" className="hidden" onChange={onFile} />
            </label>
            <Link
              to="/canvas"
              className="inline-flex items-center gap-2 rounded-full bg-brand-100 text-brand-600 px-5 h-11 font-semibold hover:bg-brand-200 transition"
            >
              🖍️ 去画板创作
            </Link>
          </div>

          <div className="mt-5">
            <label className="text-sm font-medium text-ink-soft">动效描述（Prompt）</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              className="mt-2 w-full rounded-2xl hairline bg-white/70 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200 resize-none"
            />
          </div>

          <Button onClick={generate} loading={busy} disabled={!image} size="lg" className="mt-4 w-full">
            🎬 生成视频
          </Button>
        </Panel>

        <Panel
          title="② 生成结果"
          subtitle="异步任务，提交后自动轮询"
          right={mocked && phase === "done" ? <Badge tone="warn">Mock 占位</Badge> : phase === "done" ? <Badge tone="mint">完成</Badge> : null}
        >
          <div className="aspect-video rounded-4xl overflow-hidden hairline bg-ink/5 grid place-items-center">
            {phase === "done" && videoUrl ? (
              <video src={videoUrl} controls autoPlay loop className="w-full h-full object-contain bg-black" />
            ) : busy ? (
              <div className="flex flex-col items-center gap-3 text-ink-muted">
                <Spinner className="w-8 h-8 text-brand-500" />
                <p className="text-sm">{log}</p>
              </div>
            ) : phase === "error" ? (
              <div className="text-center text-ink-muted px-6">
                <div className="text-4xl mb-2">😿</div>
                <p className="text-sm">{log}</p>
              </div>
            ) : (
              <div className="text-center text-ink-faint">
                <div className="text-5xl mb-2">🎬</div>
                <p className="text-sm">生成的视频将在此播放</p>
              </div>
            )}
          </div>
          {log && phase !== "idle" && (
            <p className="mt-3 text-xs text-ink-faint">{log}</p>
          )}
          {phase !== "idle" && (
            <p className="mt-2 text-xs text-ink-faint">
              ⏱ 视频生成耗时较长，本次任务已存入
              <Link to="/library" className="text-brand-500 font-semibold mx-1">创作记录</Link>
              ，离开后可随时回来刷新进度、续看成片。
            </p>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}

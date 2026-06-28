import { useEffect, useRef, useState } from "react";
import { Link } from "@remix-run/react";
import type { MetaFunction } from "@remix-run/node";
import { AppShell } from "~/components/layout/AppShell";
import { Badge, Button, Panel, Spinner } from "~/components/ui/primitives";
import { downloadBlob } from "~/lib/utils";

export const meta: MetaFunction = () => [{ title: "看图讲故事 · 童绘" }];

const STORY_KEY = "th_story_image";

type Story = {
  title: string;
  description: string;
  story: string;
  character: { name: string; description: string; personality?: string; scenario?: string; tags?: string[] };
  mocked: boolean;
  recordId?: string;
  createdAt?: string;
};

function fmtTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 把任意图片 dataURL 栅格化为 PNG dataURL（隐写需 PNG 容器） */
function rasterizeToPng(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width || 1024;
      c.height = img.height || 768;
      const ctx = c.getContext("2d");
      if (!ctx) return reject(new Error("canvas 不可用"));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });
}

export default function StoryPage() {
  const [image, setImage] = useState<string | null>(null);
  const [story, setStory] = useState<Story | null>(null);
  const [generating, setGenerating] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [embedding, setEmbedding] = useState(false);
  const [extracted, setExtracted] = useState<any | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const img = sessionStorage.getItem(STORY_KEY);
    if (img) setImage(img);
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      setImage(String(r.result));
      setStory(null);
    };
    r.readAsDataURL(f);
  };

  const generate = async () => {
    if (!image) return;
    setGenerating(true);
    setStory(null);
    try {
      const data = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: image }),
      }).then((r) => r.json());
      setStory(data);
    } finally {
      setGenerating(false);
    }
  };

  const speak = async () => {
    if (!story) return;
    if (speaking) {
      window.speechSynthesis?.cancel();
      audioRef.current?.pause();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    const text = `${story.title}。${story.story}`;
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }).then((r) => r.json());

      if (res.mode === "url" && res.audioUrl) {
        const audio = new Audio(res.audioUrl);
        audioRef.current = audio;
        audio.onended = () => setSpeaking(false);
        await audio.play();
      } else {
        // 本地浏览器朗读兜底
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "zh-CN";
        u.rate = 0.95;
        u.pitch = 1.05;
        u.onend = () => setSpeaking(false);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      }
    } catch {
      setSpeaking(false);
    }
  };

  const downloadStego = async () => {
    if (!image || !story) return;
    setEmbedding(true);
    try {
      const png = await rasterizeToPng(image);
      const payload = {
        spec: "tonghui-storybook/v1",
        recordId: story.recordId, // 关联库中记录，便于上传回溯
        generatedAt: story.createdAt ?? new Date().toISOString(), // 故事生成时间
        title: story.title,
        description: story.description,
        story: story.story,
        character: story.character,
      };
      const res = await fetch("/api/steg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "embed", pngBase64: png, payload }),
      }).then((r) => r.json());
      if (res.ok && res.image) downloadBlob(res.image, `${story.title}_隐写.png`);
    } finally {
      setEmbedding(false);
    }
  };

  const onExtract = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setExtracted(null);
    const r = new FileReader();
    r.onload = async () => {
      const res = await fetch("/api/steg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "extract", pngBase64: String(r.result) }),
      }).then((r) => r.json());
      setExtracted(res.ok ? res.payload : { error: "未在该 PNG 中发现隐写信息" });
    };
    r.readAsDataURL(f);
  };

  return (
    <AppShell title="看图讲故事" subtitle="AI 看图编织绘本故事并朗读，故事与角色隐写进 PNG 保存">
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* 左：图片与操作 */}
        <div className="space-y-6">
          <Panel title="① 选择绘本图" subtitle="来自画板作品或上传">
            <div className="aspect-[4/3] rounded-4xl overflow-hidden hairline bg-white grid place-items-center mb-4">
              {image ? (
                <img src={image} alt="绘本" className="w-full h-full object-contain" />
              ) : (
                <div className="text-center text-ink-faint">
                  <div className="text-5xl mb-2">📖</div>
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
                🖍️ 去画板
              </Link>
              <Button onClick={generate} loading={generating} disabled={!image}>
                ✨ 生成故事
              </Button>
            </div>
          </Panel>

          {/* 隐写提取工具 */}
          <Panel title="🔍 隐写提取" subtitle="上传一张隐写 PNG，还原其中的故事与角色">
            <label className="inline-flex items-center gap-2 rounded-full hairline bg-white/70 px-5 h-11 font-semibold text-ink-soft cursor-pointer hover:bg-white transition">
              📥 选择 PNG 提取
              <input type="file" accept="image/png" className="hidden" onChange={onExtract} />
            </label>
            {extracted && (
              <pre className="mt-4 text-xs bg-black/[0.04] rounded-2xl p-4 overflow-auto max-h-56 text-ink-soft">
                {JSON.stringify(extracted, null, 2)}
              </pre>
            )}
          </Panel>
        </div>

        {/* 右：故事结果 */}
        <Panel
          title="② 绘本故事"
          subtitle="可朗读，可隐写下载"
          right={story?.mocked ? <Badge tone="warn">Mock</Badge> : story ? <Badge tone="mint">已生成</Badge> : null}
        >
          {!story && !generating && (
            <div className="aspect-[4/3] rounded-4xl grid place-items-center hairline bg-white/40 text-ink-faint text-center">
              <div>
                <div className="text-5xl mb-2">🪄</div>
                <p className="text-sm">生成的故事将在此呈现</p>
              </div>
            </div>
          )}
          {generating && (
            <div className="aspect-[4/3] rounded-4xl grid place-items-center hairline bg-white/40">
              <div className="flex flex-col items-center gap-3 text-ink-muted">
                <Spinner className="w-8 h-8 text-brand-500" />
                <p className="text-sm">AI 正在看图编故事…</p>
              </div>
            </div>
          )}
          {story && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-extrabold text-ink">{story.title}</h3>
                {story.createdAt && (
                  <p className="text-[11px] text-ink-faint mt-1">⏱ 生成于 {fmtTime(story.createdAt)}</p>
                )}
                <p className="text-xs text-ink-muted mt-1">{story.description}</p>
              </div>

              <div className="rounded-3xl bg-cream/60 hairline p-4 max-h-64 overflow-auto">
                {story.story.split("\n").map((p, i) =>
                  p.trim() ? (
                    <p key={i} className="text-[15px] leading-7 text-ink-soft mb-2">
                      {p}
                    </p>
                  ) : null
                )}
              </div>

              {/* 角色卡 */}
              <div className="rounded-3xl bg-white/70 hairline p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🧸</span>
                  <span className="font-bold text-ink">{story.character.name}</span>
                  {story.character.tags?.map((t) => (
                    <Badge key={t} tone="lavender">
                      {t}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-ink-muted">{story.character.description}</p>
              </div>

              <div className="flex flex-wrap gap-3 pt-1">
                <Button onClick={speak} variant={speaking ? "soft" : "primary"}>
                  {speaking ? "⏹️ 停止朗读" : "🔊 朗读故事"}
                </Button>
                <Button onClick={downloadStego} loading={embedding} variant="outline">
                  🧬 下载隐写 PNG
                </Button>
              </div>
              <p className="text-xs text-ink-faint">
                隐写 PNG 会把故事、角色与<strong>生成时间</strong>写入图片的 tEXt 数据块，外观不变。
                日后在 <Link to="/library" className="text-brand-500 font-semibold">创作记录</Link> 上传即可回溯到这次创作。
              </p>
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}

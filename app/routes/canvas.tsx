import { useEffect, useRef, useState } from "react";
import { Link } from "@remix-run/react";
import type { MetaFunction } from "@remix-run/node";
import { AppShell } from "~/components/layout/AppShell";
import { DrawingCanvas, type DrawingCanvasHandle } from "~/components/canvas/DrawingCanvas";
import { Button, Badge } from "~/components/ui/primitives";
import { downloadBlob } from "~/lib/utils";

export const meta: MetaFunction = () => [{ title: "涂色画板 · 童绘" }];

const CANVAS_KEY = "th_canvas_image";
const STORY_KEY = "th_story_image";
const VIDEO_KEY = "th_video_image";

export default function CanvasPage() {
  const ref = useRef<DrawingCanvasHandle>(null);
  const [initial, setInitial] = useState<string | null>(null);
  const [fromCapture, setFromCapture] = useState(false);

  useEffect(() => {
    const img = sessionStorage.getItem(CANVAS_KEY);
    if (img) {
      setInitial(img);
      setFromCapture(true);
    }
  }, []);

  const exportPNG = () => {
    const png = ref.current?.exportPNG();
    if (png) downloadBlob(png, `童绘作品_${Date.now()}.png`);
  };

  const sendTo = (key: string, href: string) => {
    const png = ref.current?.exportPNG();
    if (png) sessionStorage.setItem(key, png);
    window.location.assign(href);
  };

  return (
    <AppShell
      title="涂色画板"
      subtitle="自由绘画与涂色，像画图软件一样创作"
      actions={
        fromCapture ? <Badge tone="mint">已载入简笔绘本</Badge> : <Badge tone="neutral">空白画布</Badge>
      }
    >
      <div className="grid lg:grid-cols-[1fr_280px] gap-6 items-start">
        <DrawingCanvas ref={ref} initialImage={initial} />

        {/* 侧栏操作 */}
        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="glass rounded-4xl p-5">
            <h3 className="font-bold text-ink mb-1">完成作品</h3>
            <p className="text-xs text-ink-muted mb-4">导出，或继续用作品生成视频与故事。</p>
            <div className="space-y-2.5">
              <Button onClick={exportPNG} className="w-full">
                ⬇️ 导出 PNG
              </Button>
              <Button variant="soft" className="w-full" onClick={() => sendTo(STORY_KEY, "/story")}>
                📖 用作品讲故事
              </Button>
              <Button variant="soft" className="w-full" onClick={() => sendTo(VIDEO_KEY, "/video")}>
                🎬 用作品生视频
              </Button>
              <Link
                to="/capture"
                className="block text-center w-full rounded-full hairline bg-white/70 text-ink-soft py-2.5 text-sm font-semibold hover:bg-white transition"
              >
                📸 重新拍照
              </Link>
            </div>
          </div>

          <div className="glass rounded-4xl p-5">
            <h3 className="font-bold text-ink mb-2">小贴士</h3>
            <ul className="text-xs text-ink-muted space-y-1.5 leading-relaxed">
              <li>🪣 选「填色」点击区域可整块上色</li>
              <li>🖌️ 拖动滑块调整笔触粗细</li>
              <li>↶ 支持多步撤销 / 重做</li>
              <li>🎨 点右下彩色按钮可自定义颜色</li>
            </ul>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

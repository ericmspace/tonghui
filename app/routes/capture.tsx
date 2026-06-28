import { useCallback, useRef, useState } from "react";
import { useNavigate } from "@remix-run/react";
import type { MetaFunction } from "@remix-run/node";
import { AppShell } from "~/components/layout/AppShell";
import { CameraCapture, type CameraCaptureHandle } from "~/components/camera/CameraCapture";
import { CameraVoiceGuidePanel } from "~/components/camera/CameraVoiceGuidePanel";
import { Button, Panel, Badge, Toggle, Spinner } from "~/components/ui/primitives";
import { Modal } from "~/components/ui/Modal";

export const meta: MetaFunction = () => [{ title: "拍照绘本 · 童绘" }];

const CANVAS_KEY = "th_canvas_image";

export default function Capture() {
  const navigate = useNavigate();
  const cameraRef = useRef<CameraCaptureHandle>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [colored, setColored] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ image: string; mocked: boolean } | null>(null);

  const captureFrame = useCallback(() => {
    return cameraRef.current?.captureFrame({ maxWidth: 192, maxHeight: 144 }) ?? null;
  }, []);

  const onCapture = (dataUrl: string) => {
    setCaptured(dataUrl);
    setResult(null);
    setConfirmOpen(true);
  };

  const doImport = async () => {
    if (!captured) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: captured, colored, mode: "coloring" }),
      });
      const data = await res.json();
      setResult({ image: data.image, mocked: data.mocked });
      setConfirmOpen(false);
    } catch {
      setResult(null);
    } finally {
      setProcessing(false);
    }
  };

  const goCanvas = () => {
    if (!result) return;
    sessionStorage.setItem(CANVAS_KEY, result.image);
    navigate("/canvas");
  };

  return (
    <AppShell title="拍照绘本" subtitle="拍摄实物 → AI 扫描简笔 → 导入画板自由涂色">
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* 左：摄像头 */}
        <Panel title="① 拍摄" subtitle="对准实物，点按拍摄一张照片">
          <div className="space-y-4">
            <CameraCapture ref={cameraRef} onCapture={onCapture} />
            <CameraVoiceGuidePanel captureFrame={captureFrame} />
          </div>
        </Panel>

        {/* 右：转换结果 */}
        <Panel
          title="② 简笔绘本"
          subtitle="AI 把照片扫描矫正为可涂色的简笔填块绘本"
          right={result?.mocked ? <Badge tone="warn">Mock 兜底</Badge> : result ? <Badge tone="mint">已生成</Badge> : null}
        >
          {!result && !processing && (
            <div className="aspect-[4/3] rounded-4xl grid place-items-center text-center hairline bg-white/40">
              <div className="text-ink-faint">
                <div className="text-5xl mb-3">🎨</div>
                <p className="text-sm">拍摄后将在此显示简笔绘本</p>
              </div>
            </div>
          )}
          {processing && (
            <div className="aspect-[4/3] rounded-4xl grid place-items-center hairline bg-white/40">
              <div className="flex flex-col items-center gap-3 text-ink-muted">
                <Spinner className="w-8 h-8 text-brand-500" />
                <p className="text-sm">正在扫描并转化为简笔绘本…</p>
              </div>
            </div>
          )}
          {result && (
            <div className="space-y-4">
              <div className="rounded-4xl overflow-hidden hairline bg-white">
                <img src={result.image} alt="简笔绘本" className="w-full" />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={goCanvas} size="lg">
                  🖍️ 进入画板涂色
                </Button>
                <Button variant="outline" onClick={() => setConfirmOpen(true)}>
                  重新转换
                </Button>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* 是否导入 弹窗 */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="是否导入这张照片？">
        {captured && (
          <div className="rounded-3xl overflow-hidden hairline mb-4">
            <img src={captured} alt="拍摄预览" className="w-full max-h-56 object-contain bg-white" />
          </div>
        )}
        <p className="text-sm text-ink-muted mb-4">
          导入后将自动「扫描为平面纸质」：去除褶皱、裁掉边缘侵入与多余留白，转为简笔填块绘本。
        </p>
        <div className="flex items-center justify-between rounded-2xl bg-black/[0.04] px-4 py-3 mb-5">
          <span className="text-sm font-medium text-ink-soft">同时为绘本上色</span>
          <Toggle checked={colored} onChange={setColored} />
        </div>
        <div className="flex gap-3">
          <Button onClick={doImport} loading={processing} className="flex-1">
            导入并转换
          </Button>
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            取消
          </Button>
        </div>
      </Modal>
    </AppShell>
  );
}

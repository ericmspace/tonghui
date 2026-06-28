import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Spinner } from "~/components/ui/primitives";

type Props = {
  onCapture: (dataUrl: string) => void;
};

/**
 * 摄像头采集：getUserMedia 实时预览 + 抓帧。
 * 兼容无摄像头/拒绝授权场景：自动提供"上传图片"回退。
 */
export function CameraCapture({ onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string>("");

  const start = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "无法访问摄像头");
    }
  }, []);

  useEffect(() => {
    start();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [start]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || status !== "ready") return;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 960;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    onCapture(canvas.toDataURL("image/png"));
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onCapture(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div className="relative aspect-[4/3] rounded-4xl overflow-hidden bg-ink/5 hairline">
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ display: status === "ready" ? "block" : "none" }}
        />

        {status === "loading" && (
          <div className="absolute inset-0 grid place-items-center text-ink-muted">
            <div className="flex flex-col items-center gap-3">
              <Spinner className="w-8 h-8 text-brand-500" />
              <p className="text-sm">正在唤醒摄像头…</p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div className="flex flex-col items-center gap-3 max-w-xs">
              <div className="text-5xl">📷</div>
              <p className="text-sm font-semibold text-ink">摄像头不可用</p>
              <p className="text-xs text-ink-muted">{error}</p>
              <p className="text-xs text-ink-faint">可改为上传一张图片继续体验。</p>
            </div>
          </div>
        )}

        {/* 取景框装饰 */}
        {status === "ready" && (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-6 rounded-3xl border-2 border-white/70" />
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/30 text-white text-xs backdrop-blur-sm">
              将笔尖摄像头对准画面，点按拍摄
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button onClick={capture} size="lg" disabled={status !== "ready"}>
          <span className="text-lg">📸</span> 拍摄
        </Button>
        {status === "error" && (
          <Button variant="outline" onClick={start}>
            重试摄像头
          </Button>
        )}
        <label className="inline-flex items-center justify-center gap-2 h-[52px] px-7 rounded-full hairline bg-white/70 text-ink-soft font-semibold cursor-pointer hover:bg-white transition">
          <span>🖼️</span> 上传图片
          <input type="file" accept="image/*" className="hidden" onChange={onFile} />
        </label>
      </div>
    </div>
  );
}

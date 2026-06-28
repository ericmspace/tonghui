import { useCallback, useRef, useState } from "react";
import { Badge, Button } from "~/components/ui/primitives";
import { cx } from "~/lib/cx";
import { speak, stopSpeak } from "~/lib/voiceGuide/tts";

type ThemeId = "sun" | "cat";
type GuideStatus = "idle" | "checking" | "running" | "done";
type CheckTone = "neutral" | "mint" | "warn";

type CameraMetrics = {
  brightness: number;
  darkRatio: number;
  edgeScore: number;
};

type GuideStep = {
  element: string;
  prompts: string[];
};

const THEMES: Record<ThemeId, { title: string; emoji: string; steps: GuideStep[] }> = {
  sun: {
    title: "太阳",
    emoji: "☀️",
    steps: [
      {
        element: "圆圆的太阳脸",
        prompts: ["先在纸中间画一个大圆。", "从上面开始，慢慢绕一圈，回到起点。"],
      },
      {
        element: "太阳光芒",
        prompts: ["给太阳加几道短短的光。", "从圆的边边往外画小短线，一根一根来。"],
      },
      {
        element: "开心表情",
        prompts: ["最后给太阳画上眼睛和笑脸。", "两个小点当眼睛，一条弯弯的线当嘴巴。"],
      },
    ],
  },
  cat: {
    title: "小猫",
    emoji: "🐱",
    steps: [
      {
        element: "小猫脑袋",
        prompts: ["先画一个圆圆的小猫脑袋。", "把笔放在纸中间，慢慢画一圈。"],
      },
      {
        element: "两只耳朵",
        prompts: ["给小猫加两只尖尖耳朵。", "在圆的上面画两个小三角。"],
      },
      {
        element: "眼睛和胡须",
        prompts: ["画眼睛、鼻子和小胡须。", "点两个眼睛，再从脸旁边画短短的胡须。"],
      },
    ],
  },
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function analyzeFrame(image: ImageData): CameraMetrics {
  const data = image.data;
  let total = 0;
  let dark = 0;
  let edges = 0;
  let samples = 0;
  const width = image.width;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    total += gray;
    if (gray < 120) dark += 1;

    const x = (i / 4) % width;
    if (x > 0) {
      const left = i - 4;
      const leftGray = data[left] * 0.299 + data[left + 1] * 0.587 + data[left + 2] * 0.114;
      if (Math.abs(gray - leftGray) > 36) edges += 1;
    }
    samples += 1;
  }

  return {
    brightness: total / samples,
    darkRatio: dark / samples,
    edgeScore: edges / samples,
  };
}

function hasNewLines(before: CameraMetrics, after: CameraMetrics) {
  return after.darkRatio > before.darkRatio + 0.006 || after.edgeScore > before.edgeScore + 0.004;
}

function describeFrame(metrics: CameraMetrics): { text: string; tone: CheckTone } {
  if (metrics.brightness < 55) {
    return { text: "画面有点暗，可以把纸移到亮一点的地方。", tone: "warn" };
  }
  if (metrics.darkRatio < 0.015 && metrics.edgeScore < 0.018) {
    return { text: "我看到画纸了，可以开始画第一笔。", tone: "mint" };
  }
  if (metrics.darkRatio > 0.34) {
    return { text: "画面里深色区域很多，试试把摄像头对准白纸中间。", tone: "warn" };
  }
  return { text: "摄像头画面正常，我会一边看画面一边提示。", tone: "mint" };
}

export function CameraVoiceGuidePanel({
  captureFrame,
}: {
  captureFrame: () => ImageData | null;
}) {
  const [themeId, setThemeId] = useState<ThemeId>("sun");
  const [status, setStatus] = useState<GuideStatus>("idle");
  const [stepIndex, setStepIndex] = useState(-1);
  const [promptText, setPromptText] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; tone: CheckTone }>({
    text: "把摄像头对准纸面，点开始后我会用语音一步步引导。",
    tone: "neutral",
  });
  const cancelRef = useRef(false);

  const checkFrame = useCallback(async () => {
    const frame = captureFrame();
    if (!frame) {
      setFeedback({ text: "还没有拿到摄像头画面，请先允许摄像头权限。", tone: "warn" });
      return null;
    }
    const message = describeFrame(analyzeFrame(frame));
    setFeedback(message);
    return message;
  }, [captureFrame]);

  const waitForDrawing = useCallback(
    async (before: CameraMetrics) => {
      const deadline = Date.now() + 9000;
      while (Date.now() < deadline) {
        if (cancelRef.current) return false;
        await sleep(700);
        const frame = captureFrame();
        if (!frame) continue;
        if (hasNewLines(before, analyzeFrame(frame))) return true;
      }
      const frame = captureFrame();
      return frame ? hasNewLines(before, analyzeFrame(frame)) : false;
    },
    [captureFrame]
  );

  const run = useCallback(async () => {
    const theme = THEMES[themeId];
    cancelRef.current = false;
    setStatus("checking");
    setStepIndex(-1);
    setPromptText("");

    const check = await checkFrame();
    await speak(check?.text ?? "我先看一看摄像头画面。");
    if (cancelRef.current) return;

    setStatus("running");
    await speak(`我们来画${theme.title}。纸放稳，笔尖放到画面中间。`);

    for (let i = 0; i < theme.steps.length; i += 1) {
      if (cancelRef.current) break;
      const step = theme.steps[i];
      setStepIndex(i);
      const beforeFrame = captureFrame();
      const before = beforeFrame ? analyzeFrame(beforeFrame) : null;

      let completed = false;
      for (const prompt of step.prompts) {
        if (cancelRef.current) break;
        setPromptText(prompt);
        setFeedback({ text: `正在引导：${step.element}`, tone: "neutral" });
        await speak(prompt);
        if (!before) {
          await sleep(1800);
          break;
        }
        completed = await waitForDrawing(before);
        if (completed) break;
      }

      if (cancelRef.current) break;
      if (completed) {
        setFeedback({ text: `看到了新的线条，${step.element}完成得不错。`, tone: "mint" });
        await speak("我看到你画了新的线条，真不错。");
      } else {
        setFeedback({ text: "我没太看清新线条，可以把纸靠近一点，或者继续下一步。", tone: "warn" });
        await speak("我有点没看清，可以把纸靠近一点。我们继续下一步。");
      }
    }

    if (cancelRef.current) {
      setStatus("idle");
      setPromptText("");
      return;
    }

    setStatus("done");
    setStepIndex(THEMES[themeId].steps.length);
    setPromptText("画好啦，可以点拍摄生成绘本。");
    setFeedback({ text: "引导完成。现在可以拍摄这张画，转成简笔绘本。", tone: "mint" });
    await speak("画好啦。现在可以点拍摄，生成你的绘本。");
  }, [captureFrame, checkFrame, themeId, waitForDrawing]);

  const stop = () => {
    cancelRef.current = true;
    stopSpeak();
    setStatus("idle");
    setPromptText("");
    setFeedback({ text: "已停止引导。需要时可以重新开始。", tone: "neutral" });
  };

  const running = status === "checking" || status === "running";
  const theme = THEMES[themeId];

  return (
    <div className="glass rounded-4xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-ink">🎙️ 摄像头语音引导</h3>
          <p className="text-xs text-ink-muted mt-1">对着纸面作画，我会看画面变化并一步步提示。</p>
        </div>
        {running && <Badge tone="brand">引导中</Badge>}
        {status === "done" && <Badge tone="mint">已完成</Badge>}
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.entries(THEMES) as [ThemeId, (typeof THEMES)[ThemeId]][]).map(([id, item]) => (
          <button
            key={id}
            type="button"
            disabled={running}
            onClick={() => setThemeId(id)}
            className={cx(
              "px-3 h-9 rounded-full text-sm font-semibold transition flex items-center gap-1.5 disabled:opacity-50",
              themeId === id
                ? "bg-white text-ink shadow-soft ring-2 ring-brand-200"
                : "bg-black/[0.04] text-ink-muted hover:text-ink-soft"
            )}
          >
            <span>{item.emoji}</span>
            <span>{item.title}</span>
          </button>
        ))}
      </div>

      <div className="rounded-3xl bg-white/70 hairline p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-ink-muted">
            {status === "running" && stepIndex >= 0
              ? `第 ${stepIndex + 1} / ${theme.steps.length} 步 · ${theme.steps[stepIndex].element}`
              : status === "checking"
              ? "正在检查取景"
              : "准备开始"}
          </span>
          <Badge tone={feedback.tone === "warn" ? "warn" : feedback.tone === "mint" ? "mint" : "neutral"}>
            {feedback.tone === "warn" ? "需调整" : feedback.tone === "mint" ? "画面可用" : "待开始"}
          </Badge>
        </div>
        <p className="text-[15px] text-ink font-medium leading-relaxed mt-2">
          {promptText || feedback.text}
        </p>
        {promptText && <p className="text-xs text-ink-muted mt-2">{feedback.text}</p>}
      </div>

      <div className="flex flex-wrap gap-3">
        {!running ? (
          <Button onClick={run}>▶️ 开始引导{theme ? `「${theme.title}」` : ""}</Button>
        ) : (
          <Button variant="outline" onClick={stop}>
            ⏹ 停止引导
          </Button>
        )}
        <Button variant="ghost" onClick={checkFrame} disabled={running}>
          检查画面
        </Button>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Button, Badge } from "~/components/ui/primitives";
import { cx } from "~/lib/cx";
import { THEMES } from "~/lib/voiceGuide/scripts";
import { useVoiceGuide } from "~/lib/voiceGuide/useVoiceGuide";
import type { StrokePoint } from "~/components/canvas/DrawingCanvas";
import type { PromptLevel } from "~/lib/voiceGuide/types";

const LEVEL_TONE: Record<PromptLevel, "mint" | "sky" | "lavender" | "warn"> = {
  L1: "mint",
  L2: "sky",
  L3: "lavender",
  L4: "warn",
};
const LEVEL_DESC: Record<PromptLevel, string> = {
  L1: "最轻提示",
  L2: "口头示范",
  L3: "起笔引导",
  L4: "手把手",
};

export function VoiceGuidePanel({ getStrokes }: { getStrokes: () => StrokePoint[][] }) {
  const { state, start, stop, lastLog } = useVoiceGuide(getStrokes);
  const [themeId, setThemeId] = useState(THEMES[0]?.theme_id ?? "");

  const running = state.status === "running";
  const theme = THEMES.find((t) => t.theme_id === themeId);
  const log = state.status === "done" ? lastLog() : null;

  return (
    <div className="glass rounded-4xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-ink">🎙️ 语音引导作画</h3>
        {state.speaking && <Badge tone="brand">朗读中…</Badge>}
      </div>
      <p className="text-xs text-ink-muted mb-4">
        系统按主题一步步引导，孩子没跟上才逐级加强提示。
      </p>

      {/* 主题选择 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {THEMES.map((t) => (
          <button
            key={t.theme_id}
            disabled={running}
            onClick={() => setThemeId(t.theme_id)}
            className={cx(
              "px-3 h-9 rounded-full text-sm font-semibold transition flex items-center gap-1.5 disabled:opacity-50",
              themeId === t.theme_id
                ? "bg-white text-ink shadow-soft ring-2 ring-brand-200"
                : "bg-black/[0.04] text-ink-muted hover:text-ink-soft"
            )}
          >
            <span>{t.emoji}</span>
            <span>{t.title}</span>
            <span className="text-ink-faint">{"★".repeat(t.difficulty)}</span>
          </button>
        ))}
      </div>

      {/* 开始 / 停止 */}
      {!running ? (
        <Button className="w-full" disabled={!theme} onClick={() => theme && start(theme)}>
          ▶️ 开始引导{theme ? `「${theme.title}」` : ""}
        </Button>
      ) : (
        <Button variant="outline" className="w-full" onClick={stop}>
          ⏹ 停止
        </Button>
      )}

      {/* 运行态：当前步骤与提示 */}
      {running && (
        <div className="mt-4 rounded-3xl bg-white/70 hairline p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-muted">
              {state.stepIndex < 0
                ? "准备开始…"
                : state.stepIndex >= state.total
                ? "收尾"
                : `第 ${state.stepIndex + 1} / ${state.total} 步`}
              {state.element ? ` · ${state.element}` : ""}
            </span>
            <div className="flex items-center gap-1.5">
              {state.isChallenge && <Badge tone="warn">挑战点</Badge>}
              {state.level && (
                <Badge tone={LEVEL_TONE[state.level]}>
                  {state.level} {LEVEL_DESC[state.level]}
                </Badge>
              )}
            </div>
          </div>
          <p className="text-[15px] text-ink font-medium leading-relaxed">
            {state.promptText || "…"}
          </p>
          {/* 提示级别进度（渐褪可视化） */}
          <div className="flex gap-1 pt-1">
            {(["L1", "L2", "L3", "L4"] as PromptLevel[]).map((l) => (
              <span
                key={l}
                className={cx(
                  "h-1.5 flex-1 rounded-full",
                  state.level && l <= state.level ? "bg-brand-400" : "bg-black/[0.07]"
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* 完成态：本次各步触发的提示级别 */}
      {log && (
        <div className="mt-4 rounded-3xl bg-mint/10 p-4">
          <p className="text-sm font-semibold text-emerald-700 mb-2">🎉 完成！本次提示级别</p>
          <ul className="text-xs text-ink-soft space-y-1">
            {log.steps.map((s) => (
              <li key={s.step_id} className="flex items-center justify-between">
                <span>{s.element}</span>
                <span className="flex items-center gap-1.5">
                  {s.prompt_level_reached && (
                    <Badge tone={LEVEL_TONE[s.prompt_level_reached]}>{s.prompt_level_reached}</Badge>
                  )}
                  <span className={s.completed ? "text-emerald-600" : "text-ink-faint"}>
                    {s.completed ? "✓" : "—"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-ink-faint mt-2">
            记录已保存（用于 IEP 提示渐褪曲线，理想趋势 L4→L1）。
          </p>
        </div>
      )}
    </div>
  );
}

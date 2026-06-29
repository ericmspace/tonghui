import { useEffect, useRef, useState } from "react";
import { Button, Badge } from "~/components/ui/primitives";
import { cx } from "~/lib/cx";
import { THEMES } from "~/lib/voiceGuide/scripts";
import { useVoiceGuide } from "~/lib/voiceGuide/useVoiceGuide";
import { useImuMonitor } from "~/lib/imu/useImuMonitor";
import { ImuMonitor } from "~/components/canvas/ImuMonitor";
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

type ReportStatus = null | "sending" | { ok: true; id: string } | { ok: false; msg: string };

export function VoiceGuidePanel({ getStrokes }: { getStrokes: () => StrokePoint[][] }) {
  const { state, start, stop, lastLog, signalDone } = useVoiceGuide(getStrokes);
  const monitor = useImuMonitor();
  const [themeId, setThemeId] = useState(THEMES[0]?.theme_id ?? "");
  const [childName, setChildName] = useState("小航");
  const [report, setReport] = useState<ReportStatus>(null);
  const reportedRef = useRef(false);

  const running = state.status === "running";
  const theme = THEMES.find((t) => t.theme_id === themeId);
  const log = state.status === "done" ? lastLog() : null;
  const imuSummary = state.status === "done" ? monitor.summary() : null;

  const onStart = () => {
    if (!theme) return;
    reportedRef.current = false;
    setReport(null);
    monitor.reset();
    monitor.start();
    void start(theme);
  };

  const onStop = () => {
    stop();
    monitor.stop();
  };

  // 引导完成 → 停监测、组装数据、上报教师端（每次会话仅一次）
  useEffect(() => {
    if (state.status !== "done" || reportedRef.current) return;
    reportedRef.current = true;
    monitor.stop();

    const sum = monitor.summary();
    const guideLog = lastLog();
    const childId = "web_" + childName.trim().replace(/\s+/g, "_");
    const levelLine = guideLog?.steps
      .map((s) => `${s.element}:${s.prompt_level_reached ?? "-"}${s.completed ? "✓" : ""}`)
      .join("，");
    const reportText =
      `语音引导「${theme?.title ?? themeId}」完成。\n` +
      `提示级别：${levelLine ?? "-"}。\n` +
      (sum
        ? `实时监测：手抖主频约 ${sum.tremor_peak_hz}Hz、手抖时间占比 ${(sum.tremor_power * 100).toFixed(0)}%；` +
          `紧张度均值 ${sum.tension_mean}（峰值 ${sum.tension_max}）、最大温升 ${sum.temp_rise_max}°C。`
        : "");

    const payload = {
      childId,
      childName: childName.trim(),
      task: themeId,
      durationS: sum?.duration_s,
      nFrames: sum?.n_frames,
      report: reportText,
      features: {
        tremor_peak_hz: sum?.tremor_peak_hz ?? 0,
        tremor_power: sum?.tremor_power ?? 0,
        tremor_rms_max: sum?.tremor_rms_max ?? 0,
        tension_mean: sum?.tension_mean ?? 0,
        tension_max: sum?.tension_max ?? 0,
        temp_rise_max: sum?.temp_rise_max ?? 0,
        task: themeId,
        duration_s: sum?.duration_s ?? 0,
      },
    };

    setReport("sending");
    fetch("/api/imu-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) setReport({ ok: true, id: d.id });
        else setReport({ ok: false, msg: d?.error ?? "上报失败" });
      })
      .catch(() => setReport({ ok: false, msg: "网络错误" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  return (
    <div className="glass rounded-4xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-ink">🎙️ 语音引导作画</h3>
        {state.speaking && <Badge tone="brand">朗读中…</Badge>}
      </div>
      <p className="text-xs text-ink-muted mb-4">
        系统按主题一步步引导，孩子没跟上才逐级加强提示；同时实时监测笔端手抖与紧张度。
      </p>

      {/* 孩子 + 主题选择 */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-ink-muted shrink-0">孩子</span>
        <input
          value={childName}
          disabled={running}
          onChange={(e) => setChildName(e.target.value)}
          className="flex-1 h-9 px-3 rounded-full hairline bg-white/70 text-sm text-ink disabled:opacity-50 outline-none focus:ring-2 ring-brand-200"
          placeholder="孩子名字"
        />
      </div>
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
        <Button className="w-full" disabled={!theme || !childName.trim()} onClick={onStart}>
          ▶️ 开始引导{theme ? `「${theme.title}」` : ""}
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button className="flex-1" onClick={signalDone} disabled={state.stepIndex < 0 || state.stepIndex >= state.total}>
            ✅ 完成这一步
          </Button>
          <Button variant="outline" onClick={onStop}>
            ⏹ 停止
          </Button>
        </div>
      )}

      {/* 实时监测（引导进行中显示） */}
      {running && (
        <div className="mt-4">
          <ImuMonitor state={monitor.state} />
        </div>
      )}

      {/* 运行态：当前步骤与提示 */}
      {running && (
        <div className="mt-3 rounded-3xl bg-white/70 hairline p-4 space-y-2">
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

      {/* 完成态：提示级别 + IMU 摘要 + 上报状态 */}
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

          {imuSummary && (
            <div className="mt-3 pt-3 border-t border-black/[0.06] grid grid-cols-3 gap-2 text-center">
              {[
                { k: "手抖主频", v: `${imuSummary.tremor_peak_hz}`, u: "Hz" },
                { k: "手抖占比", v: `${(imuSummary.tremor_power * 100).toFixed(0)}`, u: "%" },
                { k: "紧张峰值", v: `${imuSummary.tension_max}`, u: "" },
              ].map((m) => (
                <div key={m.k} className="rounded-2xl bg-white/70 p-2">
                  <p className="text-[10px] text-ink-muted">{m.k}</p>
                  <p className="text-base font-extrabold text-ink">
                    {m.v}
                    <span className="text-[10px] font-semibold text-ink-faint ml-0.5">{m.u}</span>
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* 上报教师端状态 */}
          <div className="mt-3 text-xs">
            {report === "sending" && <span className="text-ink-muted">⏳ 正在上报教师端…</span>}
            {report && typeof report === "object" && report.ok && (
              <span className="text-emerald-700 font-semibold">
                ✅ 已上报教师端（imu_platform），会话 {report.id.slice(0, 8)}
              </span>
            )}
            {report && typeof report === "object" && !report.ok && (
              <span className="text-amber-700">
                ⚠️ 上报未成功：{report.msg}（确认 imu_platform 3100 已启动）
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

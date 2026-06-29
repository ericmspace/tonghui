import { Badge } from "~/components/ui/primitives";
import { cx } from "~/lib/cx";
import { TREMOR_BAR_MAX } from "~/lib/imu/analysis";
import type { ImuLiveState, TensionLevel } from "~/lib/imu/types";

const TENSION_TEXT: Record<TensionLevel, string> = {
  calm: "平静",
  mild: "略紧张",
  high: "紧张",
};
const TENSION_TONE: Record<TensionLevel, "mint" | "warn" | "brand"> = {
  calm: "mint",
  mild: "warn",
  high: "brand",
};

/** 实时 IMU 监测：手抖 + 紧张度两个活体指示 */
export function ImuMonitor({ state }: { state: ImuLiveState | null }) {
  const tremorPct = state ? Math.min(100, (state.tremorRms / TREMOR_BAR_MAX) * 100) : 0;
  const tensionPct = state ? state.tension * 100 : 0;

  return (
    <div className="rounded-3xl bg-white/70 hairline p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-soft">📡 实时监测（笔端 IMU）</span>
        {state && (
          <span className="text-[10px] text-ink-faint tabular-nums">{state.samples} 帧</span>
        )}
      </div>

      {/* 手抖 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-ink-muted">✋ 手抖</span>
          <div className="flex items-center gap-1.5">
            {state && (
              <span className="text-[11px] text-ink-faint tabular-nums">
                {state.tremorActive ? `${state.tremorHz}Hz` : "—"}
              </span>
            )}
            <Badge tone={state?.tremorActive ? "warn" : "mint"}>
              {state?.tremorActive ? "检出手抖" : "平稳"}
            </Badge>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-black/[0.07] overflow-hidden">
          <div
            className={cx("h-full rounded-full transition-all", state?.tremorActive ? "bg-amber-500" : "bg-mint")}
            style={{ width: `${tremorPct}%` }}
          />
        </div>
      </div>

      {/* 紧张度 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-ink-muted">😟 情绪紧张度</span>
          <div className="flex items-center gap-1.5">
            {state && (
              <span className="text-[11px] text-ink-faint tabular-nums">
                🌡{state.temp}°C
                {state.tempDelta < -0.05 ? ` ↓${Math.abs(state.tempDelta).toFixed(1)}` : ""}
                {" · "}💡{state.light}
                {Math.abs(state.lightDelta) > 30 ? `(${state.lightDelta > 0 ? "+" : ""}${state.lightDelta})` : ""}
              </span>
            )}
            <Badge tone={state ? TENSION_TONE[state.tensionLevel] : "neutral"}>
              {state ? TENSION_TEXT[state.tensionLevel] : "—"}
            </Badge>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-black/[0.07] overflow-hidden">
          <div
            className={cx(
              "h-full rounded-full transition-all",
              !state || state.tensionLevel === "calm"
                ? "bg-mint"
                : state.tensionLevel === "mild"
                ? "bg-amber-500"
                : "bg-brand-500"
            )}
            style={{ width: `${tensionPct}%` }}
          />
        </div>
        <p className="text-[10px] text-ink-faint mt-1.5">
          综合 手抖激动 + 体温下降 + 环境光骤变 估计（代理指标，非诊断）
        </p>
      </div>
    </div>
  );
}

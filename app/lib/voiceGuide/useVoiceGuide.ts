// 语音引导作画系统 · 会话引擎（React hook）
// 规格见 handoff §5。灵魂 = 「等待—升级—渐褪」：播最轻提示→等→检测，
// 未完成才升级；挑战点不升级。每步记录实际触发到的最高提示级别。

import { useCallback, useRef, useState } from "react";
import type {
  ThemeScript,
  ScriptStep,
  PromptLevel,
  SessionLog,
  StepLog,
  Stroke,
} from "./types";
import { DETECTORS } from "./detectors";
import { speak, stopSpeak } from "./tts";
import { randomReinforcement } from "./scripts";

const SESSIONS_KEY = "th_vg_sessions";
const LEVELS: PromptLevel[] = ["L1", "L2", "L3", "L4"];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type GuideStatus = "idle" | "running" | "done";

export interface GuideState {
  status: GuideStatus;
  themeTitle: string;
  stepIndex: number; // 0-based；-1 表示开场白阶段
  total: number;
  element: string;
  promptText: string;
  level: PromptLevel | null;
  isChallenge: boolean;
  speaking: boolean;
}

const INITIAL: GuideState = {
  status: "idle",
  themeTitle: "",
  stepIndex: -1,
  total: 0,
  element: "",
  promptText: "",
  level: null,
  isChallenge: false,
  speaking: false,
};

function saveSession(log: SessionLog) {
  if (typeof window === "undefined") return;
  try {
    const prev = JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]");
    prev.push(log);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(prev));
  } catch {
    /* 忽略存储异常 */
  }
}

/**
 * @param getStrokes 由画板提供，返回到目前为止记录的全部 brush 笔迹 (x,y,t)
 */
export function useVoiceGuide(getStrokes: () => Stroke[]) {
  const [state, setState] = useState<GuideState>(INITIAL);
  const cancelRef = useRef(false);
  const logRef = useRef<SessionLog | null>(null);
  // 手动完成信号：无数字画布（如 /capture 摄像头页）时，由操作者点「完成这一步」推进
  const manualDoneRef = useRef(false);

  const patch = useCallback((p: Partial<GuideState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  const say = useCallback(
    async (text: string) => {
      patch({ speaking: true });
      await speak(text);
      patch({ speaking: false });
    },
    [patch]
  );

  // 在 window 内轮询检测；命中即 true，超时做最后一次判定
  const waitAndDetect = useCallback(
    async (step: ScriptStep, baseIndex: number): Promise<boolean> => {
      const detect = DETECTORS[step.detector];
      const deadline = Date.now() + step.response_window_sec * 1000;
      while (Date.now() < deadline) {
        if (cancelRef.current) return false;
        if (manualDoneRef.current) {
          manualDoneRef.current = false;
          return true;
        }
        const fresh = getStrokes().slice(baseIndex);
        if (detect(fresh, step.detector_params)) return true;
        await sleep(300);
      }
      return detect(getStrokes().slice(baseIndex), step.detector_params);
    },
    [getStrokes]
  );

  const runStep = useCallback(
    async (step: ScriptStep): Promise<StepLog> => {
      const levels = LEVELS.filter((l) => step.prompts[l]);
      const baseIndex = getStrokes().length; // 仅评估此步新增的笔
      manualDoneRef.current = false; // 清除上一步可能残留的手动信号
      let reached: PromptLevel | null = null;
      let completed = false;
      let latency: number | null = null;

      patch({ element: step.element, isChallenge: !!step.is_challenge });

      for (const level of levels) {
        if (cancelRef.current) break;
        reached = level;
        patch({ level, promptText: step.prompts[level]! });
        await say(step.prompts[level]!);

        // 命名追问（仅 L1 后一次）。真实录音采集留待接 ASR，这里先停顿示意倾听。
        if (step.language_elicitation && level === "L1") {
          await say(step.language_elicitation);
          await sleep(1500); // TODO: 接 MediaRecorder 采集孩子的命名回应
        }

        const promptEnd = Date.now();
        const done = await waitAndDetect(step, baseIndex);
        if (done) {
          completed = true;
          const fresh = getStrokes().slice(baseIndex);
          if (fresh.length && fresh[0].length) {
            latency = Math.max(0, fresh[0][0].t - promptEnd);
          }
          break;
        }
        if (step.is_challenge) break; // 挑战点：不升级，留白观察
      }

      await say(randomReinforcement(step.element));
      return {
        step_id: step.step_id,
        element: step.element,
        prompt_level_reached: reached,
        start_latency_ms: latency,
        completed,
      };
    },
    [getStrokes, patch, say, waitAndDetect]
  );

  const start = useCallback(
    async (theme: ThemeScript) => {
      cancelRef.current = false;
      logRef.current = {
        session_id:
          (typeof crypto !== "undefined" && crypto.randomUUID?.()) ||
          `vg_${Date.now()}`,
        theme_id: theme.theme_id,
        started_at: new Date().toISOString(),
        steps: [],
      };
      setState({
        ...INITIAL,
        status: "running",
        themeTitle: theme.title,
        total: theme.steps.length,
      });

      await say(`今天我们一起画${theme.title}，准备好了吗？`);

      for (let i = 0; i < theme.steps.length; i++) {
        if (cancelRef.current) break;
        patch({ stepIndex: i });
        const stepLog = await runStep(theme.steps[i]);
        logRef.current.steps.push(stepLog);
      }

      if (cancelRef.current) {
        patch({ status: "idle" });
        return;
      }

      // 收尾：情绪追问（情绪标签/录音采集留待接入）
      patch({ stepIndex: theme.steps.length, element: "", promptText: theme.closing.prompt, level: null });
      await say(theme.closing.prompt);

      logRef.current.ended_at = new Date().toISOString();
      saveSession(logRef.current);
      patch({ status: "done", speaking: false });
    },
    [patch, runStep, say]
  );

  const stop = useCallback(() => {
    cancelRef.current = true;
    stopSpeak();
    setState((s) => ({ ...s, status: "idle", speaking: false }));
  }, []);

  const lastLog = useCallback(() => logRef.current, []);

  // 操作者点「完成这一步」时调用，让当前步骤即时判定为完成
  const signalDone = useCallback(() => {
    manualDoneRef.current = true;
  }, []);

  return { state, start, stop, lastLog, signalDone };
}

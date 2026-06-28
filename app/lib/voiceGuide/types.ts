// 语音引导作画系统 · 类型定义
// 规格见 voice_guide_CC_handoff.md §3。轨迹仅含 (x,y,t)。

export type PromptLevel = "L1" | "L2" | "L3" | "L4";

export type DetectorName =
  | "closed_curve"
  | "corner_count"
  | "stroke_count"
  | "dot"
  | "line";

/** 单个采样点（画布坐标 + 毫秒时间戳） */
export interface Pt {
  x: number;
  y: number;
  t: number;
}

/** 一笔（从落笔到抬笔的连续点序列） */
export type Stroke = Pt[];

/** 检测器：纯函数，仅依据本步骤新增的 strokes 判断"是否大致完成" */
export type Detector = (strokes: Stroke[], params?: Record<string, number>) => boolean;

export interface ScriptStep {
  step_id: string;
  element: string;
  shape: string;
  /** 挑战点：只给 L1，不升级，留白观察真实能力 */
  is_challenge?: boolean;
  /** 命名追问（在 L1 后插入一次），存在则采集回应 */
  language_elicitation?: string;
  /** 不必四级全给；缺失的级别表示该步不升级到那一级 */
  prompts: Partial<Record<PromptLevel, string>>;
  response_window_sec: number;
  detector: DetectorName;
  detector_params?: Record<string, number>;
}

export interface ThemeScript {
  theme_id: string;
  title: string;
  emoji: string;
  difficulty: number;
  target_skills: string[];
  steps: ScriptStep[];
  closing: { type: string; prompt: string; collect: string[] };
}

/** 每步日志：prompt_level_reached 是提示渐褪曲线的核心数据点 */
export interface StepLog {
  step_id: string;
  element: string;
  prompt_level_reached: PromptLevel | null;
  start_latency_ms: number | null;
  completed: boolean;
}

export interface SessionLog {
  session_id: string;
  theme_id: string;
  started_at: string;
  ended_at?: string;
  steps: StepLog[];
  language?: { elicitation_responses: number; elicitation_total: number };
  closing_emotion?: { label?: string };
}

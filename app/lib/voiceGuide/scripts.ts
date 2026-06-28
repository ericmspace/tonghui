// 语音引导作画系统 · 主题脚本库
// 规格见 handoff §3.1 / §7。措辞遵守 ASD 友好硬规则：
// 单句≤15字、一次一个指令、正向句式（禁否定）、固定用"我们"、多用具体比喻。
// 目前内置 sun / cat 两个主题（handoff §8 第一步），其余 4 个主题
// （house/tree/flower/fish）可按同结构从配套 Word 文档第三章补充。

import type { ThemeScript } from "./types";

const sun: ThemeScript = {
  theme_id: "sun",
  title: "太阳",
  emoji: "☀️",
  difficulty: 1,
  target_skills: ["circle", "ray_line"],
  steps: [
    {
      step_id: "sun_face",
      element: "太阳",
      shape: "circle",
      prompts: {
        L1: "太阳是什么形状的呀？",
        L2: "我们画一个圆圈，像皮球一样",
        L3: "从这里开始，慢慢画一个圈",
        L4: "先把笔放在中间，慢慢往右画半圆，再画另一半",
      },
      response_window_sec: 5,
      detector: "closed_curve",
    },
    {
      step_id: "sun_rays",
      element: "光芒",
      shape: "line",
      is_challenge: true, // 挑战点：放射线方向控制，只给 L1
      language_elicitation: "太阳的光是往哪边照的呀？",
      prompts: {
        L1: "太阳有暖暖的光，从圆圈往外画几条线",
      },
      response_window_sec: 8,
      detector: "stroke_count",
      detector_params: { min_strokes: 3 },
    },
  ],
  closing: {
    type: "emotion",
    prompt: "你画的太阳真棒！它看起来开心还是难过呀？",
    collect: ["audio", "emotion_label"],
  },
};

const cat: ThemeScript = {
  theme_id: "cat",
  title: "小猫",
  emoji: "🐱",
  difficulty: 2,
  target_skills: ["circle", "triangle", "straight_line"],
  steps: [
    {
      step_id: "cat_face",
      element: "脸",
      shape: "circle",
      prompts: {
        L1: "小猫要有一张圆圆的脸，你来试试？",
        L2: "我们画一个圆圈，像皮球一样",
        L3: "从这里开始，慢慢画一个圈",
        L4: "看，先把笔放在中间，慢慢往右画半圆，再画另一半",
      },
      response_window_sec: 5,
      detector: "closed_curve",
    },
    {
      step_id: "cat_ears",
      element: "耳朵",
      shape: "triangle",
      language_elicitation: "小猫头上尖尖的是什么？",
      prompts: {
        L1: "小猫头上有什么尖尖的？",
        L2: "画两个三角形当耳朵",
        L3: "在脸的上面，画两个尖尖的角",
      },
      response_window_sec: 5,
      detector: "corner_count",
      detector_params: { min_corners: 2 },
    },
    {
      step_id: "cat_whiskers",
      element: "胡须",
      shape: "line",
      is_challenge: true,
      prompts: { L1: "小猫有长长的胡须，从鼻子两边画几条线" },
      response_window_sec: 8,
      detector: "stroke_count",
      detector_params: { min_strokes: 2 },
    },
  ],
  closing: {
    type: "emotion",
    prompt: "你画的小猫真棒！它看起来开心还是难过呀？",
    collect: ["audio", "emotion_label"],
  },
};

export const THEMES: ThemeScript[] = [sun, cat];

export function getTheme(id: string): ThemeScript | undefined {
  return THEMES.find((t) => t.theme_id === id);
}

// 正向强化语（handoff §6 reinforce 模板）。仅正向、具体到部件。
const PRAISES = ["太厉害啦", "好可爱", "真漂亮", "棒极了", "好喜欢"];

export function randomReinforcement(element: string): string {
  const praise = PRAISES[Math.floor(Math.random() * PRAISES.length)];
  return `哇，${element}画得真好！${praise}`;
}

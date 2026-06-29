/**
 * Mock 兜底数据。任一真实接口不可用时启用，保证整套 UI 可演示。
 * 图片以内联 SVG dataURL 生成（简笔/上色两种风格）。
 */

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** 生成一张"简笔填色绘本"占位图。colored=true 时带柔和填色。 */
export function mockColoringImage(opts: { colored?: boolean; seed?: string; hint?: string } = {}): string {
  const { colored, seed = "童绘", hint = "简笔绘本" } = opts;
  const sky = colored ? "#cdeafe" : "none";
  const sun = colored ? "#ffd166" : "none";
  const hill = colored ? "#bde8c8" : "none";
  const house = colored ? "#ffe0c2" : "none";
  const roof = colored ? "#ff9eaa" : "none";
  const tree = colored ? "#a7e3b8" : "none";
  const stroke = "#2b2b2e";
  const sw = 4;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <rect width="1024" height="768" fill="#fffdf8"/>
  <rect x="40" y="40" width="944" height="688" rx="28" fill="${sky}" stroke="${stroke}" stroke-width="${sw}"/>
  <circle cx="840" cy="170" r="70" fill="${sun}" stroke="${stroke}" stroke-width="${sw}"/>
  <path d="M40 560 Q300 440 560 560 T984 540 L984 728 L40 728 Z" fill="${hill}" stroke="${stroke}" stroke-width="${sw}"/>
  <g stroke="${stroke}" stroke-width="${sw}" fill="${house}">
    <rect x="360" y="430" width="240" height="180" rx="10"/>
    <path d="M345 430 L480 330 L615 430 Z" fill="${roof}"/>
    <rect x="430" y="500" width="70" height="110" rx="8" fill="${colored ? "#ffcaa8" : "none"}"/>
    <rect x="520" y="470" width="60" height="60" rx="8" fill="${colored ? "#cdeafe" : "none"}"/>
  </g>
  <g stroke="${stroke}" stroke-width="${sw}">
    <rect x="700" y="470" width="22" height="140" fill="${colored ? "#caa27a" : "none"}"/>
    <circle cx="711" cy="430" r="80" fill="${tree}"/>
  </g>
  <text x="512" y="700" text-anchor="middle" font-family="PingFang SC, sans-serif" font-size="26" fill="${stroke}" opacity="0.55">${seed} · ${hint}</text>
</svg>`;
  return svgToDataUrl(svg);
}

/** 方向延展占位图（探索模式用） */
export function mockExploreImage(direction: string, step: number): string {
  const hues: Record<string, string> = {
    up: "#cdeafe",
    down: "#bde8c8",
    left: "#ffe0c2",
    right: "#e7d5ff",
    center: "#fff3d6",
  };
  const bg = hues[direction] ?? "#fff3d6";
  const arrow = { up: "↑", down: "↓", left: "←", right: "→", center: "•" }[direction] ?? "•";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <defs><radialGradient id="g" cx="50%" cy="40%"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="${bg}"/></radialGradient></defs>
  <rect width="1024" height="768" fill="url(#g)"/>
  <g fill="none" stroke="#2b2b2e" stroke-width="4" opacity="0.85">
    <circle cx="512" cy="360" r="${120 + step * 12}"/>
    <circle cx="512" cy="360" r="${60 + step * 8}"/>
    <path d="M200 600 Q512 480 824 600" />
  </g>
  <text x="512" y="380" text-anchor="middle" font-size="120" fill="#2b2b2e" opacity="0.18">${arrow}</text>
  <text x="512" y="700" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#2b2b2e" opacity="0.5">探索第 ${step} 步 · 向${({ up: "上", down: "下", left: "左", right: "右", center: "中心" } as any)[direction] ?? ""}延展</text>
</svg>`;
  return svgToDataUrl(svg);
}

/** Mock 故事文本 */
export function mockStory(): { title: string; description: string; story: string; character: any } {
  return {
    title: "小屋旁的大树朋友",
    description: "画面里有一座暖橙色屋顶的小房子，旁边长着一棵圆圆的大树，远处是连绵的小山和暖洋洋的太阳。",
    story:
      "在山脚下，有一座红屋顶的小房子。房子旁边住着一棵爱笑的大树，它的叶子总是沙沙地和风打招呼。\n\n每天清晨，太阳公公爬上山头，把金色的光洒在小屋的窗户上。小主人推开门，对大树说：“早安呀！”大树轻轻摇晃枝叶，像在点头回应。\n\n他们是最好的朋友。无论刮风还是下雨，大树都为小屋撑起一片绿色的伞。今天，他们又要一起迎接新的一天啦！",
    character: {
      name: "大树朋友",
      description: "一棵住在小屋旁、喜欢用沙沙声打招呼的友善大树，象征陪伴与安全感。",
      personality: "温柔、耐心、爱笑",
      scenario: "山脚下的暖色小屋旁",
      tags: ["陪伴", "成长", "安全感"],
    },
  };
}

/** Mock 看图组句结果（与 mockColoringImage 的小屋大树画面呼应） */
export function mockSentence(): { sentence: string; chunks: string[] } {
  return {
    sentence: "小房子旁边有一棵大树",
    chunks: ["小房子", "旁边", "有一棵", "大树"],
  };
}

/** Mock 情绪识别结果 */
export function mockEmotion() {
  return {
    primary: "平静",
    confidence: 0.78,
    valence: 0.35,
    arousal: -0.2,
    distribution: [
      { label: "平静", value: 0.46 },
      { label: "专注", value: 0.27 },
      { label: "愉悦", value: 0.15 },
      { label: "焦虑", value: 0.08 },
      { label: "抗拒", value: 0.04 },
    ],
    note: "书写过程整体平稳，中段出现短暂停顿，建议给予正向鼓励以维持专注。",
  };
}

/** Mock 视频（公开示例占位） */
export function mockVideo(): { taskId: string; status: string; videoUrl: string } {
  return {
    taskId: "mock-task-0001",
    status: "SUCCEEDED",
    videoUrl:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  };
}

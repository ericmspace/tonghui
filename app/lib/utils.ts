/** 把 dataURL 转为纯 base64（去掉 data:*;base64, 前缀） */
export function dataUrlToBase64(dataUrl: string): string {
  const i = dataUrl.indexOf(",");
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}

/** 触发浏览器下载 */
export function downloadBlob(data: Blob | string, filename: string) {
  const url = typeof data === "string" ? data : URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (typeof data !== "string") URL.revokeObjectURL(url);
}

/** 简单延时 */
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 五大功能模块元数据（导航与首页共用） */
export const MODULES = [
  {
    id: "capture",
    no: "01",
    href: "/capture",
    title: "拍照绘本",
    subtitle: "拍摄 · 扫描 · 简笔 · 涂色",
    desc: "用笔尖摄像头拍下实物，AI 一键转成可涂色的简笔绘本，导入画板自由创作。",
    icon: "📸",
    accent: "from-brand-400 to-peach",
  },
  {
    id: "video",
    no: "02",
    href: "/video",
    title: "绘本生视频",
    subtitle: "图生视频 · 探索漫游",
    desc: "把一张图变成会动的小动画，并进入沉浸探索模式，向四个方向延展画面世界。",
    icon: "🎬",
    accent: "from-mint to-sky",
  },
  {
    id: "story",
    no: "03",
    href: "/story",
    title: "看图讲故事",
    subtitle: "看图 · 成文 · 配音 · 隐写",
    desc: "AI 看图编织适龄绘本故事并朗读，故事与角色信息隐写进 PNG 便于保存分享。",
    icon: "📖",
    accent: "from-sunny to-brand-300",
  },
  {
    id: "iep",
    no: "04",
    href: "/iep",
    title: "IEP 数据分析",
    subtitle: "表现指标 · 情绪 · 成长趋势",
    desc: "汇聚书写 IMU 轨迹、情绪识别与表现性指标雷达，按时间分析孩子的成长趋势。",
    icon: "📊",
    accent: "from-lavender to-peach",
  },
  {
    id: "library",
    no: "05",
    href: "/library",
    title: "创作记录",
    subtitle: "经历归档 · 隐写回溯",
    desc: "归档每一次绘本、故事与视频的生成经历，上传隐写 PNG 即可回溯生成时间与角色信息。",
    icon: "🗂️",
    accent: "from-sky to-mint",
  },
] as const;

export type ModuleMeta = (typeof MODULES)[number];

# 童绘 · AI 绘本教育平台

面向 **ADHD / 自闭症等特殊儿童** 的 AI 绘本教育平台。硬件是一支带摄像头的笔，本仓库是配套的软件平台（Remix 全栈）。

把「拍下实物 → 简笔填色绘本 → 自由涂色 → 生视频探索 → 看图讲故事 → IEP 数据分析」串成一条完整教育链路。

## 技术栈
- **Remix (Vite) + React 18 + TypeScript**：路由即页面，resource route 即后端 API。
- **TailwindCSS**：类 Apple 亮色设计（暖色儿童色板 + 毛玻璃 + 大圆角，无暗黑模式）。
- **HTML5 Canvas** 自研画板；**recharts** 数据可视化；**Node** 实现 PNG tEXt 隐写。
- AI 能力接入 **阿里云 DashScope / 百炼 MaaS**，全链路 **Mock 兜底**。

## 快速开始
```bash
npm install
cp .env.example .env   # 填入真实密钥（见下）
npm run dev            # http://localhost:3000
```
生产：`npm run build && npm run start`

## 环境变量（`.env`）
| 变量 | 说明 |
|---|---|
| `DASHSCOPE_API_KEY` | 百炼密钥（图/视频/故事/TTS 共用） |
| `DASHSCOPE_BASE` | 原生 DashScope 基址（视频/任务轮询） |
| `DASHSCOPE_IMAGE_BASE` | OpenAI 兼容模式基址（图生图/视觉/文本） |
| `MODEL_IMAGE/VIDEO/VISION/TEXT/TTS` | 各能力模型名，按账号可用模型调整 |
| `USE_MOCK` | `true` 时全程走 Mock，不发真实请求 |

> ⚠️ 粘贴密钥常因换行被截断，联调前请核对完整。任一真实接口失败会自动回退 Mock，保证 UI 始终可演示。

## 五大功能
1. **拍照绘本 + 组句练习**（`/capture` → `/canvas`）：摄像头拍照 → 弹窗确认导入 → AI 扫描为「平面纸质」简笔填块绘本（可选上色，`qwen-image-2.0` 图生图）→ 导入画板自由涂色（画笔/填色桶/橡皮/撤销重做/导出 PNG）。生图后视觉模型看图编一句适龄中文短句并按**词组**切分，孩子点选打乱的词卡拼回完整句子做组句练习（`qwen-vl-max`，`/api/sentence`）。
2. **生视频 + 探索模式**（`/video`、`/explore`）：图生视频（`happyhorse-1.1-i2v` 异步任务 + 轮询）；沉浸式探索，上/下/左/右四向延展画面。
3. **看图讲故事**（`/story`）：视觉模型看图成文 → TTS 朗读（真实 TTS 或浏览器本地兜底）→ 故事与角色信息隐写进 PNG 的 tEXt 数据块，可下载、可再提取还原。
4. **IEP 数据分析**（`/iep`）：**管理员/教师双模式**。明细页含 IMU 信号、二次积分书写轨迹、情绪识别（chat JSON 工程）；分析页为**表现性指标雷达**（探索欲 / 色彩丰富度 / 画幅利用率 / 专注持续 / 情绪表达 / 细节复杂度）+ **同一儿童按时间的成长趋势折线**与自动洞察。教师模式可新增观察会话，管理员只读。
5. **创作记录 & 隐写回溯**（`/library`）：归档每一次绘本 / 故事 / 视频的**生成经历**（持久化）。视频为长耗时任务，离开后回来可刷新状态、续看成片。上传隐写 PNG 即**回溯**到库中记录，展示生成时间与角色信息。

## 数据系统
- `app/services/db.server.ts`：JSON 文件存储（`data/records.json`）+ 二进制资源（`data/assets/`，经 `/asset/:id` 服务），tmp+rename 原子写。
- 生成时落库：`api.image` / `api.story` / `api.video` 返回 `recordId`+`createdAt`；`api.video/status` 按 `taskId` 更新视频状态，支撑「回来续看」。
- 隐写回溯：下载的隐写 PNG 内嵌 `recordId` 与故事**生成时间**；`/library` 上传后比对库中记录还原。
- `data/` 已 gitignore。

## 目录结构
```
app/
  components/  ui 原语 / 布局 / 摄像头 / 画板 / 图表
  lib/         角色上下文 · 工具 · 模块元数据
  services/    *.server.ts —— DashScope 封装 + Mock 兜底 + PNG 隐写
  routes/      页面 + api.* resource routes
```

## 联调状态（已实测本工作空间 `ws-7r6yqzfjpw2pg0ec`）
| 能力 | 模型 | 状态 | 说明 |
|---|---|---|---|
| 图生图（拍照绘本/探索） | `qwen-image-2.0` | ✅ 真实可用 | `chat/completions`，`content:[{image},{text}]`，出图在 `output.choices[0].message.content[].image`；服务端转 base64 规避跨域 |
| 看图讲故事 | `qwen-vl-max` | ✅ 真实可用 | 标准多模态 chat |
| 情绪识别 | `qwen-vl-max` | ✅ 真实可用 | chat JSON 工程（本空间唯一可用文本/视觉模型） |
| 生视频 | `happyhorse-1.1-i2v` | 🟡 接好待命 | 调用已严格对齐官方 curl；首帧**图床上传留白未实现**（`uploadFirstFrameToPublicUrl`），无公网图时回退 Mock。注：实测此 KEY 仍 `Model.AccessDenied`，待授权对该 API Key 生效即可直接出片 |
| 语音合成 | `qwen3-tts-flash` | ⚠️ 本地兜底 | 本空间 TTS 无权限，改用浏览器 `SpeechSynthesis` 朗读 |

> 注：`qwen-plus/max/flash/turbo` 等在本空间均 `403 access denied`，故文本能力统一走 `qwen-vl-max`。
> 调用形态与模型名集中在 `app/services/*.server.ts` 与 `.env`，更换工作空间只需在此调整。

## 说明
- 角色切换为前端演示上下文，非真实鉴权系统。
- 任一真实接口失败仍会自动回退 Mock，保证 UI 始终可演示。

/**
 * 图生图：把拍摄内容转为"平面纸质 + 简笔填块绘本"，可选上色。
 * 走兼容模式 chat/completions，模型 qwen-image-2.0（原生 content 形态）。
 *
 * 实测可用形态（本工作空间）：
 *   POST {imageBase}/chat/completions
 *   body: { model:"qwen-image-2.0", messages:[{role:"user", content:[{image:"<dataURL|url>"},{text:"<prompt>"}]}] }
 *   返回: output.choices[0].message.content[].image  → 生成图 OSS URL
 *
 * 为避免前端 canvas 加载远程 OSS 图片产生跨域污染（toDataURL 失败），
 * 这里把结果图在服务端拉取并转为 base64 dataURL 再返回。失败统一回退 Mock。
 */
import { canCallReal, config, dsFetch, logFallback } from "./dashscope.server";
import { mockColoringImage, mockExploreImage } from "./mock.server";

export type ImageResult = { image: string; mocked: boolean };

const BASE_PROMPT =
  "把这张照片变为平面纸质效果：扫描矫正、去除褶皱与阴影、裁掉画幅边缘的侵入与多余留白，" +
  "转化为线条干净、色块分明、适合儿童涂色的简笔填块绘本插画，纯白背景。";
const COLOR_PROMPT = "用柔和明快的色彩为每个区域均匀上色。";
const LINE_PROMPT = "仅保留黑色描边线稿，不要填充任何颜色。";

function toDataUrl(input: string): string {
  return input.startsWith("data:") ? input : `data:image/png;base64,${input}`;
}

/** 调用 qwen-image-2.0，返回生成图 URL */
async function callImageModel(imageDataUrl: string | null, prompt: string): Promise<string> {
  const content: any[] = [];
  if (imageDataUrl) content.push({ image: imageDataUrl });
  content.push({ text: prompt });

  const json = await dsFetch<any>(`${config.imageBase}/chat/completions`, {
    method: "POST",
    timeoutMs: 120_000,
    body: {
      model: config.models.image,
      messages: [{ role: "user", content }],
    },
  });
  const parts = json?.output?.choices?.[0]?.message?.content;
  const url = Array.isArray(parts) ? parts.find((p: any) => p?.image)?.image : undefined;
  if (!url) throw new Error("返回中未找到生成图");
  return url;
}

/** 拉取远程图片转 base64 dataURL（规避前端跨域污染） */
async function inlineRemoteImage(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`下载生成图失败 (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type") ?? "image/png";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export async function generateColoringImage(params: {
  imageBase64: string;
  colored: boolean;
  extraPrompt?: string;
}): Promise<ImageResult> {
  const { imageBase64, colored, extraPrompt = "" } = params;
  const prompt = `${BASE_PROMPT} ${colored ? COLOR_PROMPT : LINE_PROMPT} ${extraPrompt}`.trim();

  if (!canCallReal()) {
    return { image: mockColoringImage({ colored, hint: colored ? "上色绘本" : "简笔线稿" }), mocked: true };
  }
  try {
    const url = await callImageModel(toDataUrl(imageBase64), prompt);
    const image = await inlineRemoteImage(url);
    return { image, mocked: false };
  } catch (e) {
    logFallback("image", e);
    return { image: mockColoringImage({ colored, hint: colored ? "上色绘本" : "简笔线稿" }), mocked: true };
  }
}

/** 探索模式：以当前图为基底向某方向延展生成新图 */
export async function generateDirectionalImage(params: {
  imageBase64: string;
  direction: "up" | "down" | "left" | "right";
  step: number;
}): Promise<ImageResult> {
  const { imageBase64, direction, step } = params;
  const dirText = { up: "上方", down: "下方", left: "左侧", right: "右侧" }[direction];
  const prompt = `参考这张绘本画面的风格与色调，想象并绘制画面${dirText}相邻的新场景，构图连贯、可无缝衔接，适合儿童观看。`;

  if (!canCallReal()) {
    return { image: mockExploreImage(direction, step), mocked: true };
  }
  try {
    const url = await callImageModel(toDataUrl(imageBase64), prompt);
    const image = await inlineRemoteImage(url);
    return { image, mocked: false };
  } catch (e) {
    logFallback("image:explore", e);
    return { image: mockExploreImage(direction, step), mocked: true };
  }
}

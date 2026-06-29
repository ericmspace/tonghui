/**
 * AI 判形状：把摄像头拍到的纸面照片交给视觉模型(qwen-vl-max)，判断是否"大致画出"了目标形状。
 * 走兼容模式 chat/completions（多模态）。无 Key / 失败时回退（默认放过，不卡引导流程）。
 */
import { canCallReal, config, dsFetch, logFallback } from "./dashscope.server";

export type ShapeResult = { drawn: boolean; confidence: number; note: string; mocked: boolean };

const SYS = `你在看一张"儿童在白纸上用笔画画"的照片。判断纸上是否已经"大致画出"了我给的目标。
判定要宽松：形状可以很歪、很不规则，只要能看出在尝试画这个目标就算"画到了"(drawn=true)；
若是空白、或只有零散无意义的点线、或与目标完全无关，则 drawn=false。
严格输出 JSON（不要 markdown 代码块）：
{"drawn": true/false, "confidence": 0到1, "note": "给孩子的一句温柔反馈，不超过15字"}`;

function extractJson(text: string): any | null {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function checkShape(params: { imageBase64: string; target: string }): Promise<ShapeResult> {
  const { imageBase64, target } = params;
  const dataUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

  if (!canCallReal()) {
    return { drawn: true, confidence: 0.6, note: "（示例）画得不错", mocked: true };
  }
  try {
    const json = await dsFetch<any>(`${config.imageBase}/chat/completions`, {
      method: "POST",
      timeoutMs: 30_000,
      body: {
        model: config.models.vision,
        messages: [
          { role: "system", content: SYS },
          {
            role: "user",
            content: [
              { type: "text", text: `目标：${target}。请判断这张照片里纸上有没有大致画出来，并严格输出 JSON。` },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0.2,
      },
    });
    const content = json?.choices?.[0]?.message?.content;
    const text = Array.isArray(content) ? content.map((c: any) => c?.text ?? "").join("") : String(content ?? "");
    const parsed = extractJson(text);
    if (!parsed || typeof parsed.drawn === "undefined") throw new Error("未能解析形状 JSON");
    return {
      drawn: !!parsed.drawn,
      confidence: Number(parsed.confidence ?? 0.6),
      note: parsed.note ?? "",
      mocked: false,
    };
  } catch (e) {
    logFallback("shape", e);
    // 失败不卡流程：当作画到了（ASD 引导"宁可放过，不要卡住"）
    return { drawn: true, confidence: 0.5, note: "", mocked: true };
  }
}

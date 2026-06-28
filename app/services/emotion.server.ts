/**
 * 情绪识别：通过 chat JSON 工程，把书写过程/观察记录（文本或 IMU 摘要）
 * 交给大模型，输出结构化情绪分布。失败回退 Mock。
 */
import { canCallReal, config, dsFetch, logFallback } from "./dashscope.server";
import { mockEmotion } from "./mock.server";

export type EmotionResult = {
  primary: string;
  confidence: number;
  valence: number; // -1..1 效价
  arousal: number; // -1..1 唤醒度
  distribution: { label: string; value: number }[];
  note: string;
  mocked: boolean;
};

const SYS = `你是儿童行为情绪分析助手。根据提供的书写/行为/IMU 摘要，推断儿童情绪状态。
严格输出 JSON（无 markdown）：
{"primary":"主导情绪","confidence":0-1,"valence":-1到1,"arousal":-1到1,
 "distribution":[{"label":"平静","value":0-1}...至少5项且和约为1],
 "note":"给教师的简短建议"}`;

function extractJson(text: string): any | null {
  const cleaned = (text ?? "").replace(/```json/gi, "").replace(/```/g, "").trim();
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

export async function analyzeEmotion(params: { summary: string }): Promise<EmotionResult> {
  const { summary } = params;
  if (!canCallReal()) {
    return { ...mockEmotion(), mocked: true };
  }
  try {
    const json = await dsFetch<any>(`${config.imageBase}/chat/completions`, {
      method: "POST",
      timeoutMs: 40_000,
      body: {
        model: config.models.text,
        messages: [
          { role: "system", content: SYS },
          { role: "user", content: `行为/IMU 摘要：${summary}` },
        ],
        temperature: 0.4,
      },
    });
    const text = json?.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(typeof text === "string" ? text : JSON.stringify(text));
    if (!parsed?.primary) throw new Error("未能解析情绪 JSON");
    return {
      primary: parsed.primary,
      confidence: Number(parsed.confidence ?? 0.7),
      valence: Number(parsed.valence ?? 0),
      arousal: Number(parsed.arousal ?? 0),
      distribution: Array.isArray(parsed.distribution) ? parsed.distribution : mockEmotion().distribution,
      note: parsed.note ?? "",
      mocked: false,
    };
  } catch (e) {
    logFallback("emotion", e);
    return { ...mockEmotion(), mocked: true };
  }
}

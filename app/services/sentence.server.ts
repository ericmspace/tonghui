/**
 * 看图组句：视觉模型观察绘本画面，生成一句适龄中文句子，并按"词组"切分，
 * 供孩子做打乱后的组句练习。走兼容模式 chat/completions（多模态消息）。失败回退 Mock。
 */
import { canCallReal, config, dsFetch, logFallback } from "./dashscope.server";
import { mockSentence } from "./mock.server";

export type SentenceResult = {
  /** 完整句子（词组以空格连接后的自然读法） */
  sentence: string;
  /** 按语义切好的词组，顺序即正确答案 */
  chunks: string[];
  mocked: boolean;
};

const SYS = `你是一位温柔的儿童语文老师，面向 ADHD/自闭症等特殊儿童设计"看图组句"练习。
请观察图片，用一句简单、具体、温暖的中文描述画面，并把这句话切分成 3-6 个"词组"，
每个词组是一个可独立朗读的语义单位（如主语、地点、动作短语），不要拆成单字。
严格输出 JSON（不要 markdown 代码块），字段：
{
 "sentence": "完整句子，例如：小猫在草地上晒太阳",
 "chunks": ["小猫", "在草地上", "晒太阳"]
}
要求：chunks 顺序拼起来就是 sentence；句子总长度控制在 6-16 个汉字；用词贴近幼儿园到小学低年级。`;

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

/** 归一化词组：去空白、过滤空项 */
function normalizeChunks(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((c) => (typeof c === "string" ? c.trim() : ""))
    .filter((c) => c.length > 0);
}

export async function generateSentence(params: { imageBase64: string }): Promise<SentenceResult> {
  const { imageBase64 } = params;
  const dataUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:image/png;base64,${imageBase64}`;

  if (!canCallReal()) {
    return { ...mockSentence(), mocked: true };
  }
  try {
    const json = await dsFetch<any>(`${config.imageBase}/chat/completions`, {
      method: "POST",
      timeoutMs: 60_000,
      body: {
        model: config.models.vision,
        messages: [
          { role: "system", content: SYS },
          {
            role: "user",
            content: [
              { type: "text", text: "请根据这张绘本图片生成一句话，并严格输出组句 JSON。" },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0.6,
      },
    });
    const content = json?.choices?.[0]?.message?.content;
    const text = Array.isArray(content)
      ? content.map((c: any) => c?.text ?? "").join("")
      : String(content ?? "");
    const parsed = extractJson(text);
    const chunks = normalizeChunks(parsed?.chunks);
    // 至少要切出 2 个词组才能玩组句游戏
    if (chunks.length < 2) throw new Error("未能解析有效的组句词组");
    const sentence = typeof parsed?.sentence === "string" && parsed.sentence.trim()
      ? parsed.sentence.trim()
      : chunks.join("");
    return { sentence, chunks, mocked: false };
  } catch (e) {
    logFallback("sentence", e);
    return { ...mockSentence(), mocked: true };
  }
}

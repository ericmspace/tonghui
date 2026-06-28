/**
 * 看图讲故事：视觉模型描述画面并编织适龄绘本故事，返回结构化 JSON。
 * 走兼容模式 chat/completions（多模态消息）。失败回退 Mock。
 */
import { canCallReal, config, dsFetch, logFallback } from "./dashscope.server";
import { mockStory } from "./mock.server";

export type StoryResult = {
  title: string;
  description: string;
  story: string;
  character: {
    name: string;
    description: string;
    personality?: string;
    scenario?: string;
    tags?: string[];
  };
  mocked: boolean;
};

const SYS = `你是一位温柔的儿童绘本作家，面向 ADHD/自闭症等特殊儿童创作。
请观察图片，输出严格的 JSON（不要 markdown 代码块），字段：
{
 "title": "故事标题",
 "description": "对画面的客观描述",
 "story": "一段 200-320 字、句子短、节奏稳、画面感强、温暖正向的绘本故事，可用\\n分段",
 "character": {"name":"主角名","description":"主角设定","personality":"性格","scenario":"场景","tags":["关键词"]}
}`;

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

export async function generateStory(params: { imageBase64: string }): Promise<StoryResult> {
  const { imageBase64 } = params;
  const dataUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:image/png;base64,${imageBase64}`;

  if (!canCallReal()) {
    return { ...mockStory(), mocked: true };
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
              { type: "text", text: "请根据这张绘本图片创作故事，并严格输出 JSON。" },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0.8,
      },
    });
    const content = json?.choices?.[0]?.message?.content;
    const text = Array.isArray(content)
      ? content.map((c: any) => c?.text ?? "").join("")
      : String(content ?? "");
    const parsed = extractJson(text);
    if (!parsed?.story) throw new Error("未能解析故事 JSON");
    return {
      title: parsed.title ?? "我的小故事",
      description: parsed.description ?? "",
      story: parsed.story,
      character: parsed.character ?? mockStory().character,
      mocked: false,
    };
  } catch (e) {
    logFallback("story", e);
    return { ...mockStory(), mocked: true };
  }
}

/**
 * 文本转语音。DashScope 语音合成（如 cosyvoice）。
 * 真实 TTS 多为异步/二进制返回，端点形态以官方文档为准；
 * 联调前默认回退「浏览器本地 SpeechSynthesis」方案：服务端返回 mode=local，
 * 由前端用 Web Speech API 朗读，保证可演示。
 */
import { canCallReal, config, dsFetch, logFallback } from "./dashscope.server";

export type TtsResult =
  | { mode: "url"; audioUrl: string; mocked: boolean }
  | { mode: "local"; text: string; mocked: boolean };

export async function synthesizeSpeech(params: { text: string }): Promise<TtsResult> {
  const { text } = params;
  if (!canCallReal()) {
    return { mode: "local", text, mocked: true };
  }
  try {
    const json = await dsFetch<any>(
      `${config.base}/api/v1/services/aigc/multimodal-generation/generation`,
      {
        method: "POST",
        timeoutMs: 45_000,
        body: {
          model: config.models.tts,
          input: { text },
          parameters: { voice: "longxiaobai", format: "mp3" },
        },
      }
    );
    const audioUrl = json?.output?.audio?.url ?? json?.output?.audio_url ?? json?.output?.url;
    if (!audioUrl) throw new Error("TTS 未返回音频 URL");
    return { mode: "url", audioUrl, mocked: false };
  } catch (e) {
    logFallback("tts", e);
    return { mode: "local", text, mocked: true };
  }
}

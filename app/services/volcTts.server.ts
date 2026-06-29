/**
 * 火山引擎「语音合成」（豆包语音）服务端封装。
 * 走 openspeech HTTP 接口，凭证与火山方舟(Ark)分开：
 *   语音技术控制台 → AppID / Access Token / Cluster。
 *
 * 环境变量：
 *   VOLC_TTS_APPID     语音应用 AppID
 *   VOLC_TTS_TOKEN     Access Token
 *   VOLC_TTS_CLUSTER   集群（默认 volcano_tts）
 *   VOLC_TTS_VOICE     音色（默认 BV700_streaming=灿灿，暖；豆包大模型音色见下方注释）
 *   VOLC_TTS_ENCODING  编码（默认 mp3）
 *   VOLC_TTS_SPEED     语速比例（默认 0.95，略慢更亲和）
 *
 * 未配齐凭证时返回 null，由上层回退浏览器朗读。
 *
 * 暖/豆包音色参考（填到 VOLC_TTS_VOICE）：
 *   BV700_streaming                 灿灿（通用暖女声）
 *   zh_female_tianmeixiaoyuan_moon_bigtts  甜美小源（大模型，更自然亲和）
 *   zh_female_cancan_mars_bigtts    灿灿（大模型版）
 *   zh_female_wanwanxiaohe_moon_bigtts     湾湾小何
 *   注：_bigtts 大模型音色更像豆包，但需账号已开通对应音色权限。
 */

const ENDPOINT = "https://openspeech.bytedance.com/api/v1/tts";

export interface VolcTtsConfig {
  appid: string;
  token: string;
  cluster: string;
  voice: string;
  encoding: string;
  speed: number;
}

export function volcTtsConfig(): VolcTtsConfig | null {
  const appid = process.env.VOLC_TTS_APPID;
  const token = process.env.VOLC_TTS_TOKEN;
  if (!appid || !token) return null; // 凭证不全 → 上层回退浏览器
  return {
    appid,
    token,
    cluster: process.env.VOLC_TTS_CLUSTER || "volcano_tts",
    voice: process.env.VOLC_TTS_VOICE || "BV700_streaming",
    encoding: process.env.VOLC_TTS_ENCODING || "mp3",
    speed: Number(process.env.VOLC_TTS_SPEED || "0.95"),
  };
}

export interface VolcTtsAudio {
  base64: string;
  mime: string;
}

/** 合成一句话，返回 base64 音频；失败返回 null（上层回退）。 */
export async function volcSynthesize(text: string, timeoutMs = 12_000): Promise<VolcTtsAudio | null> {
  const cfg = volcTtsConfig();
  if (!cfg || !text.trim()) return null;

  const reqid = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
  const body = {
    app: { appid: cfg.appid, token: cfg.token, cluster: cfg.cluster },
    user: { uid: "tonghui-voiceguide" },
    audio: {
      voice_type: cfg.voice,
      encoding: cfg.encoding,
      speed_ratio: cfg.speed,
    },
    request: { reqid, text, operation: "query" },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        // 注意：火山语音鉴权头格式是 "Bearer;<token>"（分号，非空格）
        Authorization: `Bearer;${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json: any = await res.json().catch(() => null);
    // 成功码 3000，data 为 base64 音频
    if (json?.code === 3000 && typeof json.data === "string" && json.data.length > 0) {
      const mime = cfg.encoding === "wav" ? "audio/wav" : cfg.encoding === "pcm" ? "audio/pcm" : "audio/mpeg";
      return { base64: json.data, mime };
    }
    console.warn(`[volcTts] 合成失败：code=${json?.code} msg=${json?.message ?? res.status}`);
    return null;
  } catch (e) {
    console.warn(`[volcTts] 请求异常：${e instanceof Error ? e.message : String(e)}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

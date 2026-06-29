// 语音引导作画系统 · TTS 封装
// 优先：服务端火山/豆包语音（暖音色，/api/voice-tts）→ 播放返回的音频；
// 回退：浏览器 Web Speech（无凭证/合成失败/不支持音频时），保证始终有声。
// 措辞硬规则由脚本/模板保证。

let cachedVoice: SpeechSynthesisVoice | null = null;
let currentAudio: HTMLAudioElement | null = null;       // 当前火山音频，供 stopSpeak 打断
const audioCache = new Map<string, string>();           // text → dataURL，避免重复合成
let volcDisabled = false;                               // 探测到无凭证后，后续直接走浏览器

function pickZhVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  // 优先「自然/在线」神经音色（Edge 的 Xiaoxiao/云希等），其次中文女声，再次任意中文
  cachedVoice =
    voices.find((v) => /zh/i.test(v.lang) && /natural|online|xiaoxiao|yunxi|晓晓|云希/i.test(v.name)) ||
    voices.find((v) => /zh[-_]?CN/i.test(v.lang) && /female|女|xiaoxiao|huihui|yaoyao/i.test(v.name)) ||
    voices.find((v) => /zh/i.test(v.lang)) ||
    null;
  return cachedVoice;
}

/** 浏览器本地朗读（回退路径） */
function speakBrowser(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "zh-CN";
      u.rate = 0.92;   // 略慢，给孩子时间
      u.pitch = 1.12;  // 略高，亲和
      const v = pickZhVoice();
      if (v) u.voice = v;
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      u.onend = finish;
      u.onerror = finish;
      const fallbackMs = 1500 + text.length * 220;
      setTimeout(finish, fallbackMs);
      window.speechSynthesis.speak(u);
    } catch {
      resolve();
    }
  });
}

/** 取火山/豆包音频的 dataURL；无凭证(204)或失败返回 null。 */
async function fetchVolcAudio(text: string): Promise<string | null> {
  if (volcDisabled) return null;
  if (audioCache.has(text)) return audioCache.get(text)!;
  try {
    const res = await fetch("/api/voice-tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.status === 204) {
      volcDisabled = true;     // 未配凭证：本会话后续不再尝试，直接走浏览器
      return null;
    }
    if (!res.ok) return null;
    const data = (await res.json()) as { audioUrl?: string };
    if (!data.audioUrl) return null;
    audioCache.set(text, data.audioUrl);
    return data.audioUrl;
  } catch {
    return null;
  }
}

/** 播放火山音频，结束/出错后 resolve。 */
function playAudio(url: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const audio = new Audio(url);
      currentAudio = audio;
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          if (currentAudio === audio) currentAudio = null;
          resolve();
        }
      };
      audio.onended = finish;
      audio.onerror = finish;
      audio.play().catch(finish);  // 自动播放被拦截等 → 回退由调用方处理
    } catch {
      resolve();
    }
  });
}

/**
 * 播报一句话。优先火山/豆包暖音色，失败回退浏览器朗读。
 * 朗读前取消上一条，避免叠音。SSR/无语音环境直接 resolve。
 */
export async function speak(text: string): Promise<void> {
  if (typeof window === "undefined") return;
  stopSpeak(); // 打断上一条（音频 + 浏览器）

  const url = await fetchVolcAudio(text);
  if (url) {
    await playAudio(url);
    // 若音频未能实际播放（被浏览器拦截），currentAudio 仍残留则不强制兜底；
    // 正常结束 onended 已 resolve。
    return;
  }
  await speakBrowser(text);
}

export function stopSpeak(): void {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {
      /* ignore */
    }
    currentAudio = null;
  }
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

// 某些浏览器语音表异步加载，提前预热一次
if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
    pickZhVoice();
  };
}

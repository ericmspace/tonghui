// 语音引导作画系统 · TTS 封装（浏览器 Web Speech API）
// 规格见 handoff §6。无密钥、纯前端。措辞硬规则由脚本/模板保证。

let cachedVoice: SpeechSynthesisVoice | null = null;

function pickZhVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  // 优先中文女声/普通话
  cachedVoice =
    voices.find((v) => /zh[-_]?CN/i.test(v.lang) && /female|女|xiaoxiao|huihui|yaoyao/i.test(v.name)) ||
    voices.find((v) => /zh/i.test(v.lang)) ||
    null;
  return cachedVoice;
}

/**
 * 播报一句话，返回在朗读结束（或出错）后 resolve 的 Promise。
 * 朗读前会取消上一条，避免叠音。SSR/无语音环境直接 resolve。
 */
export function speak(text: string): Promise<void> {
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
      // 兜底：极端情况下 onend 不触发时，按文本长度估时超时
      const fallbackMs = 1500 + text.length * 220;
      setTimeout(finish, fallbackMs);
      window.speechSynthesis.speak(u);
    } catch {
      resolve();
    }
  });
}

export function stopSpeak(): void {
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

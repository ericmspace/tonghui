/**
 * DashScope / 阿里云百炼 MaaS 统一客户端。
 * 集中读取环境变量、封装鉴权、超时与错误归一。
 * 任何上层 service 调用失败时都会抛出归一化错误，由各自的 mock 兜底接管。
 */

export const config = {
  apiKey: process.env.DASHSCOPE_API_KEY ?? "",
  workspace: process.env.DASHSCOPE_WORKSPACE ?? "",
  base: (process.env.DASHSCOPE_BASE ?? "").replace(/\/$/, ""),
  imageBase: (process.env.DASHSCOPE_IMAGE_BASE ?? "").replace(/\/$/, ""),
  models: {
    image: process.env.MODEL_IMAGE ?? "qwen-image-2.0",
    video: process.env.MODEL_VIDEO ?? "happyhorse-1.1-i2v",
    vision: process.env.MODEL_VISION ?? "qwen-vl-max",
    text: process.env.MODEL_TEXT ?? "qwen-plus",
    tts: process.env.MODEL_TTS ?? "cosyvoice-v1",
  },
  useMock: process.env.USE_MOCK === "true",
};

/** 是否具备真实联调条件 */
export function canCallReal(): boolean {
  return !config.useMock && !!config.apiKey && config.apiKey.startsWith("sk-");
}

export class DashScopeError extends Error {
  status: number;
  detail: unknown;
  constructor(message: string, status = 0, detail?: unknown) {
    super(message);
    this.name = "DashScopeError";
    this.status = status;
    this.detail = detail;
  }
}

type FetchOpts = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  /** 异步任务头 X-DashScope-Async: enable */
  async?: boolean;
};

/** 带超时与鉴权的 JSON fetch */
export async function dsFetch<T = any>(url: string, opts: FetchOpts = {}): Promise<T> {
  const { method = "POST", headers = {}, body, timeoutMs = 60_000, async: isAsync } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        ...(isAsync ? { "X-DashScope-Async": "enable" } : {}),
        ...(config.workspace ? { "X-DashScope-WorkSpace": config.workspace } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    let json: any = undefined;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = text;
    }

    if (!res.ok) {
      throw new DashScopeError(
        `DashScope 请求失败 (${res.status})`,
        res.status,
        json
      );
    }
    return json as T;
  } catch (e) {
    if (e instanceof DashScopeError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new DashScopeError("DashScope 请求超时", 408);
    }
    throw new DashScopeError(
      e instanceof Error ? e.message : "DashScope 网络错误",
      0,
      e
    );
  } finally {
    clearTimeout(timer);
  }
}

/** 统一日志（仅服务端） */
export function logFallback(scope: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.warn(`[fallback:${scope}] 真实接口不可用，使用 Mock 兜底 → ${msg}`);
}

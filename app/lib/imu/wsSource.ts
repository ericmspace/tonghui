// 笔端 IMU · WebSocket 数据源
// 订阅 Python 端 imu_ws_bridge.py 推送的实时帧，接口与 ImuSimulator 对齐
// （都有 onFrame + start/stop），便于在 useImuMonitor 里互换。

import type { ImuFrame } from "./types";

// 用 127.0.0.1 而非 localhost：避免某些环境 localhost 先解析到 IPv6(::1) 而桥只在 IPv4 监听导致连不上
export const DEFAULT_WS_URL = "ws://127.0.0.1:8765";

export type WsStatus = "connecting" | "open" | "closed" | "error";

export class ImuWsSource {
  private ws: WebSocket | null = null;
  onFrame: ((f: ImuFrame) => void) | null = null;
  onStatus: ((s: WsStatus) => void) | null = null;

  constructor(private url: string = DEFAULT_WS_URL) {}

  start() {
    if (typeof window === "undefined" || typeof WebSocket === "undefined") return;
    try {
      this.onStatus?.("connecting");
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.onopen = () => this.onStatus?.("open");
      ws.onmessage = (ev) => {
        try {
          const f = JSON.parse(ev.data as string);
          if (f && typeof f.ax === "number" && typeof f.temp === "number") {
            this.onFrame?.(f as ImuFrame);
          }
        } catch {
          /* 跳过坏帧 */
        }
      };
      ws.onerror = () => this.onStatus?.("error");
      ws.onclose = () => this.onStatus?.("closed");
    } catch {
      this.onStatus?.("error");
    }
  }

  stop() {
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
  }
}

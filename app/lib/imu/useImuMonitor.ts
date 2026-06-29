// 笔端 IMU · 实时监测 hook
// 数据源可选：'sim'（前端内置模拟）或 'ws'（订阅 Python WebSocket 桥的真实/模拟笔）。
// 选 'ws' 但连不上时，自动回退到内置模拟，保证体验不中断。

import { useCallback, useEffect, useRef, useState } from "react";
import { ImuSimulator } from "./simulator";
import { ImuWsSource, DEFAULT_WS_URL } from "./wsSource";
import { RealtimeImuAnalyzer } from "./analysis";
import type { ImuFrame, ImuLiveState, ImuSessionSummary } from "./types";

const UI_THROTTLE = 6; // 每 6 帧刷新一次 UI（约 10fps @60Hz）
const WS_FALLBACK_MS = 3500; // 选真实笔后多久没收到帧就回退模拟

export type SourceKind = "sim" | "ws";
export type SourceStatus = "sim" | "ws-connecting" | "ws-open" | "ws-fallback";

interface StartOpts {
  source?: SourceKind;
  wsUrl?: string;
}

interface Source {
  stop: () => void;
}

export function useImuMonitor() {
  const [state, setState] = useState<ImuLiveState | null>(null);
  const [status, setStatus] = useState<SourceStatus>("sim");
  const sourceRef = useRef<Source | null>(null);
  const anaRef = useRef<RealtimeImuAnalyzer | null>(null);
  const frameCount = useRef(0);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startSim = useCallback((onFrame: (f: ImuFrame) => void) => {
    const sim = new ImuSimulator({ fs: 60 });
    sim.onFrame = onFrame;
    sim.start();
    sourceRef.current = sim;
  }, []);

  const start = useCallback(
    (opts?: StartOpts) => {
      if (sourceRef.current) return; // 已在运行
      const ana = new RealtimeImuAnalyzer();
      anaRef.current = ana;
      frameCount.current = 0;
      const onFrame = (f: ImuFrame) => {
        const st = ana.push(f);
        frameCount.current++;
        if (frameCount.current % UI_THROTTLE === 0) setState(st);
      };

      if (opts?.source === "ws") {
        setStatus("ws-connecting");
        const ws = new ImuWsSource(opts.wsUrl || DEFAULT_WS_URL);
        let gotFrame = false;
        ws.onStatus = (s) => {
          if (s === "open") setStatus("ws-open");
        };
        ws.onFrame = (f) => {
          gotFrame = true;
          onFrame(f);
        };
        ws.start();
        sourceRef.current = ws;
        // 连不上 / 一直没数据 → 回退到内置模拟
        fallbackTimer.current = setTimeout(() => {
          if (!gotFrame) {
            ws.stop();
            startSim(onFrame);
            setStatus("ws-fallback");
          }
        }, WS_FALLBACK_MS);
      } else {
        setStatus("sim");
        startSim(onFrame);
      }
    },
    [startSim]
  );

  const stop = useCallback(() => {
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    sourceRef.current?.stop();
    sourceRef.current = null;
    if (anaRef.current?.state) setState(anaRef.current.state);
  }, []);

  const poke = useCallback(() => {
    const s = sourceRef.current as { poke?: () => void } | null;
    s?.poke?.();
  }, []);

  const summary = useCallback((): ImuSessionSummary | null => {
    return anaRef.current?.summary() ?? null;
  }, []);

  // 读取最新一帧的实时状态（不受 UI 节流影响），供安抚等实时逻辑同步查询
  const getState = useCallback((): ImuLiveState | null => {
    return anaRef.current?.state ?? null;
  }, []);

  const reset = useCallback(() => {
    setState(null);
    anaRef.current = null;
  }, []);

  useEffect(
    () => () => {
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
      sourceRef.current?.stop();
    },
    []
  );

  return { state, status, start, stop, poke, summary, getState, reset };
}

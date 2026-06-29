// 笔端 IMU · 模拟流（占位，预留真实数据源接口）
// ============================================
// 在没有真实 WebSocket 桥接前，前端用它实时产生 accel/gyro/温度，
// 让实时算法与 UI 先做实做对。要接真实笔时，把它换成订阅 ws 的同形态 source 即可
// （只需保证 onFrame 回调收到 {t,ax,ay,az,gx,gy,gz,temp}）。
//
// 模型：静息基线 + 随机出现的「应激片段」。应激时——手抖幅度与频率上升、
// 温度缓升——以此驱动后续的手抖/紧张检测有真实可观察的起伏。

import type { ImuFrame } from "./types";

const GRAVITY = 9.80665;

export interface SimulatorOptions {
  fs?: number; // 采样率 Hz
}

export class ImuSimulator {
  private fs: number;
  private dt: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private t0 = 0;
  private elapsed = 0; // 秒
  private phase = 0; // 抖动相位

  // 应激包络 0~1：缓动趋向 target，target 每隔几秒重选
  private stress = 0.08;
  private stressTarget = 0.08;
  private nextSwitch = 4;

  private baseTemp = 30.4;
  private tempDrift = 0;

  onFrame: ((f: ImuFrame) => void) | null = null;

  constructor(opts: SimulatorOptions = {}) {
    this.fs = opts.fs ?? 60;
    this.dt = 1 / this.fs;
  }

  /** 手动注入一次应激（演示「紧张」用） */
  poke(level = 0.85) {
    this.stressTarget = level;
    this.nextSwitch = this.elapsed + 4 + Math.random() * 3;
  }

  private rnd(s = 1) {
    return (Math.random() * 2 - 1) * s;
  }

  private step(): ImuFrame {
    this.elapsed += this.dt;

    // —— 应激包络演化 ——
    if (this.elapsed >= this.nextSwitch) {
      // 一半概率平静、一半概率进入紧张片段
      this.stressTarget = Math.random() < 0.5 ? 0.05 + Math.random() * 0.15 : 0.55 + Math.random() * 0.4;
      this.nextSwitch = this.elapsed + 3 + Math.random() * 5;
    }
    this.stress += (this.stressTarget - this.stress) * 0.02; // 缓动

    // —— 手抖：应激越高，幅度与频率越大 ——
    const tremorFreq = 5 + this.stress * 3.5; // 5~8.5Hz
    const tremorAmp = 0.3 + this.stress * 10; // 贴近真实手抖量级：平静~0.3、应激~10 m/s²
    this.phase += 2 * Math.PI * tremorFreq * this.dt;
    const tremor = tremorAmp * Math.sin(this.phase);

    // —— 体温：应激→外周皮温下降（交感血管收缩）+ 微小随机漂移 ——
    this.tempDrift += this.rnd(0.004);
    this.tempDrift = Math.max(-0.3, Math.min(0.3, this.tempDrift));
    const temp = this.baseTemp - this.stress * 1.5 + this.tempDrift;
    // —— 环境光：应激片段里模拟变亮/波动 ——
    const light = 1900 + this.stress * 220 + this.rnd(30);

    const f: ImuFrame = {
      t: this.t0 + this.elapsed * 1000,
      ax: tremor + this.rnd(0.03),
      ay: 0.6 * tremor + this.rnd(0.03),
      az: GRAVITY + 0.3 * tremor + this.rnd(0.03),
      gx: this.rnd(0.02) + 0.3 * tremor,
      gy: this.rnd(0.02),
      gz: this.rnd(0.02) + 0.2 * tremor,
      temp: Math.round(temp * 100) / 100,
      light: Math.round(light * 10) / 10,
    };
    return f;
  }

  start() {
    if (this.timer) return;
    this.t0 = Date.now();
    this.elapsed = 0;
    this.timer = setInterval(() => {
      const f = this.step();
      this.onFrame?.(f);
    }, this.dt * 1000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

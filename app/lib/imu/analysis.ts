// 笔端 IMU · 实时分析算法
// ========================
// 阈值按真实笔实测标定（100Hz，单位 m/s²）：
//   静止 高通RMS≈0.18，正常写画≈1.2~1.9，用力抖≈10~18。
//
// 1) 手抖：对加速度做"减 0.12s 滑动均值"的高通，只留 >~4Hz 的振动（剔除写字这种低频大动作），
//    再算三轴合成 RMS。这样"正常写字"不会被当成手抖；只有真正的高频抖动才会高。
//    判定：高通 RMS 超阈值且过零主频落在手抖带。
//
// 2) 紧张度：以"运动激动程度"为主（高通 RMS 从平静到激动映射），温度上升为辅
//    （NTC 短时段几乎不变，仅作小权重修正）。绝对值为代理指标，非情绪诊断。

import type { ImuFrame, ImuLiveState, ImuSessionSummary, TensionLevel } from "./types";

// —— 手抖（高通 RMS, m/s²）——
const TREMOR_RMS_THRESH = 3.0; // 介于"正常写画(≈1.9)"与"抖(≈10)"之间
const TREMOR_FMIN = 3;
const TREMOR_FMAX = 15;
const TREMOR_BAR_MAX = 12; // UI 进度条满格对应的高通 RMS

// —— 紧张度（多模态：运动激动为主 + 体温下降 + 环境光骤变） ——
// 理论依据（落正式报告前请核对一手文献）：
//  ① 运动激动/手抖随交感唤醒升高 → 用高通 RMS 衡量。
//  ② 体温(外周皮温)：急性应激→交感血管收缩→指端皮温"下降"（不是升高）。
//     Vinkers C.H. et al. (2013) "The effect of stress on core and peripheral body
//     temperature in humans", Stress 16(5):520-530；热生物反馈以"指温回升=放松"。
//  ③ 环境光：强光/骤变是 ASD 儿童常见的感觉超载诱因。
//     Marco E.J. et al. (2011) "Sensory processing in autism", Pediatr Res 69(5R)；
//     DSM-5 将"对感觉输入过度反应"列为 ASD 诊断标准；
//     光提升警觉/唤醒 Cajochen C. (2007) "Alerting effects of light", Sleep Med Rev 11(6)。
// 三者均为"代理指标、非诊断"；以运动为主、体温/环境光为辅；阈值需按实采数据标定。
const TENSION_MOTION_CALM = 2.0; // 高通 RMS 到此算"平静"
const TENSION_MOTION_AGITATED = 11.0; // 到此算"激动满档"
const TEMP_DROP_SCALE = 0.8; // 体温相对基线"下降"多少(°C)算满档
const LIGHT_DEV_SCALE = 300; // 环境光相对基线偏离多少(ADC)算满档
const W_MOTION = 0.7; // 紧张度权重：运动激动
const W_TEMP = 0.15; // 紧张度权重：体温下降
const W_LIGHT = 0.15; // 紧张度权重：环境光骤变
const BASE_EMA = 0.002; // 体温/环境光基线慢速 EMA（代表平静参考）
const HP_SECONDS = 0.12; // 高通的滑动均值时长（截止≈4Hz）

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export { TREMOR_BAR_MAX };

export class RealtimeImuAnalyzer {
  private win: ImuFrame[] = [];
  private windowSec: number;
  private baseTemp: number | null = null;
  private baseLight: number | null = null;

  // 会话聚合
  private nFrames = 0;
  private tremorActiveFrames = 0;
  private tremorRmsMax = 0;
  private tensionSum = 0;
  private tensionMax = 0;
  private tempRiseMax = 0;
  private freqSamples: number[] = [];
  private firstT: number | null = null;
  private lastT = 0;
  private initTemp: number | null = null;

  private last: ImuLiveState | null = null;

  constructor(windowSec = 1.5) {
    this.windowSec = windowSec;
  }

  push(f: ImuFrame): ImuLiveState {
    if (this.firstT == null) this.firstT = f.t;
    if (this.initTemp == null) this.initTemp = f.temp;
    this.lastT = f.t;
    this.nFrames++;

    this.win.push(f);
    while (this.win.length > 1 && f.t - this.win[0].t > this.windowSec * 1000) {
      this.win.shift();
    }

    const { rms, hz } = this.tremorOfWindow();
    const tremorActive = rms > TREMOR_RMS_THRESH && hz >= TREMOR_FMIN && hz <= TREMOR_FMAX;

    const light = typeof f.light === "number" ? f.light : this.baseLight ?? 0;

    // 体温 / 环境光 基线（慢速 EMA，代表平静参考）
    this.baseTemp = this.baseTemp == null ? f.temp : this.baseTemp + BASE_EMA * (f.temp - this.baseTemp);
    this.baseLight = this.baseLight == null ? light : this.baseLight + BASE_EMA * (light - this.baseLight);
    const tempDelta = f.temp - this.baseTemp; // 负 = 体温下降
    const lightDelta = light - this.baseLight;

    // 紧张度：运动激动为主 + 体温下降 + 环境光骤变（见顶部理论依据）
    const motionTerm = clamp01((rms - TENSION_MOTION_CALM) / (TENSION_MOTION_AGITATED - TENSION_MOTION_CALM));
    const tempTerm = clamp01(-tempDelta / TEMP_DROP_SCALE); // 皮温下降 → 应激
    const lightTerm = clamp01(Math.abs(lightDelta) / LIGHT_DEV_SCALE); // 环境光偏离/骤变 → 感觉刺激
    const tension = clamp01(W_MOTION * motionTerm + W_TEMP * tempTerm + W_LIGHT * lightTerm);
    const tensionLevel: TensionLevel = tension < 0.3 ? "calm" : tension < 0.6 ? "mild" : "high";

    if (tremorActive) {
      this.tremorActiveFrames++;
      this.freqSamples.push(hz);
    }
    this.tremorRmsMax = Math.max(this.tremorRmsMax, rms);
    this.tensionSum += tension;
    this.tensionMax = Math.max(this.tensionMax, tension);
    if (this.initTemp != null) this.tempRiseMax = Math.max(this.tempRiseMax, f.temp - this.initTemp);

    this.last = {
      tremorHz: Math.round(hz * 10) / 10,
      tremorRms: Math.round(rms * 100) / 100,
      tremorActive,
      temp: Math.round(f.temp * 10) / 10,
      tempBaseline: Math.round((this.baseTemp ?? f.temp) * 10) / 10,
      tempDelta: Math.round(tempDelta * 100) / 100,
      light: Math.round(light),
      lightDelta: Math.round(lightDelta),
      tension: Math.round(tension * 100) / 100,
      tensionLevel,
      samples: this.nFrames,
    };
    return this.last;
  }

  /** 高通(减 0.12s 滑动均值)后的三轴合成 RMS + 过零主频 */
  private tremorOfWindow(): { rms: number; hz: number } {
    const n = this.win.length;
    if (n < 8) return { rms: 0, hz: 0 };
    const durSec = (this.win[n - 1].t - this.win[0].t) / 1000 || this.windowSec;
    const fs = n / durSec;
    const k = Math.max(2, Math.round(HP_SECONDS * fs));

    const ax = this.win.map((f) => f.ax);
    const ay = this.win.map((f) => f.ay);
    const az = this.win.map((f) => f.az);
    const hp = (arr: number[]) => {
      const out = new Array<number>(n);
      for (let i = 0; i < n; i++) {
        const a = Math.max(0, i - k);
        const b = Math.min(n, i + k + 1);
        let s = 0;
        for (let j = a; j < b; j++) s += arr[j];
        out[i] = arr[i] - s / (b - a);
      }
      return out;
    };
    const rx = hp(ax), ry = hp(ay), rz = hp(az);

    let sq = 0;
    for (let i = 0; i < n; i++) sq += rx[i] * rx[i] + ry[i] * ry[i] + rz[i] * rz[i];
    const rms = Math.sqrt(sq / n);

    // 主频：方差最大的高通轴做过零率
    const varOf = (d: number[]) => d.reduce((a, v) => a + v * v, 0);
    const vs = [varOf(rx), varOf(ry), varOf(rz)];
    const dom = [rx, ry, rz][vs.indexOf(Math.max(...vs))];
    let crossings = 0;
    for (let i = 1; i < n; i++) {
      if ((dom[i - 1] <= 0 && dom[i] > 0) || (dom[i - 1] >= 0 && dom[i] < 0)) crossings++;
    }
    const hz = crossings / 2 / durSec;
    return { rms, hz };
  }

  get state(): ImuLiveState | null {
    return this.last;
  }

  summary(): ImuSessionSummary {
    const durationS = this.firstT != null ? Math.round(((this.lastT - this.firstT) / 1000) * 100) / 100 : 0;
    const sortedFreq = [...this.freqSamples].sort((a, b) => a - b);
    const peakHz = sortedFreq.length ? sortedFreq[Math.floor(sortedFreq.length / 2)] : 0;
    return {
      tremor_peak_hz: Math.round(peakHz * 10) / 10,
      tremor_power: this.nFrames ? Math.round((this.tremorActiveFrames / this.nFrames) * 1000) / 1000 : 0,
      tremor_rms_max: Math.round(this.tremorRmsMax * 100) / 100,
      tension_mean: this.nFrames ? Math.round((this.tensionSum / this.nFrames) * 100) / 100 : 0,
      tension_max: Math.round(this.tensionMax * 100) / 100,
      temp_rise_max: Math.round(this.tempRiseMax * 100) / 100,
      n_frames: this.nFrames,
      duration_s: durationS,
    };
  }
}

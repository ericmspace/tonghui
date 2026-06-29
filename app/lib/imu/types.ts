// 笔端 IMU · 类型定义
// 一帧含六轴 + 温度（紧张度判断需要）。坐标系/单位：加速度 m/s²、角速度 rad/s、温度 °C。

export interface ImuFrame {
  t: number; // 毫秒时间戳
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
  temp: number; // 体温(外周皮温) °C
  light?: number; // 环境光（光敏原始 ADC）
}

export type TensionLevel = "calm" | "mild" | "high";

/** 实时分析输出（喂给 UI 的活体状态） */
export interface ImuLiveState {
  tremorHz: number; // 估计的手抖主频
  tremorRms: number; // 带限抖动幅度（m/s² 量级）
  tremorActive: boolean; // 是否判定为手抖中
  temp: number; // 当前体温(外周皮温) °C
  tempBaseline: number; // 体温基线
  tempDelta: number; // 相对基线变化（负=下降，应激时下降）
  light: number; // 当前环境光（原始 ADC）
  lightDelta: number; // 环境光相对基线的偏离（绝对值大=骤变）
  tension: number; // 紧张度 0~1
  tensionLevel: TensionLevel;
  samples: number; // 已处理帧数
}

/** 一次会话结束后的聚合摘要（用于上报教师端） */
export interface ImuSessionSummary {
  tremor_peak_hz: number; // 全程手抖主频（活跃期中位）
  tremor_power: number; // 手抖活跃时间占比（0~1，作带能量代理）
  tremor_rms_max: number;
  tension_mean: number;
  tension_max: number;
  temp_rise_max: number; // 全程相对初始基线的最大温升
  n_frames: number;
  duration_s: number;
}

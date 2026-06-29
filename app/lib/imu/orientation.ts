// 笔端 IMU · 姿态估计（陀螺 + 加速度互补滤波）
// ==========================================
// 用 Madgwick IMU 算法（仅六轴，无磁力计）把每帧 {gx,gy,gz,ax,ay,az} 融合成
// 一个朝向四元数：陀螺积分给出短时姿态变化、加速度（重力方向）修正俯仰/横滚漂移。
// 没有磁力计时航向（绕重力轴）会缓慢漂移，靠 reset() 归零即可，演示足够。
//
// 约定：四元数 q=[w,x,y,z]，参考重力沿世界 +Z（静止时 az≈+g，归一化后 (0,0,1)，与本项目
// 模拟器/真实笔一致）。toMatrix 给出"机体→世界"的旋转，可直接作用于笔的本地几何来渲染。

import type { ImuFrame } from "./types";

export type Quat = [number, number, number, number]; // w, x, y, z
export type Vec3 = [number, number, number];

const DEFAULT_BETA = 0.08; // 加速度修正增益：越大越快收敛到重力、但越抖
const MAX_DT = 0.1; // 单帧最大积分步长，防丢帧造成姿态跳变

export function quatMul(a: Quat, b: Quat): Quat {
  const [aw, ax, ay, az] = a;
  const [bw, bx, by, bz] = b;
  return [
    aw * bw - ax * bx - ay * by - az * bz,
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
  ];
}

export function quatConj(q: Quat): Quat {
  return [q[0], -q[1], -q[2], -q[3]];
}

function quatNorm(q: Quat): Quat {
  const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

/** 机体→世界 的 3x3 旋转矩阵（行主序），把本地坐标旋到世界坐标 */
export function quatToMatrix(q: Quat): number[] {
  const [w, x, y, z] = quatNorm(q);
  const xx = x * x, yy = y * y, zz = z * z;
  const xy = x * y, xz = x * z, yz = y * z;
  const wx = w * x, wy = w * y, wz = w * z;
  return [
    1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy),
    2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx),
    2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy),
  ];
}

/** 用旋转矩阵旋转一个向量 */
export function applyMatrix(m: number[], v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

export class OrientationTracker {
  /** 当前绝对姿态（相对 Madgwick 世界系） */
  q: Quat = [1, 0, 0, 0];
  /** 归零参考：渲染时用 conj(ref) ⊗ q，使「归零」那一刻的姿态显示为竖直 */
  private ref: Quat = [1, 0, 0, 0];
  private lastT: number | null = null;
  private beta: number;

  constructor(beta = DEFAULT_BETA) {
    this.beta = beta;
  }

  /** 喂入一帧，更新内部姿态 */
  update(f: ImuFrame): void {
    let dt = this.lastT == null ? 1 / 60 : (f.t - this.lastT) / 1000;
    this.lastT = f.t;
    if (!(dt > 0) || dt > MAX_DT) dt = 1 / 60; // 丢帧/乱序兜底

    let [q0, q1, q2, q3] = this.q;
    const gx = f.gx, gy = f.gy, gz = f.gz;

    // 陀螺仪贡献的四元数变化率
    let qDot0 = 0.5 * (-q1 * gx - q2 * gy - q3 * gz);
    let qDot1 = 0.5 * (q0 * gx + q2 * gz - q3 * gy);
    let qDot2 = 0.5 * (q0 * gy - q1 * gz + q3 * gx);
    let qDot3 = 0.5 * (q0 * gz + q1 * gy - q2 * gx);

    // 加速度有效时，用梯度下降一步把姿态拉向重力方向（参考重力 = (0,0,1)）
    let ax = f.ax, ay = f.ay, az = f.az;
    const an = Math.hypot(ax, ay, az);
    if (an > 1e-6) {
      ax /= an; ay /= an; az /= an;

      const _2q0 = 2 * q0, _2q1 = 2 * q1, _2q2 = 2 * q2, _2q3 = 2 * q3;
      const _4q0 = 4 * q0, _4q1 = 4 * q1, _4q2 = 4 * q2;
      const _8q1 = 8 * q1, _8q2 = 8 * q2;
      const q0q0 = q0 * q0, q1q1 = q1 * q1, q2q2 = q2 * q2, q3q3 = q3 * q3;

      let s0 = _4q0 * q2q2 + _2q2 * ax + _4q0 * q1q1 - _2q1 * ay;
      let s1 = _4q1 * q3q3 - _2q3 * ax + 4 * q0q0 * q1 - _2q0 * ay - _4q1 + _8q1 * q1q1 + _8q1 * q2q2 + _4q1 * az;
      let s2 = 4 * q0q0 * q2 + _2q0 * ax + _4q2 * q3q3 - _2q3 * ay - _4q2 + _8q2 * q1q1 + _8q2 * q2q2 + _4q2 * az;
      let s3 = 4 * q1q1 * q3 - _2q1 * ax + 4 * q2q2 * q3 - _2q2 * ay;
      const sn = Math.hypot(s0, s1, s2, s3);
      if (sn > 1e-9) {
        s0 /= sn; s1 /= sn; s2 /= sn; s3 /= sn;
        qDot0 -= this.beta * s0;
        qDot1 -= this.beta * s1;
        qDot2 -= this.beta * s2;
        qDot3 -= this.beta * s3;
      }
    }

    q0 += qDot0 * dt;
    q1 += qDot1 * dt;
    q2 += qDot2 * dt;
    q3 += qDot3 * dt;
    this.q = quatNorm([q0, q1, q2, q3]);
  }

  /** 把当前姿态设为「竖直」参考（归零/校准） */
  calibrate(): void {
    this.ref = this.q;
  }

  /** 相对归零参考的姿态：渲染用这个，归零那刻即竖直 */
  relative(): Quat {
    return quatMul(quatConj(this.ref), this.q);
  }

  reset(): void {
    this.q = [1, 0, 0, 0];
    this.ref = [1, 0, 0, 0];
    this.lastT = null;
  }
}

/** 笔轴（本地 +Y）在世界中的朝向 → 倾角读数（度） */
export function poseAngles(qRel: Quat): { tilt: number; leanFwd: number; leanSide: number } {
  const axis = applyMatrix(quatToMatrix(qRel), [0, 1, 0]); // 笔身方向
  const up = Math.max(-1, Math.min(1, axis[1]));
  const tilt = (Math.acos(up) * 180) / Math.PI; // 与竖直方向的夹角
  const leanFwd = (Math.atan2(axis[2], up) * 180) / Math.PI; // 前后倾
  const leanSide = (Math.atan2(axis[0], up) * 180) / Math.PI; // 左右倾
  return { tilt, leanFwd, leanSide };
}

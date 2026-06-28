import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
  Area,
  AreaChart,
} from "recharts";

export type ImuPoint = { t: number; ax: number; ay: number; gz: number };

/** IMU 信号折线（加速度/角速度随时间） */
export function ImuChart({ data }: { data: ImuPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
        <XAxis dataKey="t" tick={{ fill: "#a1a1a6", fontSize: 11 }} tickLine={false} axisLine={false} unit="ms" />
        <YAxis tick={{ fill: "#a1a1a6", fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: 14, border: "1px solid rgba(0,0,0,0.06)" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="ax" name="加速度X" stroke="#ff6b2c" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="ay" name="加速度Y" stroke="#5ab0ff" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="gz" name="角速度Z" stroke="#a78bfa" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** 书写轨迹（由 IMU 二次积分得到的 XY 路径，SVG 绘制） */
export function TrajectoryPath({ points }: { points: { x: number; y: number }[] }) {
  if (points.length < 2) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 16;
  const VW = 480, VH = 280;
  const sx = (x: number) => pad + ((x - minX) / (maxX - minX || 1)) * (VW - pad * 2);
  const sy = (y: number) => pad + ((y - minY) / (maxY - minY || 1)) * (VH - pad * 2);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full rounded-2xl bg-white hairline">
      <defs>
        <linearGradient id="traj" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff6b2c" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <path d={d} fill="none" stroke="url(#traj)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={sx(points[0].x)} cy={sy(points[0].y)} r={5} fill="#5ec8a8" />
      <circle cx={sx(points[points.length - 1].x)} cy={sy(points[points.length - 1].y)} r={5} fill="#ff6b2c" />
    </svg>
  );
}

/** 情绪分布面积图 */
export function EmotionArea({ data }: { data: { label: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="emo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff9eaa" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#ff9eaa" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "#6e6e73", fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: "#a1a1a6", fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 1]} />
        <Tooltip contentStyle={{ borderRadius: 14, border: "1px solid rgba(0,0,0,0.06)" }} />
        <Area type="monotone" dataKey="value" name="占比" stroke="#ff6b2c" fill="url(#emo)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

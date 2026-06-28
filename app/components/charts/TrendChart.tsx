import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

/** 维度配色（与雷达保持一致） */
export const DIM_COLORS: Record<string, string> = {
  探索欲: "#ff6b2c",
  色彩丰富度: "#5ab0ff",
  画幅利用率: "#5ec8a8",
  专注持续: "#a78bfa",
  情绪表达: "#ff9eaa",
  细节复杂度: "#ffd166",
};

export type TrendRow = { date: string } & Record<string, number | string>;

/**
 * 同一儿童多次绘画随时间的指标趋势。
 * highlight 为高亮维度（其余维度淡显），用于聚焦观察某一指标的成长曲线。
 */
export function TrendChart({
  data,
  dims,
  highlight,
}: {
  data: TrendRow[];
  dims: string[];
  highlight?: string | null;
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: "#6e6e73", fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis domain={[0, 100]} tick={{ fill: "#a1a1a6", fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ borderRadius: 14, border: "1px solid rgba(0,0,0,0.06)" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {dims.map((d) => {
          const active = !highlight || highlight === d;
          return (
            <Line
              key={d}
              type="monotone"
              dataKey={d}
              stroke={DIM_COLORS[d] ?? "#999"}
              strokeWidth={highlight === d ? 3.5 : 2}
              strokeOpacity={active ? 1 : 0.18}
              dot={{ r: highlight === d ? 4 : 2 }}
              isAnimationActive={false}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}

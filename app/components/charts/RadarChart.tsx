import {
  Radar,
  RadarChart as RC,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

export type RadarDatum = { dimension: string } & Record<string, number | string>;
export type RadarSeries = { key: string; color: string };

export function RadarChart({
  data,
  series,
}: {
  data: RadarDatum[];
  series: RadarSeries[];
}) {
  return (
    <ResponsiveContainer width="100%" height={340}>
      <RC data={data} outerRadius="72%">
        <PolarGrid stroke="rgba(0,0,0,0.08)" />
        <PolarAngleAxis dataKey="dimension" tick={{ fill: "#6e6e73", fontSize: 12 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#a1a1a6", fontSize: 10 }} axisLine={false} />
        {series.map((s) => (
          <Radar
            key={s.key}
            name={s.key}
            dataKey={s.key}
            stroke={s.color}
            fill={s.color}
            fillOpacity={0.25}
          />
        ))}
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 8px 32px rgba(17,17,26,0.12)",
          }}
        />
      </RC>
    </ResponsiveContainer>
  );
}

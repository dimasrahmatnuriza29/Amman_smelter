"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";

interface ChartData {
  type: "bar" | "line" | "pie";
  title?: string;
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  color?: string;
  colors?: string[];
}

const DEFAULT_COLORS = ["#6366f1", "#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#ec4899"];

export function MarkdownChart({ chart }: { chart: ChartData }) {
  const color = chart.color || "#6366f1";
  const colors = chart.colors || DEFAULT_COLORS;

  return (
    <div className="my-3 rounded-lg border border-border bg-surface p-3">
      {chart.title && (
        <p className="mb-2 text-xs font-semibold text-foreground">{chart.title}</p>
      )}
      <ResponsiveContainer width="100%" height={180}>
        {chart.type === "bar" ? (
          <BarChart data={chart.data} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
            <XAxis dataKey={chart.xKey} tick={{ fontSize: 10, fill: "#888" }} />
            <YAxis tick={{ fontSize: 10, fill: "#888" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a2e",
                border: "1px solid #333",
                borderRadius: "8px",
                fontSize: "11px",
              }}
            />
            <Bar dataKey={chart.yKey} fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : chart.type === "line" ? (
          <LineChart data={chart.data} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
            <XAxis dataKey={chart.xKey} tick={{ fontSize: 10, fill: "#888" }} />
            <YAxis tick={{ fontSize: 10, fill: "#888" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a2e",
                border: "1px solid #333",
                borderRadius: "8px",
                fontSize: "11px",
              }}
            />
            <Line
              type="monotone"
              dataKey={chart.yKey}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3, fill: color }}
            />
          </LineChart>
        ) : chart.type === "pie" ? (
          <PieChart>
            <Pie
              data={chart.data}
              dataKey={chart.yKey}
              nameKey={chart.xKey}
              cx="50%"
              cy="50%"
              outerRadius={70}
              label={({ name, percent }: { name?: string; percent?: number }) =>
                `${name} ${((percent || 0) * 100).toFixed(0)}%`
              }
              labelLine={{ stroke: "#555" }}
            >
              {chart.data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a2e",
                border: "1px solid #333",
                borderRadius: "8px",
                fontSize: "11px",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "10px" }} />
          </PieChart>
        ) : (
          <div>Unknown chart type</div>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function parseChartFromCode(lang: string, content: string): ChartData | null {
  if (lang !== "chart" && lang !== "json") return null;
  try {
    const parsed = JSON.parse(content);
    if (parsed.type && parsed.data && parsed.xKey && parsed.yKey) {
      return parsed as ChartData;
    }
    return null;
  } catch {
    return null;
  }
}

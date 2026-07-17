"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceDot,
} from "recharts";
import { Activity } from "lucide-react";
import type { TrendPoint } from "@/lib/types";

interface TrendChartProps {
  data: TrendPoint[];
  loading: boolean;
  machineId: string | null;
}

interface TooltipPayload {
  dataKey: string;
  value: number;
  color: string;
}

interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 shadow-xl">
      <p className="mb-1 text-[11px] text-muted">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-xs">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-muted">{p.dataKey}:</span>
          <span className="font-medium tabular-nums">
            {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function TrendChart({
  data,
  loading,
  machineId,
}: TrendChartProps) {
  if (!machineId) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Trend Analysis</h2>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted">
          <Activity size={32} className="opacity-40" />
          <p className="text-sm">Select a machine to view trend analysis</p>
          <p className="text-[11px]">Sensor readings & anomaly markers (follows month/year filter)</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 h-full flex flex-col">
        <div className="h-5 w-40 animate-pulse rounded bg-surface-2" />
        <div className="mt-3 flex-1 animate-pulse rounded bg-surface-2/30" />
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    time: new Date(d.TIMESTAMP).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));

  const anomalies = chartData.filter((d) => d.IS_ANOMALY);

  return (
    <div className="rounded-xl border border-border bg-surface p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">
          Trend Analysis — {machineId}
        </h2>
        <span className="text-[11px] text-muted">
          {data.length} points
        </span>
      </div>

      <ResponsiveContainer width="100%" className="flex-1">
        <ComposedChart
          data={chartData}
          margin={{ top: 5, right: 10, left: -15, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            opacity={0.3}
          />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: "var(--color-muted)" }}
            interval="preserveStartEnd"
            minTickGap={50}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10, fill: "var(--color-muted)" }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10, fill: "var(--color-muted)" }}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="line"
          />

          <Line
            yAxisId="right"
            type="monotone"
            dataKey="HEALTH_PCT"
            stroke="var(--color-success)"
            strokeWidth={2}
            dot={false}
            name="Health %"
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="TEMPERATURE"
            stroke="var(--color-danger)"
            strokeWidth={1.5}
            dot={false}
            name="Temp °C"
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="VIBRATION"
            stroke="var(--color-warning)"
            strokeWidth={1.5}
            dot={false}
            name="Vibration mm/s"
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="PRESSURE"
            stroke="var(--color-primary)"
            strokeWidth={1.5}
            dot={false}
            name="Pressure bar"
          />

          {/* Anomaly markers */}
          {anomalies.map((a, i) => (
            <ReferenceDot
              key={i}
              yAxisId="right"
              x={a.time}
              y={a.HEALTH_PCT}
              r={4}
              fill="var(--color-warning)"
              stroke="var(--color-warning)"
              fillOpacity={0.6}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

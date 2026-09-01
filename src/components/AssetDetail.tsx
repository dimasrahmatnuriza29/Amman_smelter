"use client";

import {
  Thermometer,
  Waves,
  Gauge,
  Clock,
  BatteryLow,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssetDetail } from "@/lib/types";

interface AssetDetailProps {
  data: AssetDetail | null;
  loading: boolean;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  color,
}: {
  icon: typeof Thermometer;
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/50 p-3">
      <div className="flex items-center gap-1.5 text-muted">
        <Icon size={14} className={color} />
        <span className="text-[11px]">{label}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-lg font-semibold tabular-nums">{value}</span>
        <span className="text-[11px] text-muted">{unit}</span>
      </div>
    </div>
  );
}

export default function AssetDetailPanel({ data, loading }: AssetDetailProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="h-5 w-32 animate-pulse rounded bg-surface-2" />
        <div className="mt-3 grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded bg-surface-2/50" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-center text-sm text-muted py-8">
          Select a machine from the table to view details
        </p>
      </div>
    );
  }

  const healthColor =
    data.HEALTH_PCT >= 80
      ? "text-success"
      : data.HEALTH_PCT >= 55
        ? "text-warning"
        : "text-danger";

  const healthBg =
    data.HEALTH_PCT >= 80
      ? "bg-success"
      : data.HEALTH_PCT >= 55
        ? "bg-warning"
        : "bg-danger";

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">{data.MACHINE_ID}</h2>
          <p className="text-[11px] text-muted capitalize">
            {data.MACHINE_TYPE} • {data.IS_RUNNING ? "Running" : "Stopped"}
          </p>
        </div>
        <span
          className={cn(
            "rounded px-2 py-0.5 text-[11px] font-medium",
            data.HEALTH_STATUS === "HEALTHY"
              ? "bg-success/15 text-success"
              : data.HEALTH_STATUS === "WARNING"
                ? "bg-warning/15 text-warning"
                : "bg-danger/15 text-danger"
          )}
        >
          {data.HEALTH_STATUS}
        </span>
      </div>

      {/* Health Gauge */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">Health Score</span>
          <span className={cn("font-bold tabular-nums", healthColor)}>
            {data.HEALTH_PCT}%
          </span>
        </div>
        <div className="mt-1.5 h-2.5 rounded-full bg-surface-2 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", healthBg)}
            style={{ width: `${data.HEALTH_PCT}%` }}
          />
        </div>
      </div>

      {/* Sensor Metrics */}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-2">
        <MetricCard
          icon={Thermometer}
          label="Temperature"
          value={data.TEMPERATURE.toString()}
          unit="°C"
          color="text-danger"
        />
        <MetricCard
          icon={Waves}
          label="Vibration"
          value={data.VIBRATION.toString()}
          unit="mm/s"
          color="text-warning"
        />
        <MetricCard
          icon={Gauge}
          label="Pressure"
          value={data.PRESSURE.toString()}
          unit="bar"
          color="text-primary"
        />
      </div>

      {/* Secondary Metrics */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <MetricCard
          icon={Clock}
          label="Op. Hours"
          value={data.OPERATIONAL_TIME.toString()}
          unit="hrs"
          color="text-muted"
        />
        <MetricCard
          icon={BatteryLow}
          label="RUL (est.)"
          value={data.RUL_DAYS.toString()}
          unit="days"
          color="text-purple"
        />
      </div>

      {/* Anomaly Type Breakdown */}
      {data.IS_ANOMALY && (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold text-muted uppercase tracking-wide">Anomaly Type</p>
          <div className="grid grid-cols-3 gap-2">
            <div className={cn("rounded-lg border px-3 py-2", data.IS_TEMPERATURE_ANOMALY ? "border-warning/30 bg-warning/5" : "border-border bg-surface-2/30")}>
              <div className="flex items-center gap-1.5">
                <Thermometer size={12} className={data.IS_TEMPERATURE_ANOMALY ? "text-warning" : "text-muted"} />
                <span className="text-[10px] text-muted">Temp</span>
              </div>
              <p className={cn("mt-0.5 text-sm font-bold", data.IS_TEMPERATURE_ANOMALY ? "text-warning" : "text-muted")}>
                {data.IS_TEMPERATURE_ANOMALY ? "Anomaly" : "Normal"}
              </p>
            </div>
            <div className={cn("rounded-lg border px-3 py-2", data.IS_VIBRATION_ANOMALY ? "border-warning/30 bg-warning/5" : "border-border bg-surface-2/30")}>
              <div className="flex items-center gap-1.5">
                <Waves size={12} className={data.IS_VIBRATION_ANOMALY ? "text-warning" : "text-muted"} />
                <span className="text-[10px] text-muted">Vib</span>
              </div>
              <p className={cn("mt-0.5 text-sm font-bold", data.IS_VIBRATION_ANOMALY ? "text-warning" : "text-muted")}>
                {data.IS_VIBRATION_ANOMALY ? "Anomaly" : "Normal"}
              </p>
            </div>
            <div className={cn("rounded-lg border px-3 py-2", data.IS_PRESSURE_ANOMALY ? "border-warning/30 bg-warning/5" : "border-border bg-surface-2/30")}>
              <div className="flex items-center gap-1.5">
                <Gauge size={12} className={data.IS_PRESSURE_ANOMALY ? "text-warning" : "text-muted"} />
                <span className="text-[10px] text-muted">Press</span>
              </div>
              <p className={cn("mt-0.5 text-sm font-bold", data.IS_PRESSURE_ANOMALY ? "text-warning" : "text-muted")}>
                {data.IS_PRESSURE_ANOMALY ? "Anomaly" : "Normal"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Anomaly Alert Banner */}
      {data.IS_ANOMALY && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2">
          <AlertTriangle size={16} className="text-warning shrink-0" />
          <span className="text-sm font-bold text-warning">ANOMALY DETECTED</span>
        </div>
      )}

    </div>
  );
}

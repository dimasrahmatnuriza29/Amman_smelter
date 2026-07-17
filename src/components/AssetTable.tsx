"use client";

import { useState } from "react";
import { AlertTriangle, Thermometer, Waves, Gauge, X, TrendingDown, TrendingUp, Minus, ChevronRight, History, Clock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Asset } from "@/lib/types";

interface AssetTableProps {
  assets: Asset[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  filterMonth?: number;
  filterYear?: number;
}

const NORMAL_RANGES: Record<string, {
  temp?: { min: number; max: number; unit: string; desc: string };
  vib?: { min: number; max: number; unit: string; desc: string };
  press?: { min: number; max: number; unit: string; desc: string };
}> = {
  conveyor: {
    temp: { min: 0, max: 60, unit: "°C", desc: "Bearing temp < 60°C" },
    vib: { min: 0, max: 4.5, unit: "mm/s", desc: "ISO 10816 Zone B < 4.5 mm/s" },
  },
  furnace: {
    temp: { min: 1150, max: 1250, unit: "°C", desc: "Bath temp 1150-1250°C" },
  },
  motor: {
    temp: { min: 0, max: 70, unit: "°C", desc: "Bearing temp < 70°C" },
    vib: { min: 0, max: 4.5, unit: "mm/s", desc: "ISO 10816 < 4.5 mm/s" },
  },
  slurry_pump: {
    temp: { min: 0, max: 70, unit: "°C", desc: "Bearing/seal temp < 70°C" },
    vib: { min: 0, max: 4.5, unit: "mm/s", desc: "ISO 10816 < 4.5 mm/s" },
    press: { min: 4.5, max: 5.5, unit: "bar", desc: "Discharge pressure 4.5-5.5 bar" },
  },
};

interface AnomalyPopupData {
  machineId: string;
  machineType: string;
  sensor: "temperature" | "vibration" | "pressure";
  actualValue: number;
  healthPct: number;
  healthStatus: string;
}

interface HistoryPopupData {
  machineId: string;
  machineType: string;
  anomalyCount: number;
  tempCount: number;
  vibCount: number;
  pressCount: number;
  firstAnomaly: string | null;
  lastAnomaly: string | null;
  healthPct: number;
  healthStatus: string;
}

interface HistoryEvent {
  TIMESTAMP: string;
  TEMPERATURE: number;
  VIBRATION: number;
  PRESSURE: number;
  HEALTH_PCT: number;
  IS_TEMPERATURE_ANOMALY: boolean;
  IS_VIBRATION_ANOMALY: boolean;
  IS_PRESSURE_ANOMALY: boolean;
}

function getSensorInfo(sensor: string, machineType: string) {
  const ranges = NORMAL_RANGES[machineType.toLowerCase()];
  if (!ranges) return null;
  if (sensor === "temperature" && ranges.temp) return ranges.temp;
  if (sensor === "vibration" && ranges.vib) return ranges.vib;
  if (sensor === "pressure" && ranges.press) return ranges.press;
  return null;
}

function statusColor(status: string) {
  switch (status.toUpperCase()) {
    case "HEALTHY":
      return { text: "text-success", bg: "bg-success/15", bar: "bg-success" };
    case "WARNING":
      return { text: "text-warning", bg: "bg-warning/15", bar: "bg-warning" };
    case "CRITICAL":
      return { text: "text-danger", bg: "bg-danger/15", bar: "bg-danger" };
    default:
      return { text: "text-muted", bg: "bg-surface-2", bar: "bg-muted" };
  }
}

function TrendIcon({ value }: { value: number }) {
  if (value < -0.5)
    return <TrendingDown size={14} className="text-danger" />;
  if (value > 0.5)
    return <TrendingUp size={14} className="text-success" />;
  return <Minus size={14} className="text-muted" />;
}

export default function AssetTable({
  assets,
  loading,
  selectedId,
  onSelect,
  filterMonth,
  filterYear,
}: AssetTableProps) {
  const [popup, setPopup] = useState<AnomalyPopupData | null>(null);
  const [historyPopup, setHistoryPopup] = useState<HistoryPopupData | null>(null);
  const [historyEvents, setHistoryEvents] = useState<HistoryEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="h-5 w-40 animate-pulse rounded bg-surface-2" />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-surface-2/50" />
          ))}
        </div>
      </div>
    );
  }

  const sensorIcon = (sensor: "temperature" | "vibration" | "pressure") => {
    if (sensor === "temperature") return <Thermometer size={16} className="text-danger" />;
    if (sensor === "vibration") return <Waves size={16} className="text-warning" />;
    return <Gauge size={16} className="text-primary" />;
  };

  const sensorLabel = (sensor: string) => {
    if (sensor === "temperature") return "Temperature";
    if (sensor === "vibration") return "Vibration";
    return "Pressure";
  };

  const sensorUnit = (sensor: string) => {
    if (sensor === "temperature") return "°C";
    if (sensor === "vibration") return "mm/s";
    return "bar";
  };

  const anomalyCount = (asset: Asset) =>
    (asset.IS_TEMPERATURE_ANOMALY ? 1 : 0) +
    (asset.IS_VIBRATION_ANOMALY ? 1 : 0) +
    (asset.IS_PRESSURE_ANOMALY ? 1 : 0);

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">Asset Health Overview</h2>
        <span className="text-[11px] text-muted">{assets.length} machines · {assets[0]?.TIMESTAMP?.substring(0, 10) || "—"}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] text-muted">
            <th className="px-4 py-2 font-medium">Machine</th>
            <th className="px-4 py-2 font-medium">Health</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Anomalies</th>
            <th className="px-4 py-2 font-medium text-center">History</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => {
            const sc = statusColor(asset.HEALTH_STATUS);
            const isSelected = selectedId === asset.MACHINE_ID;
            const anomalies = anomalyCount(asset);
            return (
              <tr
                key={asset.MACHINE_ID}
                onClick={() => onSelect(asset.MACHINE_ID)}
                className={cn(
                  "cursor-pointer border-b border-border/50 transition-colors",
                  isSelected
                    ? "bg-primary/10"
                    : "hover:bg-surface-2/50"
                )}
              >
                {/* Machine + Type + Status Dot */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", sc.bar)} />
                    <div>
                      <p className="font-medium leading-tight">{asset.MACHINE_ID}</p>
                      <p className="text-[11px] text-muted capitalize leading-tight">{asset.MACHINE_TYPE}</p>
                    </div>
                  </div>
                </td>

                {/* Health Bar */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", sc.bar)}
                        style={{ width: `${asset.HEALTH_PCT}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-xs font-medium">
                      {asset.HEALTH_PCT}%
                    </span>
                  </div>
                </td>

                {/* Status Badge */}
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-[11px] font-medium",
                      sc.bg,
                      sc.text
                    )}
                  >
                    {asset.HEALTH_STATUS}
                  </span>
                </td>

                {/* Anomalies — combined icons, click for popup */}
                <td className="px-4 py-3">
                  {anomalies > 0 ? (
                    <div className="flex items-center gap-1.5">
                      {asset.IS_TEMPERATURE_ANOMALY && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPopup({
                              machineId: asset.MACHINE_ID,
                              machineType: asset.MACHINE_TYPE,
                              sensor: "temperature",
                              actualValue: asset.TEMPERATURE,
                              healthPct: asset.HEALTH_PCT,
                              healthStatus: asset.HEALTH_STATUS,
                            });
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-danger/10 px-1.5 py-0.5 text-[11px] font-medium text-danger hover:bg-danger/20 transition-colors"
                          title="Temperature anomaly — click for details"
                        >
                          <Thermometer size={12} />
                          Temp
                        </button>
                      )}
                      {asset.IS_VIBRATION_ANOMALY && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPopup({
                              machineId: asset.MACHINE_ID,
                              machineType: asset.MACHINE_TYPE,
                              sensor: "vibration",
                              actualValue: asset.VIBRATION,
                              healthPct: asset.HEALTH_PCT,
                              healthStatus: asset.HEALTH_STATUS,
                            });
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-warning/10 px-1.5 py-0.5 text-[11px] font-medium text-warning hover:bg-warning/20 transition-colors"
                          title="Vibration anomaly — click for details"
                        >
                          <Waves size={12} />
                          Vib
                        </button>
                      )}
                      {asset.IS_PRESSURE_ANOMALY && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPopup({
                              machineId: asset.MACHINE_ID,
                              machineType: asset.MACHINE_TYPE,
                              sensor: "pressure",
                              actualValue: asset.PRESSURE,
                              healthPct: asset.HEALTH_PCT,
                              healthStatus: asset.HEALTH_STATUS,
                            });
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
                          title="Pressure anomaly — click for details"
                        >
                          <Gauge size={12} />
                          Press
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                      <span className="h-1.5 w-1.5 rounded-full bg-success/50" />
                      Normal
                    </span>
                  )}
                </td>

                {/* History — anomaly event count in filter period, click for popup */}
                <td className="px-4 py-3 text-center">
                  {asset.ANOMALY_HISTORY_COUNT > 0 ? (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        setHistoryPopup({
                          machineId: asset.MACHINE_ID,
                          machineType: asset.MACHINE_TYPE,
                          anomalyCount: asset.ANOMALY_HISTORY_COUNT,
                          tempCount: asset.TEMP_ANOMALY_COUNT,
                          vibCount: asset.VIB_ANOMALY_COUNT,
                          pressCount: asset.PRESS_ANOMALY_COUNT,
                          firstAnomaly: asset.FIRST_ANOMALY_TS,
                          lastAnomaly: asset.LAST_ANOMALY_TS,
                          healthPct: asset.HEALTH_PCT,
                          healthStatus: asset.HEALTH_STATUS,
                        });
                        setHistoryEvents([]);
                        setHistoryLoading(true);
                        try {
                          const params = new URLSearchParams({ machineId: asset.MACHINE_ID });
                          if (filterMonth) params.set("month", String(filterMonth));
                          if (filterYear) params.set("year", String(filterYear));
                          params.set("limit", "500");
                          const res = await fetch(`/api/assets/history?${params}`);
                          if (res.ok) {
                            const data = await res.json();
                            setHistoryEvents(data);
                          }
                        } catch (err) {
                          console.error("Failed to load history events:", err);
                        } finally {
                          setHistoryLoading(false);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-md bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning hover:bg-warning/20 transition-colors"
                      title="Click to view anomaly history"
                    >
                      <History size={12} />
                      {asset.ANOMALY_HISTORY_COUNT}
                    </button>
                  ) : (
                    <span className="text-[11px] text-muted">0</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Anomaly Detail Popup */}
      {popup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setPopup(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {sensorIcon(popup.sensor)}
                <div>
                  <h3 className="text-sm font-semibold">{sensorLabel(popup.sensor)} Anomaly</h3>
                  <p className="text-[11px] text-muted">{popup.machineId} · {popup.machineType}</p>
                </div>
              </div>
              <button
                onClick={() => setPopup(null)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Actual vs Normal */}
            <div className="space-y-3">
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-muted uppercase tracking-wide">Actual Reading</span>
                  <span className="text-lg font-bold tabular-nums text-warning">
                    {popup.actualValue} {sensorUnit(popup.sensor)}
                  </span>
                </div>
                {(() => {
                  const info = getSensorInfo(popup.sensor, popup.machineType);
                  if (info) {
                    return (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted uppercase tracking-wide">Normal Range</span>
                        <span className="text-sm font-medium tabular-nums text-success">
                          {info.min}–{info.max} {info.unit}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted">Normal Range</span>
                      <span className="text-[11px] text-muted italic">No spec range in guide</span>
                    </div>
                  );
                })()}
              </div>

              {/* Deviation Analysis */}
              {(() => {
                const info = getSensorInfo(popup.sensor, popup.machineType);
                if (info) {
                  const isAbove = popup.actualValue > info.max;
                  const isBelow = popup.actualValue < info.min;
                  const deviation = isAbove
                    ? ((popup.actualValue - info.max) / info.max * 100).toFixed(1)
                    : isBelow
                      ? ((info.min - popup.actualValue) / info.min * 100).toFixed(1)
                      : "0";
                  return (
                    <div className="rounded-lg border border-border bg-surface-2/50 p-3">
                      <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">Deviation Analysis</p>
                      <div className="flex items-center gap-2">
                        {isAbove ? (
                          <TrendingUp size={14} className="text-danger" />
                        ) : isBelow ? (
                          <TrendingDown size={14} className="text-danger" />
                        ) : (
                          <Minus size={14} className="text-muted" />
                        )}
                        <span className={cn(
                          "text-sm font-bold tabular-nums",
                          (isAbove || isBelow) ? "text-danger" : "text-success"
                        )}>
                          {isAbove ? "+" : isBelow ? "-" : ""}{deviation}%
                        </span>
                        <span className="text-[11px] text-muted">
                          {isAbove ? `above max (${info.max} ${info.unit})` : isBelow ? `below min (${info.min} ${info.unit})` : "within range"}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] text-muted">
                        {info.desc}
                      </p>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Machine Context */}
              <div className="rounded-lg border border-border bg-surface-2/50 p-3">
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">Machine Context</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted">Health</span>
                    <p className={cn(
                      "font-bold tabular-nums",
                      popup.healthPct >= 80 ? "text-success" : popup.healthPct >= 55 ? "text-warning" : "text-danger"
                    )}>
                      {popup.healthPct}% ({popup.healthStatus})
                    </p>
                  </div>
                  <div>
                    <span className="text-muted">Machine Type</span>
                    <p className="font-medium capitalize">{popup.machineType}</p>
                  </div>
                </div>
              </div>

              {/* Explanation */}
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">Why is this an anomaly?</p>
                <p className="text-xs text-foreground leading-relaxed">
                  {(() => {
                    const info = getSensorInfo(popup.sensor, popup.machineType);
                    const sensorName = sensorLabel(popup.sensor).toLowerCase();
                    if (info) {
                      const isAbove = popup.actualValue > info.max;
                      const isBelow = popup.actualValue < info.min;
                      if (isAbove) {
                        return `The ${sensorName} reading of ${popup.actualValue} ${sensorUnit(popup.sensor)} exceeds the normal maximum of ${info.max} ${info.unit} for ${popup.machineType} equipment. ${info.desc}. This deviation may indicate a developing issue that requires inspection.`;
                      } else if (isBelow) {
                        return `The ${sensorName} reading of ${popup.actualValue} ${sensorUnit(popup.sensor)} is below the normal minimum of ${info.min} ${info.unit} for ${popup.machineType} equipment. ${info.desc}. This may indicate abnormal operating conditions.`;
                      } else {
                        return `The ${sensorName} reading of ${popup.actualValue} ${sensorUnit(popup.sensor)} is within the normal range (${info.min}–${info.max} ${info.unit}), but the anomaly detection model flagged it based on statistical deviation from the machine type baseline.`;
                      }
                    }
                    return `The anomaly detection model flagged the ${sensorName} reading of ${popup.actualValue} ${sensorUnit(popup.sensor)} as statistically anomalous for ${popup.machineType} equipment. No specific normal range is available in the troubleshooting guide for this sensor type.`;
                  })()}
                </p>
              </div>

              {/* Action */}
              <button
                onClick={() => {
                  onSelect(popup.machineId);
                  setPopup(null);
                }}
                className="w-full rounded-lg bg-primary/15 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                View Full Machine Details →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Anomaly History Popup */}
      {historyPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setHistoryPopup(null)}
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-border bg-surface p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <History size={16} className="text-warning" />
                <div>
                  <h3 className="text-sm font-semibold">Anomaly History</h3>
                  <p className="text-[11px] text-muted">{historyPopup.machineId} · {historyPopup.machineType}</p>
                </div>
              </div>
              <button
                onClick={() => setHistoryPopup(null)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              {/* Total Count */}
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted uppercase tracking-wide">Total Anomaly Events</span>
                  <span className="text-2xl font-bold tabular-nums text-warning">
                    {historyPopup.anomalyCount}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted">
                  within selected filter period
                </p>
              </div>

              {/* Breakdown by Sensor Type */}
              <div className="rounded-lg border border-border bg-surface-2/50 p-3">
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Breakdown by Sensor</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Thermometer size={14} className="text-danger" />
                      <span className="text-xs text-muted">Temperature</span>
                    </div>
                    <span className={cn(
                      "text-xs font-bold tabular-nums",
                      historyPopup.tempCount > 0 ? "text-danger" : "text-muted"
                    )}>
                      {historyPopup.tempCount} events
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Waves size={14} className="text-warning" />
                      <span className="text-xs text-muted">Vibration</span>
                    </div>
                    <span className={cn(
                      "text-xs font-bold tabular-nums",
                      historyPopup.vibCount > 0 ? "text-warning" : "text-muted"
                    )}>
                      {historyPopup.vibCount} events
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Gauge size={14} className="text-primary" />
                      <span className="text-xs text-muted">Pressure</span>
                    </div>
                    <span className={cn(
                      "text-xs font-bold tabular-nums",
                      historyPopup.pressCount > 0 ? "text-primary" : "text-muted"
                    )}>
                      {historyPopup.pressCount} events
                    </span>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              {historyPopup.firstAnomaly && historyPopup.lastAnomaly && (
                <div className="rounded-lg border border-border bg-surface-2/50 p-3">
                  <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Timeline</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock size={12} className="text-muted" />
                      <span className="text-[11px] text-muted">First anomaly</span>
                      <span className="ml-auto text-xs font-medium tabular-nums">
                        {new Date(historyPopup.firstAnomaly).toLocaleString("en-GB", {
                          day: "2-digit", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={12} className="text-muted" />
                      <span className="text-[11px] text-muted">Last anomaly</span>
                      <span className="ml-auto text-xs font-medium tabular-nums">
                        {new Date(historyPopup.lastAnomaly).toLocaleString("en-GB", {
                          day: "2-digit", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Machine Context */}
              <div className="rounded-lg border border-border bg-surface-2/50 p-3">
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">Current Machine Status</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">Health</span>
                  <span className={cn(
                    "text-xs font-bold tabular-nums",
                    historyPopup.healthPct >= 80 ? "text-success" : historyPopup.healthPct >= 55 ? "text-warning" : "text-danger"
                  )}>
                    {historyPopup.healthPct}% ({historyPopup.healthStatus})
                  </span>
                </div>
              </div>

              {/* Event List — grouped by month */}
              <div className="rounded-lg border border-border bg-surface-2/50 p-3">
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">
                  Anomaly Events ({historyPopup.anomalyCount} total)
                </p>
                {historyLoading ? (
                  <div className="space-y-1.5">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-8 animate-pulse rounded bg-surface-2" />
                    ))}
                  </div>
                ) : historyEvents.length > 0 ? (() => {
                  const groups: Record<string, HistoryEvent[]> = {};
                  historyEvents.forEach((evt) => {
                    const d = new Date(evt.TIMESTAMP);
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(evt);
                  });
                  const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
                  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                  return (
                    <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
                      {sortedKeys.map((key) => {
                        const [yr, mo] = key.split("-");
                        const monthLabel = `${monthNames[parseInt(mo) - 1]} ${yr}`;
                        const events = groups[key];
                        const isExpanded = expandedMonths.has(key);
                        return (
                          <div key={key} className="rounded-md border border-border/50 overflow-hidden">
                            <button
                              onClick={() => {
                                setExpandedMonths((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(key)) next.delete(key);
                                  else next.add(key);
                                  return next;
                                });
                              }}
                              className="flex w-full items-center gap-2 bg-surface-2/70 px-3 py-2 hover:bg-surface-2 transition-colors"
                            >
                              <ChevronDown
                                size={14}
                                className={cn("text-muted transition-transform", !isExpanded && "-rotate-90")}
                              />
                              <span className="text-xs font-semibold">{monthLabel}</span>
                              <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                                {events.length} events
                              </span>
                            </button>
                            {isExpanded && (
                              <div className="space-y-1 p-2">
                                {/* Column header */}
                                <div className="flex items-center gap-2 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-muted">
                                  <span className="shrink-0 w-[78px]">Time</span>
                                  <span className="flex-1 grid grid-cols-3 gap-1">
                                    <span>Temp</span>
                                    <span>Vib</span>
                                    <span>Press</span>
                                  </span>
                                  <span className="shrink-0 w-[42px] text-center">Health</span>
                                </div>
                                {events.map((evt, i) => {
                                  const sensors = [];
                                  if (evt.IS_TEMPERATURE_ANOMALY) sensors.push({ icon: <Thermometer size={10} />, label: "Temp", color: "text-danger" });
                                  if (evt.IS_VIBRATION_ANOMALY) sensors.push({ icon: <Waves size={10} />, label: "Vib", color: "text-warning" });
                                  if (evt.IS_PRESSURE_ANOMALY) sensors.push({ icon: <Gauge size={10} />, label: "Press", color: "text-primary" });
                                  return (
                                    <div
                                      key={i}
                                      className="flex items-center gap-2 rounded-md border border-border/50 bg-surface px-2.5 py-1.5"
                                    >
                                      <div className="shrink-0 w-[78px]">
                                        <p className="text-[11px] font-medium tabular-nums leading-tight">
                                          {new Date(evt.TIMESTAMP).toLocaleString("en-GB", {
                                            day: "2-digit", month: "short",
                                            hour: "2-digit", minute: "2-digit",
                                          })}
                                        </p>
                                      </div>
                                      <div className="flex-1 grid grid-cols-3 gap-1 text-[10px] tabular-nums">
                                        <span className={cn(
                                          evt.IS_TEMPERATURE_ANOMALY ? "text-danger font-bold" : "text-muted/60"
                                        )}>
                                          {evt.TEMPERATURE}°C
                                        </span>
                                        <span className={cn(
                                          evt.IS_VIBRATION_ANOMALY ? "text-warning font-bold" : "text-muted/60"
                                        )}>
                                          {evt.VIBRATION}
                                        </span>
                                        <span className={cn(
                                          evt.IS_PRESSURE_ANOMALY ? "text-primary font-bold" : "text-muted/60"
                                        )}>
                                          {evt.PRESSURE}
                                        </span>
                                      </div>
                                      <div className="flex shrink-0 items-center gap-1 w-[42px] justify-center">
                                        {sensors.map((s, j) => (
                                          <span key={j} className={cn("inline-flex items-center gap-0.5 rounded bg-surface-2 px-1 py-0.5 text-[9px] font-medium", s.color)} title={`${s.label} anomaly`}>
                                            {s.icon}
                                          </span>
                                        ))}
                                      </div>
                                      <span className={cn(
                                        "shrink-0 text-[10px] font-bold tabular-nums w-[38px] text-right",
                                        evt.HEALTH_PCT >= 80 ? "text-success" : evt.HEALTH_PCT >= 55 ? "text-warning" : "text-danger"
                                      )}>
                                        {evt.HEALTH_PCT}%
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })() : (
                  <p className="text-[11px] text-muted italic">No event details available</p>
                )}
              </div>

              {/* Action */}
              <button
                onClick={() => {
                  onSelect(historyPopup.machineId);
                  setHistoryPopup(null);
                }}
                className="w-full rounded-lg bg-primary/15 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                View Full Machine Details →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

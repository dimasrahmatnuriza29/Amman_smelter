"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  X,
  Loader2,
  Thermometer,
  Waves,
  Gauge,
  HeartPulse,
  Activity,
  Clock,
  TrendingDown,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnomalySummary } from "@/lib/types";

interface AnomalyHighlightsProps {
  anomalies: AnomalySummary[];
  loading: boolean;
  onSelect: (machineId: string) => void;
}

interface AnomalyEvent {
  TIMESTAMP: string;
  ANOMALY_SCORE: number;
  IS_ANOMALY: boolean;
  TEMPERATURE: number;
  VIBRATION: number;
  PRESSURE: number;
  HEALTH_PCT: number;
  HEALTH_STATUS: string;
}

interface AnomalyStats {
  TOTAL_READINGS: number;
  ANOMALY_COUNT: number;
  ANOMALY_PCT: number;
  MAX_SCORE: number;
  MIN_SCORE: number;
  AVG_SCORE: number;
  LATEST_ANOMALY_TS: string;
  FIRST_ANOMALY_TS: string;
  AVG_TEMP_ANOMALY: number;
  AVG_VIB_ANOMALY: number;
  AVG_PRESS_ANOMALY: number;
  AVG_HEALTH_ANOMALY: number;
  AVG_TEMP_NORMAL: number;
  AVG_VIB_NORMAL: number;
  AVG_PRESS_NORMAL: number;
  AVG_HEALTH_NORMAL: number;
}

interface AnomalyDetailResponse {
  machineId: string;
  stats: AnomalyStats | null;
  events: AnomalyEvent[];
  latest: {
    MACHINE_ID: string;
    MACHINE_TYPE: string;
    TEMPERATURE: number;
    VIBRATION: number;
    PRESSURE: number;
    HEALTH_PCT: number;
    HEALTH_STATUS: string;
    ANOMALY_SCORE: number;
    IS_ANOMALY: boolean;
    TIMESTAMP: string;
  } | null;
}

function formatTs(ts: number): string {
  // Convert nanoseconds to milliseconds
  const ms = ts / 1_000_000;
  const d = new Date(ms);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AnomalyHighlights({
  anomalies,
  loading,
  onSelect,
}: AnomalyHighlightsProps) {
  const [popupMachine, setPopupMachine] = useState<string | null>(null);
  const [popupData, setPopupData] = useState<AnomalyDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  async function openPopup(machineId: string) {
    setPopupMachine(machineId);
    setPopupData(null);
    setDetailError(null);
    setDetailLoading(true);

    try {
      const res = await fetch(`/api/anomalies/${encodeURIComponent(machineId)}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setPopupData(data);
    } catch (e) {
      setDetailError((e as Error).message);
    } finally {
      setDetailLoading(false);
    }
  }

  function closePopup() {
    setPopupMachine(null);
    setPopupData(null);
    setDetailError(null);
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="h-5 w-32 animate-pulse rounded bg-surface-2" />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-surface-2/50" />
          ))}
        </div>
      </div>
    );
  }

  const sorted = [...anomalies].sort(
    (a, b) => b.MAX_SCORE - a.MAX_SCORE
  );

  const maxScore = sorted.length > 0 ? sorted[0].MAX_SCORE : 1;
  const minScore = sorted.length > 0 ? sorted[sorted.length - 1].MAX_SCORE : 0;
  const scoreRange = maxScore - minScore || 1;

  function severityColor(score: number): string {
    const ratio = (score - minScore) / scoreRange;
    if (ratio >= 0.66) return "bg-danger";
    if (ratio >= 0.33) return "bg-warning";
    return "bg-success/60";
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-warning" />
            <h2 className="text-sm font-semibold">Anomaly Highlights</h2>
          </div>
          <span className="text-[11px] text-muted">
            {sorted.reduce((s, a) => s + a.ANOMALY_COUNT, 0)} total anomalies · click for detail
          </span>
        </div>
        <div className="divide-y divide-border/50">
          {sorted.map((a) => (
            <button
              key={a.MACHINE_ID}
              onClick={() => openPopup(a.MACHINE_ID)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-all duration-200 hover:bg-warning/5 hover:pl-5 group"
            >
              <div className={cn("h-10 w-1 rounded-full shrink-0", severityColor(a.MAX_SCORE))} />
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10 group-hover:bg-warning/20 group-hover:scale-110 transition-all duration-200">
                <AlertTriangle size={14} className="text-warning" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{a.MACHINE_ID}</p>
                <p className="text-[11px] text-muted">
                  <span className="capitalize">{a.MACHINE_TYPE}</span> · Latest: {a.LATEST_ANOMALY_TS ? formatTs(a.LATEST_ANOMALY_TS) : "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums text-warning">
                  {a.ANOMALY_COUNT}
                </p>
                <p className="text-[11px] text-muted">
                  score {a.MAX_SCORE.toFixed(4)}
                </p>
              </div>
              <ChevronRight size={16} className="text-muted group-hover:text-warning transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {/* Popup Modal */}
      {popupMachine && (
        <>
          <div
            className="copilot-backdrop fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={closePopup}
          />
          <div className="copilot-panel-expanded fixed inset-4 z-50 flex flex-col rounded-xl border border-border bg-surface overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/15">
                  <AlertTriangle size={18} className="text-warning" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">
                    Anomaly Detail — {popupMachine}
                  </h3>
                  <p className="text-[11px] text-muted">
                    Factual anomaly data from ML detection &amp; sensor readings
                  </p>
                </div>
              </div>
              <button
                onClick={closePopup}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {detailLoading && (
                <div className="flex h-full flex-col items-center justify-center gap-3">
                  <Loader2 size={28} className="animate-spin text-warning" />
                  <p className="text-sm text-muted">
                    Loading anomaly data for {popupMachine}...
                  </p>
                </div>
              )}

              {detailError && !detailLoading && (
                <div className="rounded-lg border border-danger/30 bg-danger/10 p-4">
                  <div className="flex items-center gap-2 text-danger">
                    <AlertTriangle size={16} />
                    <span className="text-sm font-medium">Error</span>
                  </div>
                  <p className="mt-2 text-xs text-danger/80">{detailError}</p>
                </div>
              )}

              {popupData && !detailLoading && !detailError && popupData.stats && popupData.latest && (
                <>
                  {/* Why is this machine in Anomaly Highlights? */}
                  <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={16} className="text-warning" />
                      <p className="text-sm font-semibold text-warning">Why is this machine flagged?</p>
                    </div>
                    <p className="text-xs text-foreground/80 leading-relaxed">
                      <span className="font-medium">{popupData.machineId}</span> (<span className="capitalize">{popupData.latest?.MACHINE_TYPE}</span>) has recorded{" "}
                      <span className="font-bold text-warning">{popupData.stats.ANOMALY_COUNT} anomaly events</span>{" "}
                      out of {popupData.stats.TOTAL_READINGS.toLocaleString()} total readings{" "}
                      ({popupData.stats.ANOMALY_PCT}% anomaly rate). The ML model (Isolation Forest) detected abnormal sensor patterns
                      that deviate from normal operating behavior.
                    </p>
                  </div>

                  {/* Current Status */}
                  <div>
                    <p className="mb-2 text-xs font-semibold text-muted uppercase tracking-wide">Current Status (Latest Reading)</p>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                      {[
                        { icon: Thermometer, label: "Temperature", value: `${popupData.latest.TEMPERATURE}°C`, anomaly: popupData.latest.IS_ANOMALY },
                        { icon: Waves, label: "Vibration", value: `${popupData.latest.VIBRATION}`, anomaly: popupData.latest.IS_ANOMALY },
                        { icon: Gauge, label: "Pressure", value: `${popupData.latest.PRESSURE}`, anomaly: popupData.latest.IS_ANOMALY },
                        { icon: HeartPulse, label: "Health", value: `${popupData.latest.HEALTH_PCT}%`, anomaly: false },
                        { icon: Activity, label: "Anomaly Score", value: `${popupData.latest.ANOMALY_SCORE}`, anomaly: popupData.latest.IS_ANOMALY },
                        { icon: AlertTriangle, label: "Is Anomaly", value: popupData.latest.IS_ANOMALY ? "YES" : "NO", anomaly: popupData.latest.IS_ANOMALY },
                      ].map((s) => (
                        <div
                          key={s.label}
                          className={cn(
                            "rounded-lg px-3 py-2 border",
                            s.anomaly
                              ? "border-warning/30 bg-warning/5"
                              : "border-border bg-surface-2/50"
                          )}
                        >
                          <div className="flex items-center gap-1.5 text-muted">
                            <s.icon size={12} />
                            <p className="text-[10px]">{s.label}</p>
                          </div>
                          <p className={cn("mt-0.5 text-sm font-medium tabular-nums", s.anomaly && "text-warning")}>
                            {s.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Anomaly vs Normal Comparison */}
                  <div>
                    <p className="mb-2 text-xs font-semibold text-muted uppercase tracking-wide">Anomaly vs Normal — Sensor Comparison</p>
                    <div className="overflow-hidden rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-surface-2/50 text-left text-[11px] text-muted">
                            <th className="px-3 py-2 font-medium">Sensor</th>
                            <th className="px-3 py-2 font-medium text-right">During Anomaly</th>
                            <th className="px-3 py-2 font-medium text-right">Normal</th>
                            <th className="px-3 py-2 font-medium text-right">Delta</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {[
                            { label: "Temperature", anomaly: popupData.stats.AVG_TEMP_ANOMALY, normal: popupData.stats.AVG_TEMP_NORMAL, unit: "°C" },
                            { label: "Vibration", anomaly: popupData.stats.AVG_VIB_ANOMALY, normal: popupData.stats.AVG_VIB_NORMAL, unit: "" },
                            { label: "Pressure", anomaly: popupData.stats.AVG_PRESS_ANOMALY, normal: popupData.stats.AVG_PRESS_NORMAL, unit: "" },
                            { label: "Health", anomaly: popupData.stats.AVG_HEALTH_ANOMALY, normal: popupData.stats.AVG_HEALTH_NORMAL, unit: "%" },
                          ].map((row) => {
                            const delta = row.anomaly - row.normal;
                            const isWorse = row.label === "Health" ? delta < 0 : Math.abs(delta) > 0;
                            return (
                              <tr key={row.label} className="text-xs">
                                <td className="px-3 py-2 font-medium">{row.label}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-warning">{row.anomaly?.toFixed(2)}{row.unit}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-muted">{row.normal?.toFixed(2)}{row.unit}</td>
                                <td className={cn("px-3 py-2 text-right tabular-nums font-medium", isWorse ? "text-danger" : "text-success")}>
                                  {delta > 0 ? "+" : ""}{delta?.toFixed(2)}{row.unit}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Anomaly Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { label: "Anomaly Rate", value: `${popupData.stats.ANOMALY_PCT}%`, sub: `${popupData.stats.ANOMALY_COUNT} of ${popupData.stats.TOTAL_READINGS.toLocaleString()}` },
                      { label: "Max Score", value: `${popupData.stats.MAX_SCORE}`, sub: "Most extreme" },
                      { label: "Avg Score", value: `${popupData.stats.AVG_SCORE}`, sub: "Mean anomaly score" },
                      { label: "Score Range", value: `${popupData.stats.MIN_SCORE} to ${popupData.stats.MAX_SCORE}`, sub: "Min to Max" },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg bg-surface-2/50 px-3 py-2">
                        <p className="text-[10px] text-muted">{s.label}</p>
                        <p className="text-sm font-bold tabular-nums">{s.value}</p>
                        <p className="text-[10px] text-muted">{s.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Recent Anomaly Events */}
                  {popupData.events.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold text-muted uppercase tracking-wide">
                        Recent Anomaly Events ({popupData.events.length} shown)
                      </p>
                      <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-surface-2">
                            <tr className="border-b border-border text-left text-[10px] text-muted">
                              <th className="px-3 py-1.5 font-medium">Timestamp</th>
                              <th className="px-3 py-1.5 font-medium text-right">Score</th>
                              <th className="px-3 py-1.5 font-medium text-right">Temp</th>
                              <th className="px-3 py-1.5 font-medium text-right">Vib</th>
                              <th className="px-3 py-1.5 font-medium text-right">Press</th>
                              <th className="px-3 py-1.5 font-medium text-right">Health</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {popupData.events.map((e, i) => (
                              <tr key={i} className="hover:bg-surface-2/30">
                                <td className="px-3 py-1.5 text-muted tabular-nums">{e.TIMESTAMP.substring(0, 16)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums text-warning font-medium">{e.ANOMALY_SCORE}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{e.TEMPERATURE}°C</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{e.VIBRATION}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{e.PRESSURE}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{e.HEALTH_PCT}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Action button */}
                  <button
                    onClick={() => {
                      onSelect(popupMachine);
                      closePopup();
                    }}
                    className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/80 transition-colors"
                  >
                    View Full Machine Details →
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

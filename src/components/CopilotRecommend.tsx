"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, Loader2, RefreshCw, AlertTriangle, Maximize2, Minimize2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopilotRecommendProps {
  machineId: string | null;
  isAnomaly: boolean;
  refreshKey: number;
  expanded: boolean;
  onExpand: () => void;
  onClose: () => void;
}

interface RecommendResponse {
  machineId: string;
  machineType: string;
  isAnomaly: boolean;
  healthPct: number;
  recommendation: string;
  sensorSnapshot: {
    temperature: number;
    vibration: number;
    pressure: number;
    healthPct: number;
    anomalyScore: number;
    trend7d: number;
  };
}

export default function CopilotRecommend({
  machineId,
  isAnomaly,
  refreshKey,
  expanded,
  onExpand,
  onClose,
}: CopilotRecommendProps) {
  const [data, setData] = useState<RecommendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendation = useCallback(async () => {
    if (!machineId) {
      setData(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/copilot/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const d = await res.json();
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [machineId]);

  useEffect(() => {
    fetchRecommendation();
  }, [fetchRecommendation, refreshKey]);

  return (
    <>
      {expanded && (
        <div
          className="copilot-backdrop fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      <div
        className={cn(
          "flex flex-col rounded-xl border border-border bg-surface overflow-hidden",
          expanded
            ? "fixed inset-4 z-50 shadow-2xl copilot-panel-expanded"
            : "h-full transition-all duration-200"
        )}
      >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
            <Sparkles size={15} className="text-primary" />
          </div>
          <div>
            <h3 className={cn("font-semibold", expanded ? "text-base" : "text-sm")}>AI Copilot Recommendation</h3>
            <p className="text-[10px] text-muted">Auto-anomaly analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {data && !loading && (
            <button
              onClick={fetchRecommendation}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
              title="Re-analyze"
            >
              <RefreshCw size={13} />
            </button>
          )}
          {expanded ? (
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
              title="Close"
            >
              <X size={15} />
            </button>
          ) : (
            <button
              onClick={onExpand}
              className="copilot-expand-btn flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors"
              title="Expand"
            >
              <Maximize2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!machineId && !loading && (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-xs text-muted">
              Auto-detecting anomaly...
            </p>
          </div>
        )}

        {loading && (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <Loader2 size={20} className="animate-spin text-primary" />
            <p className="text-xs text-muted">Analyzing sensor data...</p>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 p-3">
            <div className="flex items-center gap-2 text-danger">
              <AlertTriangle size={14} />
              <span className="text-xs font-medium">Error</span>
            </div>
            <p className="mt-1 text-[11px] text-danger/80">{error}</p>
          </div>
        )}

        {data && !loading && !error && (
          <div className="space-y-3">
            {/* Anomaly badge */}
            {data.isAnomaly && (
              <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2">
                <AlertTriangle size={14} className="text-warning" />
                <span className="text-[11px] font-medium text-warning">
                  Anomaly Detected — {data.machineId}
                </span>
              </div>
            )}

            {/* Sensor snapshot */}
            <div className={cn("grid gap-2", expanded ? "grid-cols-6" : "grid-cols-3")}>
              <div className="rounded-lg bg-surface-2/50 px-2 py-1.5">
                <p className="text-[10px] text-muted">Temp</p>
                <p className="text-xs font-medium tabular-nums">
                  {data.sensorSnapshot.temperature}°C
                </p>
              </div>
              <div className="rounded-lg bg-surface-2/50 px-2 py-1.5">
                <p className="text-[10px] text-muted">Vibration</p>
                <p className="text-xs font-medium tabular-nums">
                  {data.sensorSnapshot.vibration}
                </p>
              </div>
              <div className="rounded-lg bg-surface-2/50 px-2 py-1.5">
                <p className="text-[10px] text-muted">Pressure</p>
                <p className="text-xs font-medium tabular-nums">
                  {data.sensorSnapshot.pressure}
                </p>
              </div>
              <div className="rounded-lg bg-surface-2/50 px-2 py-1.5">
                <p className="text-[10px] text-muted">Health</p>
                <p className="text-xs font-medium tabular-nums">
                  {data.sensorSnapshot.healthPct}%
                </p>
              </div>
              <div className="rounded-lg bg-surface-2/50 px-2 py-1.5">
                <p className="text-[10px] text-muted">Anomaly Score</p>
                <p className="text-xs font-medium tabular-nums">
                  {data.sensorSnapshot.anomalyScore}
                </p>
              </div>
              <div className="rounded-lg bg-surface-2/50 px-2 py-1.5">
                <p className="text-[10px] text-muted">7D Trend</p>
                <p className="text-xs font-medium tabular-nums">
                  {data.sensorSnapshot.trend7d > 0 ? "+" : ""}{data.sensorSnapshot.trend7d}%
                </p>
              </div>
            </div>

            {/* AI Recommendation */}
            <div className="rounded-lg border border-border bg-surface-2/30 p-4">
              <pre className={cn("whitespace-pre-wrap leading-relaxed text-foreground font-sans", expanded ? "text-sm" : "text-[11px]")}>
                {data.recommendation}
              </pre>
            </div>
          </div>
        )}
      </div>
      </div>
    </>
  );
}

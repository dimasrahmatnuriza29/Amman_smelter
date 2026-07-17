"use client";

import { TrendingDown, TrendingUp, Minus, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Asset } from "@/lib/types";

interface AssetTableProps {
  assets: Asset[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
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
}: AssetTableProps) {
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
            <th className="px-4 py-2 font-medium">Type</th>
            <th className="px-4 py-2 font-medium">Health</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium text-right">Temp</th>
            <th className="px-4 py-2 font-medium text-right">Vibration</th>
            <th className="px-4 py-2 font-medium text-right">Pressure</th>
            <th className="px-4 py-2 font-medium">Trend</th>
            <th className="px-4 py-2 font-medium">Anomaly</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => {
            const sc = statusColor(asset.HEALTH_STATUS);
            const isSelected = selectedId === asset.MACHINE_ID;
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
                <td className="px-4 py-2.5 font-medium">
                  {asset.MACHINE_ID}
                </td>
                <td className="px-4 py-2.5 text-muted capitalize">
                  {asset.MACHINE_TYPE}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", sc.bar)}
                        style={{ width: `${asset.HEALTH_PCT}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-xs">
                      {asset.HEALTH_PCT}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
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
                <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                  {asset.TEMPERATURE}°C
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                  {asset.VIBRATION}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                  {asset.PRESSURE}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1">
                    <TrendIcon value={asset.TREND_PCT} />
                    <span
                      className={cn(
                        "tabular-nums text-xs",
                        asset.TREND_PCT < 0
                          ? "text-danger"
                          : asset.TREND_PCT > 0
                            ? "text-success"
                            : "text-muted"
                      )}
                    >
                      {asset.TREND_PCT > 0 ? "+" : ""}
                      {asset.TREND_PCT}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  {asset.IS_ANOMALY ? (
                    <span className="flex items-center gap-1 text-warning">
                      <AlertTriangle size={14} />
                      <span className="text-[11px]">Yes</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted">No</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

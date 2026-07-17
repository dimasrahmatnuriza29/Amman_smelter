"use client";

import { RefreshCw } from "lucide-react";

interface HeaderProps {
  lastRefresh?: string;
  onRefresh?: () => void;
  loading?: boolean;
}

export default function Header({ lastRefresh, onRefresh, loading }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 h-16 border-b border-border bg-surface/50">
      <div>
        <h1 className="text-lg font-semibold">Smelter Asset Health Copilot</h1>
        <p className="text-xs text-muted">
          AI Smelter — Predictive &amp; Prescriptive Asset Maintenance
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-[11px] text-muted">Last Refresh</p>
          <p className="text-xs font-medium">{lastRefresh ?? "—"}</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:text-foreground hover:bg-surface-2 transition-colors disabled:opacity-50"
          title="Refresh data"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
    </header>
  );
}

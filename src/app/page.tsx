"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Filter,
  Factory,
  Activity,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Header from "@/components/Header";
import KpiCards from "@/components/KpiCards";
import AssetTable from "@/components/AssetTable";
import AssetDetailPanel from "@/components/AssetDetail";
import TrendChart from "@/components/TrendChart";
import AnomalyHighlights from "@/components/AnomalyHighlights";
import CopilotRecommend from "@/components/CopilotRecommend";
import CopilotChat from "@/components/CopilotChat";
import {
  useAssets,
  useAssetDetail,
  useTrend,
  useAnomalies,
} from "@/lib/hooks";
import type { KpiData } from "@/lib/types";

const MACHINE_TYPES = ["All", "furnace", "conveyor", "motor", "slurry_pump"];
const HEALTH_STATUSES = ["All", "HEALTHY", "WARNING", "CRITICAL"];

export default function Home() {
  const [lastRefresh, setLastRefresh] = useState<string>(
    new Date().toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  );
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filter state
  const [machineType, setMachineType] = useState("All");
  const [healthStatus, setHealthStatus] = useState("All");
  const [anomalyOnly, setAnomalyOnly] = useState(false);

  // Selected machine
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Expand state for copilot panels
  const [recommendExpanded, setRecommendExpanded] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);

  // Data hooks
  const { data: assetsData, loading: assetsLoading } = useAssets(refreshKey);
  const { data: detailData, loading: detailLoading } = useAssetDetail(
    selectedId,
    refreshKey
  );
  const { data: trendData, loading: trendLoading } = useTrend(
    selectedId,
    refreshKey
  );
  const { data: anomalyData, loading: anomalyLoading } =
    useAnomalies(refreshKey);

  // Apply filters to assets
  const filteredAssets = useMemo(() => {
    return assetsData.filter((a) => {
      if (machineType !== "All" && a.MACHINE_TYPE !== machineType) return false;
      if (healthStatus !== "All" && a.HEALTH_STATUS !== healthStatus)
        return false;
      if (anomalyOnly && !a.IS_ANOMALY) return false;
      return true;
    });
  }, [assetsData, machineType, healthStatus, anomalyOnly]);

  // Compute KPI from filtered assets so cards respond to filters
  const filteredKpi = useMemo<KpiData>(() => {
    const total = filteredAssets.length;
    const healthy = filteredAssets.filter((a) => a.HEALTH_STATUS === "HEALTHY").length;
    const warning = filteredAssets.filter((a) => a.HEALTH_STATUS === "WARNING").length;
    const critical = filteredAssets.filter((a) => a.HEALTH_STATUS === "CRITICAL").length;
    const anomalies = filteredAssets.filter((a) => a.IS_ANOMALY).length;
    const avgHealth = total > 0
      ? Math.round(filteredAssets.reduce((s, a) => s + a.HEALTH_PCT, 0) / total)
      : 0;
    return {
      avgHealth,
      healthyCount: healthy,
      warningCount: warning,
      criticalCount: critical,
      totalMachines: total,
      anomalyCount: anomalies,
      totalReadings: total,
    };
  }, [filteredAssets]);

  // Auto-select: prioritize anomalous machine, fallback to lowest health
  useEffect(() => {
    if (!selectedId && assetsData.length > 0) {
      const anomalous = assetsData.find((a) => a.IS_ANOMALY);
      if (anomalous) {
        setSelectedId(anomalous.MACHINE_ID);
      } else {
        const lowest = [...assetsData].sort((a, b) => a.HEALTH_PCT - b.HEALTH_PCT)[0];
        if (lowest) setSelectedId(lowest.MACHINE_ID);
      }
    }
  }, [assetsData, selectedId]);

  function handleRefresh() {
    setLoading(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => {
      setLastRefresh(
        new Date().toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
      setLoading(false);
    }, 600);
  }

  const activeFilterCount = [
    machineType !== "All",
    healthStatus !== "All",
    anomalyOnly,
  ].filter(Boolean).length;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header
        lastRefresh={lastRefresh}
        onRefresh={handleRefresh}
        loading={loading}
      />
      <main className="flex flex-1 overflow-hidden gap-4 p-4">
        {/* Dashboard Monitoring - left */}
        <div className="flex-1 flex flex-col overflow-hidden rounded-xl border border-border bg-surface/40">
          {/* Filter Bar */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-muted">
              <Filter size={16} />
              <span className="text-xs font-medium">Filters</span>
            </div>

            {/* Machine Type */}
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5">
              <Factory size={14} className="text-muted" />
              <select
                value={machineType}
                onChange={(e) => setMachineType(e.target.value)}
                className="bg-transparent text-xs font-medium text-foreground outline-none cursor-pointer"
              >
                {MACHINE_TYPES.map((t) => (
                  <option key={t} value={t} className="bg-surface-2">
                    {t === "All" ? "All Types" : t}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="text-muted" />
            </div>

            {/* Health Status */}
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5">
              <Activity size={14} className="text-muted" />
              <select
                value={healthStatus}
                onChange={(e) => setHealthStatus(e.target.value)}
                className="bg-transparent text-xs font-medium text-foreground outline-none cursor-pointer"
              >
                {HEALTH_STATUSES.map((s) => (
                  <option key={s} value={s} className="bg-surface-2">
                    {s === "All" ? "All Status" : s}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="text-muted" />
            </div>

            {/* Anomaly Only Toggle */}
            <button
              onClick={() => setAnomalyOnly(!anomalyOnly)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                anomalyOnly
                  ? "border-warning/50 bg-warning/15 text-warning"
                  : "border-border bg-surface-2 text-muted hover:text-foreground"
              )}
            >
              <AlertTriangle size={14} />
              Anomaly Only
            </button>

            <div className="flex-1" />

            <span className="text-[11px] text-muted">
              {activeFilterCount > 0
                ? `${activeFilterCount} filter(s) active`
                : "No filters"}
            </span>
          </div>

          {/* Dashboard Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* KPI Cards */}
            <KpiCards data={filteredKpi} loading={assetsLoading} />

            {/* Asset Table */}
            <AssetTable
              assets={filteredAssets}
              loading={assetsLoading}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />

            {/* Detail + Trend side by side */}
            <div className="grid grid-cols-2 gap-4">
              <AssetDetailPanel data={detailData} loading={detailLoading} />
              <TrendChart
                data={trendData}
                loading={trendLoading}
                machineId={selectedId}
              />
            </div>

            {/* Anomaly Highlights */}
            <AnomalyHighlights
              anomalies={anomalyData}
              loading={anomalyLoading}
              onSelect={setSelectedId}
            />
          </div>
        </div>

        {/* AI Copilot Panel - right */}
        <div className="w-[380px] shrink-0 flex flex-col gap-4 overflow-hidden">
          {/* Auto AI Copilot Recommendation */}
          <CopilotRecommend
            machineId={selectedId}
            isAnomaly={
              assetsData.find((a) => a.MACHINE_ID === selectedId)?.IS_ANOMALY ??
              false
            }
            refreshKey={refreshKey}
            expanded={recommendExpanded}
            onExpand={() => setRecommendExpanded(true)}
            onClose={() => setRecommendExpanded(false)}
          />
          {/* Q&A Chat */}
          <CopilotChat
            machineId={selectedId}
            expanded={chatExpanded}
            onExpand={() => setChatExpanded(true)}
            onClose={() => setChatExpanded(false)}
          />
        </div>
      </main>
    </div>
  );
}

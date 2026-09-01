"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Filter,
  Factory,
  Activity,
  AlertTriangle,
  ChevronDown,
  LayoutDashboard,
  Bot,
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
  useKpi,
} from "@/lib/hooks";
import type { KpiData } from "@/lib/types";

const MACHINE_TYPES = ["All", "furnace", "conveyor", "motor", "slurry_pump"];
const HEALTH_STATUSES = ["All", "HEALTHY", "WARNING", "CRITICAL"];
const MONTHS = [
  { value: 0, label: "All Months" },
  { value: 1, label: "Jan" }, { value: 2, label: "Feb" }, { value: 3, label: "Mar" },
  { value: 4, label: "Apr" }, { value: 5, label: "May" }, { value: 6, label: "Jun" },
  { value: 7, label: "Jul" }, { value: 8, label: "Aug" }, { value: 9, label: "Sep" },
  { value: 10, label: "Oct" }, { value: 11, label: "Nov" }, { value: 12, label: "Dec" },
];
const YEARS = [0, 2024, 2025, 2026];

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
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [selectedYear, setSelectedYear] = useState(2024);

  // Selected machine
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Expand state for copilot panels
  const [recommendExpanded, setRecommendExpanded] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);

  // Mobile view toggle: "dashboard" | "copilot"
  const [mobileView, setMobileView] = useState<"dashboard" | "copilot">("dashboard");

  // Data hooks — month and year filters work independently
  const filterMonth = selectedMonth > 0 ? selectedMonth : undefined;
  const filterYear = selectedYear > 0 ? selectedYear : undefined;
  const { data: kpiData, loading: kpiLoading } = useKpi(
    refreshKey,
    filterMonth,
    filterYear
  );
  const { data: assetsData, loading: assetsLoading } = useAssets(
    refreshKey,
    filterMonth,
    filterYear
  );
  const { data: detailData, loading: detailLoading } = useAssetDetail(
    selectedId,
    refreshKey,
    filterMonth,
    filterYear
  );
  const { data: trendData, loading: trendLoading } = useTrend(
    selectedId,
    refreshKey,
    filterMonth,
    filterYear
  );
  const { data: anomalyData, loading: anomalyLoading } =
    useAnomalies(refreshKey, filterMonth, filterYear);

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
    selectedMonth > 0,
    selectedYear > 0,
  ].filter(Boolean).length;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header
        lastRefresh={lastRefresh}
        onRefresh={handleRefresh}
        loading={loading}
      />
      {/* Mobile view toggle */}
      <div className="flex lg:hidden border-b border-border bg-surface/50">
        <button
          onClick={() => setMobileView("dashboard")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 py-2.5 text-xs font-medium transition-colors",
            mobileView === "dashboard"
              ? "text-primary border-b-2 border-primary"
              : "text-muted hover:text-foreground"
          )}
        >
          <LayoutDashboard size={14} />
          Dashboard
        </button>
        <button
          onClick={() => setMobileView("copilot")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 py-2.5 text-xs font-medium transition-colors",
            mobileView === "copilot"
              ? "text-primary border-b-2 border-primary"
              : "text-muted hover:text-foreground"
          )}
        >
          <Bot size={14} />
          AI Copilot
        </button>
      </div>
      <main className="flex flex-1 flex-col lg:flex-row overflow-hidden gap-4 p-4">
        {/* Dashboard Monitoring - left */}
        <div className={cn(
          "flex-1 flex flex-col overflow-hidden rounded-xl border border-border bg-surface/40",
          mobileView === "dashboard" ? "flex" : "hidden lg:flex"
        )}>
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 border-b border-border px-3 sm:px-4 py-3">
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

            {/* Month Filter */}
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5">
              <Filter size={14} className="text-muted" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="bg-transparent text-xs font-medium text-foreground outline-none cursor-pointer"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value} className="bg-surface-2">
                    {m.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="text-muted" />
            </div>

            {/* Year Filter */}
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5">
              <span className="text-xs text-muted">Year</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="bg-transparent text-xs font-medium text-foreground outline-none cursor-pointer"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y} className="bg-surface-2">
                    {y === 0 ? "All" : y}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="text-muted" />
            </div>

            <div className="hidden sm:flex flex-1" />

            <span className="text-[11px] text-muted ml-auto sm:ml-0">
              {activeFilterCount > 0
                ? `${activeFilterCount} filter(s) active`
                : "No filters"}
            </span>
          </div>

          {/* Dashboard Content */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
            {/* KPI Cards */}
            <KpiCards data={kpiData ?? filteredKpi} loading={kpiLoading || assetsLoading} />

            {/* Asset Table */}
            <AssetTable
              assets={filteredAssets}
              loading={assetsLoading}
              selectedId={selectedId}
              onSelect={setSelectedId}
              filterMonth={filterMonth}
              filterYear={filterYear}
            />

            {/* Detail + Trend side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
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
              filterMonth={filterMonth}
              filterYear={filterYear}
            />
          </div>
        </div>

        {/* AI Copilot Panel - right */}
        <div className={cn(
          "w-full lg:w-[380px] shrink-0 flex flex-col gap-4 overflow-y-auto lg:overflow-hidden",
          mobileView === "copilot" ? "flex" : "hidden lg:flex"
        )}>
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
            filterMonth={filterMonth}
            filterYear={filterYear}
          />
          {/* Q&A Chat */}
          <CopilotChat
            machineId={selectedId}
            expanded={chatExpanded}
            onExpand={() => setChatExpanded(true)}
            onClose={() => setChatExpanded(false)}
            filterMonth={filterMonth}
            filterYear={filterYear}
          />
        </div>
      </main>
    </div>
  );
}

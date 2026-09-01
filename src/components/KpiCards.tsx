"use client";

import {
  HeartPulse,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Zap,
} from "lucide-react";
import type { KpiData } from "@/lib/types";

interface KpiCardsProps {
  data: KpiData | null;
  loading: boolean;
}

interface CardConfig {
  label: string;
  value: string | number;
  sublabel: string;
  icon: typeof HeartPulse;
  color: string;
  bg: string;
}

export default function KpiCards({ data, loading }: KpiCardsProps) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-[88px] rounded-xl border border-border bg-surface animate-pulse"
          />
        ))}
      </div>
    );
  }

  const cards: CardConfig[] = [
    {
      label: "Overall Health",
      value: `${data.avgHealth}%`,
      sublabel: `${data.totalMachines} machines`,
      icon: HeartPulse,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Healthy",
      value: data.healthyCount,
      sublabel: "machines",
      icon: ShieldCheck,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      label: "Warning",
      value: data.warningCount,
      sublabel: "machines",
      icon: AlertTriangle,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      label: "Critical",
      value: data.criticalCount,
      sublabel: "machines",
      icon: Activity,
      color: "text-danger",
      bg: "bg-danger/10",
    },
    {
      label: "Anomalies",
      value: data.anomalyCount,
      sublabel: `machines flagged`,
      icon: Zap,
      color: "text-purple",
      bg: "bg-purple/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="group relative rounded-xl border border-border bg-surface p-3 transition-colors hover:border-surface-2"
          >
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.bg}`}
              >
                <Icon size={16} className={card.color} />
              </div>
              <span className="text-xs text-muted">{card.label}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tabular-nums">
                {card.value}
              </span>
              <span className="text-[11px] text-muted">{card.sublabel}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

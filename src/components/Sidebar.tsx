"use client";

import { useState } from "react";
import {
  LayoutGrid,
  Boxes,
  AlertTriangle,
  Bot,
  Factory,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "assets", label: "Assets", icon: Boxes },
  { id: "anomalies", label: "Anomalies", icon: AlertTriangle },
  { id: "copilot", label: "AI Copilot", icon: Bot },
];

export default function Sidebar() {
  const [active, setActive] = useState("overview");

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-surface flex flex-col">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Factory size={20} />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Smelter</p>
          <p className="text-[11px] text-muted">Asset Copilot</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-muted hover:bg-surface-2 hover:text-foreground"
              )}
            >
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-border">
        <p className="text-[11px] text-muted">POC Amman Smelter</p>
        <p className="text-[11px] text-muted">v1.0</p>
      </div>
    </aside>
  );
}

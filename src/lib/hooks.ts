"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  KpiData,
  Asset,
  AssetDetail,
  TrendPoint,
  AnomalySummary,
} from "@/lib/types";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export function useKpi(refreshKey: number) {
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const d = await fetchJson<KpiData>("/api/kpi");
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return { data, loading, error, reload: load };
}

export function useAssets(refreshKey: number) {
  const [data, setData] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const d = await fetchJson<Asset[]>("/api/assets");
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return { data, loading, error, reload: load };
}

export function useAssetDetail(machineId: string | null, refreshKey: number) {
  const [data, setData] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!machineId) {
      setData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const d = await fetchJson<AssetDetail>(
          `/api/assets/${encodeURIComponent(machineId)}`
        );
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [machineId, refreshKey]);

  return { data, loading, error };
}

export function useTrend(
  machineId: string | null,
  refreshKey: number
) {
  const [data, setData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!machineId) {
      setData([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const d = await fetchJson<TrendPoint[]>(
          `/api/trend/${encodeURIComponent(machineId)}`
        );
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [machineId, refreshKey]);

  return { data, loading, error };
}

export function useAnomalies(refreshKey: number) {
  const [data, setData] = useState<AnomalySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const d = await fetchJson<AnomalySummary[]>("/api/anomalies");
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return { data, loading, error, reload: load };
}

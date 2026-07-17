import { NextResponse } from "next/server";
import { querySnowflake } from "@/lib/snowflake";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface AssetRow {
  MACHINE_ID: string;
  MACHINE_TYPE: string;
  HEALTH_PCT: number;
  HEALTH_STATUS: string;
  TEMPERATURE: number;
  VIBRATION: number;
  PRESSURE: number;
  OPERATIONAL_TIME: number;
  IS_RUNNING: boolean;
  AVG_DEVIATION_PCT: number;
  TIMESTAMP: string;
  HEALTH_PAST_AGO: number;
  TREND_PCT: number;
  ANOMALY_SCORE: number;
  IS_ANOMALY: boolean;
  IS_TEMPERATURE_ANOMALY: boolean;
  IS_VIBRATION_ANOMALY: boolean;
  IS_PRESSURE_ANOMALY: boolean;
  ANOMALY_HISTORY_COUNT: number;
  TEMP_ANOMALY_COUNT: number;
  VIB_ANOMALY_COUNT: number;
  PRESS_ANOMALY_COUNT: number;
  FIRST_ANOMALY_TS: string | null;
  LAST_ANOMALY_TS: string | null;
}

interface AnomalyEventRow {
  TIMESTAMP: string;
  TEMPERATURE: number;
  VIBRATION: number;
  PRESSURE: number;
  HEALTH_PCT: number;
  IS_TEMPERATURE_ANOMALY: boolean;
  IS_VIBRATION_ANOMALY: boolean;
  IS_PRESSURE_ANOMALY: boolean;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    let dateFilter = "";
    const binds: (string | number)[] = [];

    if (month) {
      dateFilter += " AND MONTH(s.TIMESTAMP) = ?";
      binds.push(parseInt(month));
    }
    if (year) {
      dateFilter += " AND YEAR(s.TIMESTAMP) = ?";
      binds.push(parseInt(year));
    }

    let anomConditions: string[] = [];
    const anomBinds: (string | number)[] = [];
    if (month) {
      anomConditions.push("MONTH(TO_TIMESTAMP(TIMESTAMP / 1000000000)) = ?");
      anomBinds.push(parseInt(month));
    }
    if (year) {
      anomConditions.push("YEAR(TO_TIMESTAMP(TIMESTAMP / 1000000000)) = ?");
      anomBinds.push(parseInt(year));
    }
    const dateFilterAnom = anomConditions.length > 0 ? "WHERE " + anomConditions.join(" AND ") : "";

    let pastConditions: string[] = [];
    const pastBinds: (string | number)[] = [];
    if (month) {
      pastConditions.push("MONTH(TIMESTAMP) = ?");
      pastBinds.push(parseInt(month));
    }
    if (year) {
      pastConditions.push("YEAR(TIMESTAMP) = ?");
      pastBinds.push(parseInt(year));
    }
    const dateFilterPast = pastConditions.length > 0 ? "AND " + pastConditions.join(" AND ") : "";

    const maxTsConditions: string[] = [];
    const maxTsBinds: (string | number)[] = [];
    if (month) {
      maxTsConditions.push("MONTH(TIMESTAMP) = ?");
      maxTsBinds.push(parseInt(month));
    }
    if (year) {
      maxTsConditions.push("YEAR(TIMESTAMP) = ?");
      maxTsBinds.push(parseInt(year));
    }
    const maxTsFilter = maxTsConditions.length > 0 ? "WHERE " + maxTsConditions.join(" AND ") : "";

    const sql = `
      WITH latest AS (
        SELECT
          s.MACHINE_ID,
          s.MACHINE_TYPE,
          s.HEALTH_PCT,
          s.HEALTH_STATUS,
          s.TEMPERATURE,
          s.VIBRATION,
          s.PRESSURE,
          s.OPERATIONAL_TIME,
          s.IS_RUNNING,
          s.AVG_DEVIATION_PCT,
          s.TIMESTAMP,
          ROW_NUMBER() OVER (PARTITION BY s.MACHINE_ID ORDER BY s.TIMESTAMP DESC) AS rn
        FROM POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA s
        WHERE 1=1 ${dateFilter}
      ),
      past AS (
        SELECT
          MACHINE_ID,
          HEALTH_PCT AS HEALTH_PAST_AGO,
          ROW_NUMBER() OVER (PARTITION BY MACHINE_ID ORDER BY TIMESTAMP DESC) AS rn
        FROM POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA
        WHERE TIMESTAMP <= (SELECT MAX(TIMESTAMP) FROM POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA ${maxTsFilter}) - INTERVAL '7 DAYS'
          ${dateFilterPast}
      ),
      anomaly_latest AS (
        SELECT
          MACHINE_ID,
          ANOMALY_SCORE,
          IS_ANOMALY,
          IS_TEMPERATURE_ANOMALY,
          IS_VIBRATION_ANOMALY,
          IS_PRESSURE_ANOMALY,
          ROW_NUMBER() OVER (PARTITION BY MACHINE_ID ORDER BY TIMESTAMP DESC) AS rn
        FROM POC_AMMAN.GOLD.FACT_ANOMALY_DETECTION
        ${dateFilterAnom}
      ),
      anomaly_history AS (
        SELECT
          a.MACHINE_ID,
          COUNT_IF(a.IS_ANOMALY = TRUE) AS ANOMALY_HISTORY_COUNT,
          COUNT_IF(a.IS_TEMPERATURE_ANOMALY = TRUE) AS TEMP_ANOMALY_COUNT,
          COUNT_IF(a.IS_VIBRATION_ANOMALY = TRUE) AS VIB_ANOMALY_COUNT,
          COUNT_IF(a.IS_PRESSURE_ANOMALY = TRUE) AS PRESS_ANOMALY_COUNT,
          MIN(CASE WHEN a.IS_ANOMALY = TRUE THEN TO_TIMESTAMP(a.TIMESTAMP / 1000000000) END) AS FIRST_ANOMALY_TS,
          MAX(CASE WHEN a.IS_ANOMALY = TRUE THEN TO_TIMESTAMP(a.TIMESTAMP / 1000000000) END) AS LAST_ANOMALY_TS
        FROM POC_AMMAN.GOLD.FACT_ANOMALY_DETECTION a
        GROUP BY a.MACHINE_ID
      )
      SELECT
        l.MACHINE_ID,
        l.MACHINE_TYPE,
        ROUND(l.HEALTH_PCT, 1) AS HEALTH_PCT,
        l.HEALTH_STATUS,
        ROUND(l.TEMPERATURE, 2) AS TEMPERATURE,
        ROUND(l.VIBRATION, 4) AS VIBRATION,
        ROUND(l.PRESSURE, 4) AS PRESSURE,
        l.OPERATIONAL_TIME,
        l.IS_RUNNING,
        ROUND(l.AVG_DEVIATION_PCT, 2) AS AVG_DEVIATION_PCT,
        l.TIMESTAMP,
        ROUND(p.HEALTH_PAST_AGO, 1) AS HEALTH_PAST_AGO,
        ROUND(l.HEALTH_PCT - p.HEALTH_PAST_AGO, 1) AS TREND_PCT,
        ROUND(a.ANOMALY_SCORE, 4) AS ANOMALY_SCORE,
        a.IS_ANOMALY,
        a.IS_TEMPERATURE_ANOMALY,
        a.IS_VIBRATION_ANOMALY,
        a.IS_PRESSURE_ANOMALY,
        COALESCE(h.ANOMALY_HISTORY_COUNT, 0) AS ANOMALY_HISTORY_COUNT,
        COALESCE(h.TEMP_ANOMALY_COUNT, 0) AS TEMP_ANOMALY_COUNT,
        COALESCE(h.VIB_ANOMALY_COUNT, 0) AS VIB_ANOMALY_COUNT,
        COALESCE(h.PRESS_ANOMALY_COUNT, 0) AS PRESS_ANOMALY_COUNT,
        h.FIRST_ANOMALY_TS,
        h.LAST_ANOMALY_TS
      FROM latest l
      LEFT JOIN past p ON p.MACHINE_ID = l.MACHINE_ID AND p.rn = 1
      LEFT JOIN anomaly_latest a ON a.MACHINE_ID = l.MACHINE_ID AND a.rn = 1
      LEFT JOIN anomaly_history h ON h.MACHINE_ID = l.MACHINE_ID
      WHERE l.rn = 1
      ORDER BY l.HEALTH_PCT ASC
    `;

    const allBinds = [...binds, ...maxTsBinds, ...pastBinds, ...anomBinds];
    const assets = await querySnowflake<AssetRow>(sql, allBinds);

    return NextResponse.json(assets);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

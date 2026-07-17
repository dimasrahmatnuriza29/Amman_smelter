import { NextResponse } from "next/server";
import { querySnowflake } from "@/lib/snowflake";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface AnomalyEventRow {
  TIMESTAMP: string;
  ANOMALY_SCORE: number;
  IS_ANOMALY: boolean;
  IS_TEMPERATURE_ANOMALY: boolean;
  IS_VIBRATION_ANOMALY: boolean;
  IS_PRESSURE_ANOMALY: boolean;
  TEMPERATURE: number;
  VIBRATION: number;
  PRESSURE: number;
  HEALTH_PCT: number;
  HEALTH_STATUS: string;
}

interface StatsRow {
  TOTAL_READINGS: number;
  ANOMALY_COUNT: number;
  ANOMALY_PCT: number;
  MAX_SCORE: number;
  MIN_SCORE: number;
  AVG_SCORE: number;
  LATEST_ANOMALY_TS: string;
  FIRST_ANOMALY_TS: string;
  TEMP_ANOMALY_COUNT: number;
  VIB_ANOMALY_COUNT: number;
  PRESS_ANOMALY_COUNT: number;
  AVG_TEMP_ANOMALY: number;
  AVG_VIB_ANOMALY: number;
  AVG_PRESS_ANOMALY: number;
  AVG_HEALTH_ANOMALY: number;
  AVG_TEMP_NORMAL: number;
  AVG_VIB_NORMAL: number;
  AVG_PRESS_NORMAL: number;
  AVG_HEALTH_NORMAL: number;
}

interface LatestRow {
  MACHINE_ID: string;
  MACHINE_TYPE: string;
  TEMPERATURE: number;
  VIBRATION: number;
  PRESSURE: number;
  HEALTH_PCT: number;
  HEALTH_STATUS: string;
  ANOMALY_SCORE: number;
  IS_ANOMALY: boolean;
  IS_TEMPERATURE_ANOMALY: boolean;
  IS_VIBRATION_ANOMALY: boolean;
  IS_PRESSURE_ANOMALY: boolean;
  TIMESTAMP: string;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const machineId = decodeURIComponent(id);
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    let dateFilter = "";
    const binds: (string | number)[] = [machineId];

    if (month) {
      dateFilter += " AND MONTH(TO_TIMESTAMP(a.TIMESTAMP / 1000000000)) = ?";
      binds.push(parseInt(month));
    }
    if (year) {
      dateFilter += " AND YEAR(TO_TIMESTAMP(a.TIMESTAMP / 1000000000)) = ?";
      binds.push(parseInt(year));
    }

    // 1. Anomaly stats + comparison (anomaly vs normal averages, all-time)
    const stats = await querySnowflake<StatsRow>(`
      SELECT
        COUNT(*) AS TOTAL_READINGS,
        COUNT_IF(a.IS_ANOMALY = TRUE) AS ANOMALY_COUNT,
        ROUND(COUNT_IF(a.IS_ANOMALY = TRUE) * 100.0 / COUNT(*), 2) AS ANOMALY_PCT,
        ROUND(MAX(a.ANOMALY_SCORE), 4) AS MAX_SCORE,
        ROUND(MIN(a.ANOMALY_SCORE), 4) AS MIN_SCORE,
        ROUND(AVG(a.ANOMALY_SCORE), 4) AS AVG_SCORE,
        MAX(CASE WHEN a.IS_ANOMALY = TRUE THEN TO_TIMESTAMP(a.TIMESTAMP / 1000000000) END) AS LATEST_ANOMALY_TS,
        MIN(CASE WHEN a.IS_ANOMALY = TRUE THEN TO_TIMESTAMP(a.TIMESTAMP / 1000000000) END) AS FIRST_ANOMALY_TS,
        COUNT_IF(a.IS_TEMPERATURE_ANOMALY = TRUE) AS TEMP_ANOMALY_COUNT,
        COUNT_IF(a.IS_VIBRATION_ANOMALY = TRUE) AS VIB_ANOMALY_COUNT,
        COUNT_IF(a.IS_PRESSURE_ANOMALY = TRUE) AS PRESS_ANOMALY_COUNT,
        ROUND(AVG(CASE WHEN a.IS_ANOMALY = TRUE THEN s.TEMPERATURE END), 2) AS AVG_TEMP_ANOMALY,
        ROUND(AVG(CASE WHEN a.IS_ANOMALY = TRUE THEN s.VIBRATION END), 4) AS AVG_VIB_ANOMALY,
        ROUND(AVG(CASE WHEN a.IS_ANOMALY = TRUE THEN s.PRESSURE END), 4) AS AVG_PRESS_ANOMALY,
        ROUND(AVG(CASE WHEN a.IS_ANOMALY = TRUE THEN s.HEALTH_PCT END), 1) AS AVG_HEALTH_ANOMALY,
        ROUND(AVG(CASE WHEN a.IS_ANOMALY = FALSE THEN s.TEMPERATURE END), 2) AS AVG_TEMP_NORMAL,
        ROUND(AVG(CASE WHEN a.IS_ANOMALY = FALSE THEN s.VIBRATION END), 4) AS AVG_VIB_NORMAL,
        ROUND(AVG(CASE WHEN a.IS_ANOMALY = FALSE THEN s.PRESSURE END), 4) AS AVG_PRESS_NORMAL,
        ROUND(AVG(CASE WHEN a.IS_ANOMALY = FALSE THEN s.HEALTH_PCT END), 1) AS AVG_HEALTH_NORMAL
      FROM POC_AMMAN.GOLD.FACT_ANOMALY_DETECTION a
      JOIN POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA s
        ON a.MACHINE_ID = s.MACHINE_ID AND TO_TIMESTAMP(a.TIMESTAMP / 1000000000) = s.TIMESTAMP
      WHERE a.MACHINE_ID = ?${dateFilter}
    `, binds);

    // 2. Recent anomaly events with sensor values
    const eventBinds: (string | number)[] = [machineId, ...binds.slice(1)];
    const events = await querySnowflake<AnomalyEventRow>(`
      SELECT
        TO_TIMESTAMP(a.TIMESTAMP / 1000000000) AS TIMESTAMP,
        ROUND(a.ANOMALY_SCORE, 4) AS ANOMALY_SCORE,
        a.IS_ANOMALY,
        a.IS_TEMPERATURE_ANOMALY,
        a.IS_VIBRATION_ANOMALY,
        a.IS_PRESSURE_ANOMALY,
        ROUND(s.TEMPERATURE, 2) AS TEMPERATURE,
        ROUND(s.VIBRATION, 4) AS VIBRATION,
        ROUND(s.PRESSURE, 4) AS PRESSURE,
        ROUND(s.HEALTH_PCT, 1) AS HEALTH_PCT,
        s.HEALTH_STATUS
      FROM POC_AMMAN.GOLD.FACT_ANOMALY_DETECTION a
      JOIN POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA s
        ON a.MACHINE_ID = s.MACHINE_ID AND TO_TIMESTAMP(a.TIMESTAMP / 1000000000) = s.TIMESTAMP
      WHERE a.MACHINE_ID = ?
        AND a.IS_ANOMALY = TRUE${dateFilter}
      ORDER BY a.TIMESTAMP DESC
      LIMIT 20
    `, eventBinds);

    // 3. Latest reading (within filter period if specified)
    const latestBinds: (string | number)[] = [machineId];
    let latestDateFilter = "";
    if (month) {
      latestDateFilter += " AND MONTH(s.TIMESTAMP) = ?";
      latestBinds.push(parseInt(month));
    }
    if (year) {
      latestDateFilter += " AND YEAR(s.TIMESTAMP) = ?";
      latestBinds.push(parseInt(year));
    }
    const latest = await querySnowflake<LatestRow>(`
      SELECT
        s.MACHINE_ID,
        s.MACHINE_TYPE,
        ROUND(s.TEMPERATURE, 2) AS TEMPERATURE,
        ROUND(s.VIBRATION, 4) AS VIBRATION,
        ROUND(s.PRESSURE, 4) AS PRESSURE,
        ROUND(s.HEALTH_PCT, 1) AS HEALTH_PCT,
        s.HEALTH_STATUS,
        ROUND(a.ANOMALY_SCORE, 4) AS ANOMALY_SCORE,
        a.IS_ANOMALY,
        a.IS_TEMPERATURE_ANOMALY,
        a.IS_VIBRATION_ANOMALY,
        a.IS_PRESSURE_ANOMALY,
        s.TIMESTAMP
      FROM POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA s
      JOIN POC_AMMAN.GOLD.FACT_ANOMALY_DETECTION a
        ON s.MACHINE_ID = a.MACHINE_ID AND s.TIMESTAMP = TO_TIMESTAMP(a.TIMESTAMP / 1000000000)
      WHERE s.MACHINE_ID = ?${latestDateFilter}
      ORDER BY s.TIMESTAMP DESC
      LIMIT 1
    `, latestBinds);

    return NextResponse.json({
      machineId,
      stats: stats[0] || null,
      events,
      latest: latest[0] || null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

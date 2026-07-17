import { NextResponse } from "next/server";
import { querySnowflake } from "@/lib/snowflake";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface DetailRow {
  MACHINE_ID: string;
  MACHINE_TYPE: string;
  TIMESTAMP: string;
  TEMPERATURE: number;
  VIBRATION: number;
  PRESSURE: number;
  HEALTH_PCT: number;
  HEALTH_STATUS: string;
  OPERATIONAL_TIME: number;
  IS_RUNNING: boolean;
  AVG_DEVIATION_PCT: number;
  ANOMALY_SCORE: number;
  IS_ANOMALY: boolean;
  HEALTH_7D_AGO: number;
  HEALTH_30D_AGO: number;
  TREND_7D: number;
  TREND_30D: number;
  RUL_DAYS: number;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const machineId = decodeURIComponent(id);

    const rows = await querySnowflake<DetailRow>(`
      WITH latest AS (
        SELECT
          s.MACHINE_ID,
          s.MACHINE_TYPE,
          s.TIMESTAMP,
          s.TEMPERATURE,
          s.VIBRATION,
          s.PRESSURE,
          s.HEALTH_PCT,
          s.HEALTH_STATUS,
          s.OPERATIONAL_TIME,
          s.IS_RUNNING,
          s.AVG_DEVIATION_PCT,
          ROW_NUMBER() OVER (PARTITION BY s.MACHINE_ID ORDER BY s.TIMESTAMP DESC) AS rn
        FROM POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA s
        WHERE s.MACHINE_ID = ?
      ),
      past7d AS (
        SELECT HEALTH_PCT AS HEALTH_7D_AGO,
               ROW_NUMBER() OVER (ORDER BY TIMESTAMP DESC) AS rn
        FROM POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA
        WHERE MACHINE_ID = ?
          AND TIMESTAMP <= (SELECT MAX(TIMESTAMP) FROM POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA WHERE MACHINE_ID = ?) - INTERVAL '7 DAYS'
      ),
      past30d AS (
        SELECT HEALTH_PCT AS HEALTH_30D_AGO,
               ROW_NUMBER() OVER (ORDER BY TIMESTAMP DESC) AS rn
        FROM POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA
        WHERE MACHINE_ID = ?
          AND TIMESTAMP <= (SELECT MAX(TIMESTAMP) FROM POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA WHERE MACHINE_ID = ?) - INTERVAL '30 DAYS'
      ),
      anomaly_latest AS (
        SELECT ANOMALY_SCORE, IS_ANOMALY,
               ROW_NUMBER() OVER (ORDER BY TIMESTAMP DESC) AS rn
        FROM POC_AMMAN.GOLD.FACT_ANOMALY_DETECTION
        WHERE MACHINE_ID = ?
      )
      SELECT
        l.MACHINE_ID,
        l.MACHINE_TYPE,
        l.TIMESTAMP,
        ROUND(l.TEMPERATURE, 2) AS TEMPERATURE,
        ROUND(l.VIBRATION, 4) AS VIBRATION,
        ROUND(l.PRESSURE, 4) AS PRESSURE,
        ROUND(l.HEALTH_PCT, 1) AS HEALTH_PCT,
        l.HEALTH_STATUS,
        l.OPERATIONAL_TIME,
        l.IS_RUNNING,
        ROUND(l.AVG_DEVIATION_PCT, 2) AS AVG_DEVIATION_PCT,
        ROUND(a.ANOMALY_SCORE, 4) AS ANOMALY_SCORE,
        a.IS_ANOMALY,
        ROUND(p7.HEALTH_7D_AGO, 1) AS HEALTH_7D_AGO,
        ROUND(p30.HEALTH_30D_AGO, 1) AS HEALTH_30D_AGO,
        ROUND(l.HEALTH_PCT - p7.HEALTH_7D_AGO, 1) AS TREND_7D,
        ROUND(l.HEALTH_PCT - p30.HEALTH_30D_AGO, 1) AS TREND_30D,
        CASE
          WHEN l.HEALTH_PCT < 30 THEN 3
          WHEN l.HEALTH_PCT < 55 THEN 7
          WHEN l.HEALTH_PCT < 80 THEN 30
          ELSE 90
        END AS RUL_DAYS
      FROM latest l
      LEFT JOIN past7d p7 ON p7.rn = 1
      LEFT JOIN past30d p30 ON p30.rn = 1
      LEFT JOIN anomaly_latest a ON a.rn = 1
      WHERE l.rn = 1
    `, [machineId, machineId, machineId, machineId, machineId, machineId]);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: `Machine ${machineId} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

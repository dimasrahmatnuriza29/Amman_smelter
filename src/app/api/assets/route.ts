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
}

export async function GET() {
  try {
    const assets = await querySnowflake<AssetRow>(`
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
      ),
      past AS (
        SELECT
          MACHINE_ID,
          HEALTH_PCT AS HEALTH_PAST_AGO,
          ROW_NUMBER() OVER (PARTITION BY MACHINE_ID ORDER BY TIMESTAMP DESC) AS rn
        FROM POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA
        WHERE TIMESTAMP <= (SELECT MAX(TIMESTAMP) FROM POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA) - INTERVAL '7 DAYS'
      ),
      anomaly_latest AS (
        SELECT
          MACHINE_ID,
          ANOMALY_SCORE,
          IS_ANOMALY,
          ROW_NUMBER() OVER (PARTITION BY MACHINE_ID ORDER BY TIMESTAMP DESC) AS rn
        FROM POC_AMMAN.GOLD.FACT_ANOMALY_DETECTION
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
        a.IS_ANOMALY
      FROM latest l
      LEFT JOIN past p ON p.MACHINE_ID = l.MACHINE_ID AND p.rn = 1
      LEFT JOIN anomaly_latest a ON a.MACHINE_ID = l.MACHINE_ID AND a.rn = 1
      WHERE l.rn = 1
      ORDER BY l.HEALTH_PCT ASC
    `);

    return NextResponse.json(assets);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

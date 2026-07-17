import { NextResponse } from "next/server";
import { querySnowflake } from "@/lib/snowflake";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface AnomalyRow {
  MACHINE_ID: string;
  MACHINE_TYPE: string;
  ANOMALY_COUNT: number;
  MAX_SCORE: number;
  AVG_SCORE: number;
  LATEST_ANOMALY_TS: number;
  TEMP_ANOMALY_COUNT: number;
  VIB_ANOMALY_COUNT: number;
  PRESS_ANOMALY_COUNT: number;
}

interface AnomalyDetailRow {
  TIMESTAMP: number;
  MACHINE_ID: string;
  ANOMALY_SCORE: number;
  IS_ANOMALY: boolean;
  IS_TEMPERATURE_ANOMALY: boolean;
  IS_VIBRATION_ANOMALY: boolean;
  IS_PRESSURE_ANOMALY: boolean;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const machineId = searchParams.get("machineId");
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    let dateFilter = "";
    const binds: (string | number)[] = [];

    if (month) {
      dateFilter += " AND MONTH(TO_TIMESTAMP(a.TIMESTAMP / 1000000000)) = ?";
      binds.push(parseInt(month));
    }
    if (year) {
      dateFilter += " AND YEAR(TO_TIMESTAMP(a.TIMESTAMP / 1000000000)) = ?";
      binds.push(parseInt(year));
    }

    if (machineId) {
      // Detail anomalies for specific machine
      const detailBinds: (string | number)[] = [machineId, ...binds];
      const details = await querySnowflake<AnomalyDetailRow>(`
        SELECT
          a.TIMESTAMP,
          a.MACHINE_ID,
          ROUND(a.ANOMALY_SCORE, 4) AS ANOMALY_SCORE,
          a.IS_ANOMALY,
          a.IS_TEMPERATURE_ANOMALY,
          a.IS_VIBRATION_ANOMALY,
          a.IS_PRESSURE_ANOMALY
        FROM POC_AMMAN.GOLD.FACT_ANOMALY_DETECTION a
        WHERE a.MACHINE_ID = ?
          AND a.IS_ANOMALY = TRUE${dateFilter}
        ORDER BY a.TIMESTAMP DESC
        LIMIT 50
      `, detailBinds);

      return NextResponse.json(details);
    }

    // Summary: machines with anomaly events in the filtered period
    const summaryBinds: (string | number)[] = [...binds];
    const summary = await querySnowflake<AnomalyRow>(`
      WITH machine_types AS (
        SELECT DISTINCT MACHINE_ID, MACHINE_TYPE
        FROM POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA
      )
      SELECT
        a.MACHINE_ID,
        mt.MACHINE_TYPE,
        COUNT_IF(a.IS_ANOMALY = TRUE) AS ANOMALY_COUNT,
        COUNT_IF(a.IS_TEMPERATURE_ANOMALY = TRUE) AS TEMP_ANOMALY_COUNT,
        COUNT_IF(a.IS_VIBRATION_ANOMALY = TRUE) AS VIB_ANOMALY_COUNT,
        COUNT_IF(a.IS_PRESSURE_ANOMALY = TRUE) AS PRESS_ANOMALY_COUNT,
        ROUND(MAX(a.ANOMALY_SCORE), 4) AS MAX_SCORE,
        ROUND(AVG(a.ANOMALY_SCORE), 4) AS AVG_SCORE,
        MAX(CASE WHEN a.IS_ANOMALY = TRUE THEN a.TIMESTAMP END) AS LATEST_ANOMALY_TS
      FROM POC_AMMAN.GOLD.FACT_ANOMALY_DETECTION a
      JOIN machine_types mt ON mt.MACHINE_ID = a.MACHINE_ID
      WHERE a.IS_ANOMALY = TRUE${dateFilter}
      GROUP BY a.MACHINE_ID, mt.MACHINE_TYPE
      ORDER BY MAX_SCORE DESC
    `, summaryBinds);

    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

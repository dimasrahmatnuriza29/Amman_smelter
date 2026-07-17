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
}

interface AnomalyDetailRow {
  TIMESTAMP: number;
  MACHINE_ID: string;
  ANOMALY_SCORE: number;
  IS_ANOMALY: boolean;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const machineId = searchParams.get("machineId");

    if (machineId) {
      // Detail anomalies for specific machine
      const details = await querySnowflake<AnomalyDetailRow>(`
        SELECT
          TIMESTAMP,
          MACHINE_ID,
          ROUND(ANOMALY_SCORE, 4) AS ANOMALY_SCORE,
          IS_ANOMALY
        FROM POC_AMMAN.GOLD.FACT_ANOMALY_DETECTION
        WHERE MACHINE_ID = ?
          AND IS_ANOMALY = TRUE
        ORDER BY TIMESTAMP DESC
        LIMIT 50
      `, [machineId]);

      return NextResponse.json(details);
    }

    // Summary: only machines currently flagged as anomaly (latest reading IS_ANOMALY=TRUE)
    const summary = await querySnowflake<AnomalyRow>(`
      WITH machine_types AS (
        SELECT DISTINCT MACHINE_ID, MACHINE_TYPE
        FROM POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA
      ),
      latest_anomaly AS (
        SELECT MACHINE_ID, IS_ANOMALY,
          ROW_NUMBER() OVER (PARTITION BY MACHINE_ID ORDER BY TIMESTAMP DESC) AS rn
        FROM POC_AMMAN.GOLD.FACT_ANOMALY_DETECTION
      )
      SELECT
        a.MACHINE_ID,
        mt.MACHINE_TYPE,
        COUNT_IF(a.IS_ANOMALY = TRUE) AS ANOMALY_COUNT,
        ROUND(MAX(a.ANOMALY_SCORE), 4) AS MAX_SCORE,
        ROUND(AVG(a.ANOMALY_SCORE), 4) AS AVG_SCORE,
        MAX(CASE WHEN a.IS_ANOMALY = TRUE THEN a.TIMESTAMP END) AS LATEST_ANOMALY_TS
      FROM POC_AMMAN.GOLD.FACT_ANOMALY_DETECTION a
      JOIN machine_types mt ON mt.MACHINE_ID = a.MACHINE_ID
      JOIN latest_anomaly la ON la.MACHINE_ID = a.MACHINE_ID AND la.rn = 1 AND la.IS_ANOMALY = TRUE
      GROUP BY a.MACHINE_ID, mt.MACHINE_TYPE
      ORDER BY MAX_SCORE DESC
    `);

    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

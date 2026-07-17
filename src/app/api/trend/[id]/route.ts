import { NextResponse } from "next/server";
import { querySnowflake } from "@/lib/snowflake";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface TrendRow {
  TIMESTAMP: string;
  TEMPERATURE: number;
  VIBRATION: number;
  PRESSURE: number;
  HEALTH_PCT: number;
  ANOMALY_SCORE: number;
  IS_ANOMALY: boolean;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const machineId = decodeURIComponent(id);

    const rows = await querySnowflake<TrendRow>(`
      SELECT
        s.TIMESTAMP,
        ROUND(s.TEMPERATURE, 2) AS TEMPERATURE,
        ROUND(s.VIBRATION, 4) AS VIBRATION,
        ROUND(s.PRESSURE, 4) AS PRESSURE,
        ROUND(s.HEALTH_PCT, 1) AS HEALTH_PCT,
        ROUND(a.ANOMALY_SCORE, 4) AS ANOMALY_SCORE,
        a.IS_ANOMALY
      FROM POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA s
      LEFT JOIN POC_AMMAN.GOLD.FACT_ANOMALY_DETECTION a
        ON a.MACHINE_ID = s.MACHINE_ID
        AND a.TIMESTAMP = EXTRACT(EPOCH FROM s.TIMESTAMP) * 1000000000
      WHERE s.MACHINE_ID = ?
        AND s.TIMESTAMP >= (
          (SELECT MAX(TIMESTAMP) FROM POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA WHERE MACHINE_ID = ?)
          - INTERVAL '7 DAYS'
        )
      ORDER BY s.TIMESTAMP ASC
    `, [machineId, machineId]);

    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

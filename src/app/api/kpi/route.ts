import { NextResponse } from "next/server";
import { querySnowflake } from "@/lib/snowflake";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface KpiRow {
  AVG_HEALTH: number;
  HEALTHY_COUNT: number;
  WARNING_COUNT: number;
  CRITICAL_COUNT: number;
  TOTAL_MACHINES: number;
  ANOMALY_COUNT: number;
  TOTAL_READINGS: number;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    let dateFilter = "";
    const binds: (string | number)[] = [];

    if (month) {
      dateFilter += " AND MONTH(TIMESTAMP) = ?";
      binds.push(parseInt(month));
    }
    if (year) {
      dateFilter += " AND YEAR(TIMESTAMP) = ?";
      binds.push(parseInt(year));
    }

    let anomFilter = "";
    const anomBinds: (string | number)[] = [];

    if (month) {
      anomFilter += " AND MONTH(TO_TIMESTAMP(TIMESTAMP / 1000000000)) = ?";
      anomBinds.push(parseInt(month));
    }
    if (year) {
      anomFilter += " AND YEAR(TO_TIMESTAMP(TIMESTAMP / 1000000000)) = ?";
      anomBinds.push(parseInt(year));
    }

    // Latest health per machine + counts
    const kpi = await querySnowflake<KpiRow>(`
      WITH latest AS (
        SELECT
          MACHINE_ID,
          MACHINE_TYPE,
          HEALTH_PCT,
          HEALTH_STATUS,
          ROW_NUMBER() OVER (PARTITION BY MACHINE_ID ORDER BY TIMESTAMP DESC) AS rn
        FROM POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA
        WHERE 1=1 ${dateFilter}
      )
      SELECT
        ROUND(AVG(HEALTH_PCT), 1) AS AVG_HEALTH,
        COUNT_IF(HEALTH_STATUS = 'HEALTHY') AS HEALTHY_COUNT,
        COUNT_IF(HEALTH_STATUS = 'WARNING') AS WARNING_COUNT,
        COUNT_IF(HEALTH_STATUS = 'CRITICAL') AS CRITICAL_COUNT,
        COUNT(*) AS TOTAL_MACHINES,
        0 AS ANOMALY_COUNT,
        0 AS TOTAL_READINGS
      FROM latest
      WHERE rn = 1
    `, binds);

    // Total anomaly count
    const anomalies = await querySnowflake<{ CNT: number }>(`
      SELECT COUNT(*) AS CNT
      FROM POC_AMMAN.GOLD.FACT_ANOMALY_DETECTION
      WHERE IS_ANOMALY = TRUE ${anomFilter}
    `, anomBinds);

    // Total readings
    const readings = await querySnowflake<{ CNT: number }>(`
      SELECT COUNT(*) AS CNT
      FROM POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA
      WHERE 1=1 ${dateFilter}
    `, binds);

    return NextResponse.json({
      avgHealth: kpi[0]?.AVG_HEALTH ?? 0,
      healthyCount: kpi[0]?.HEALTHY_COUNT ?? 0,
      warningCount: kpi[0]?.WARNING_COUNT ?? 0,
      criticalCount: kpi[0]?.CRITICAL_COUNT ?? 0,
      totalMachines: kpi[0]?.TOTAL_MACHINES ?? 0,
      anomalyCount: anomalies[0]?.CNT ?? 0,
      totalReadings: readings[0]?.CNT ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

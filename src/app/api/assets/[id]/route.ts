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
  TEMP_DEVIATION_PCT: number;
  VIB_DEVIATION_PCT: number;
  PRESS_DEVIATION_PCT: number;
  ANOMALY_SCORE: number;
  IS_ANOMALY: boolean;
  IS_TEMPERATURE_ANOMALY: boolean;
  IS_VIBRATION_ANOMALY: boolean;
  IS_PRESSURE_ANOMALY: boolean;
  RUL_DAYS: number;
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
    const binds: (string | number)[] = [];

    if (month) {
      dateFilter += " AND MONTH(s.TIMESTAMP) = ?";
      binds.push(parseInt(month));
    }
    if (year) {
      dateFilter += " AND YEAR(s.TIMESTAMP) = ?";
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

    const rows = await querySnowflake<DetailRow>(`
      WITH sensor_stats AS (
        SELECT
          MACHINE_TYPE,
          AVG(TEMPERATURE) AS AVG_TEMP,
          STDDEV(TEMPERATURE) AS STD_TEMP,
          AVG(VIBRATION) AS AVG_VIB,
          STDDEV(VIBRATION) AS STD_VIB,
          AVG(PRESSURE) AS AVG_PRESS,
          STDDEV(PRESSURE) AS STD_PRESS
        FROM POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA
        GROUP BY MACHINE_TYPE
      ),
      latest AS (
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
        WHERE s.MACHINE_ID = ?${dateFilter}
      ),
      anomaly_latest AS (
        SELECT ANOMALY_SCORE, IS_ANOMALY,
               IS_TEMPERATURE_ANOMALY, IS_VIBRATION_ANOMALY, IS_PRESSURE_ANOMALY,
               ROW_NUMBER() OVER (ORDER BY TIMESTAMP DESC) AS rn
        FROM POC_AMMAN.GOLD.FACT_ANOMALY_DETECTION
        WHERE MACHINE_ID = ?${anomFilter}
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
        ROUND(ABS(l.TEMPERATURE - st.AVG_TEMP) / NULLIF(st.STD_TEMP, 0) * 100, 2) AS TEMP_DEVIATION_PCT,
        ROUND(ABS(l.VIBRATION - st.AVG_VIB) / NULLIF(st.STD_VIB, 0) * 100, 2) AS VIB_DEVIATION_PCT,
        ROUND(ABS(l.PRESSURE - st.AVG_PRESS) / NULLIF(st.STD_PRESS, 0) * 100, 2) AS PRESS_DEVIATION_PCT,
        ROUND(a.ANOMALY_SCORE, 4) AS ANOMALY_SCORE,
        a.IS_ANOMALY,
        a.IS_TEMPERATURE_ANOMALY,
        a.IS_VIBRATION_ANOMALY,
        a.IS_PRESSURE_ANOMALY,
        CASE
          WHEN l.HEALTH_PCT < 30 THEN 3
          WHEN l.HEALTH_PCT < 55 THEN 7
          WHEN l.HEALTH_PCT < 80 THEN 30
          ELSE 90
        END AS RUL_DAYS
      FROM latest l
      LEFT JOIN sensor_stats st ON st.MACHINE_TYPE = l.MACHINE_TYPE
      LEFT JOIN anomaly_latest a ON a.rn = 1
      WHERE l.rn = 1
    `, [machineId, ...binds, machineId, ...anomBinds]);

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

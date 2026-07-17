import { NextResponse } from "next/server";
import { querySnowflake } from "@/lib/snowflake";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface HistoryEventRow {
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
    const machineId = searchParams.get("machineId");
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const limit = parseInt(searchParams.get("limit") || "500");

    if (!machineId) {
      return NextResponse.json(
        { error: "machineId is required" },
        { status: 400 }
      );
    }

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

    binds.push(limit);

    const events = await querySnowflake<HistoryEventRow>(`
      SELECT
        TO_TIMESTAMP(a.TIMESTAMP / 1000000000) AS TIMESTAMP,
        ROUND(s.TEMPERATURE, 2) AS TEMPERATURE,
        ROUND(s.VIBRATION, 4) AS VIBRATION,
        ROUND(s.PRESSURE, 4) AS PRESSURE,
        ROUND(s.HEALTH_PCT, 1) AS HEALTH_PCT,
        a.IS_TEMPERATURE_ANOMALY,
        a.IS_VIBRATION_ANOMALY,
        a.IS_PRESSURE_ANOMALY
      FROM POC_AMMAN.GOLD.FACT_ANOMALY_DETECTION a
      JOIN POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA s
        ON a.MACHINE_ID = s.MACHINE_ID
        AND TO_TIMESTAMP(a.TIMESTAMP / 1000000000) = s.TIMESTAMP
      WHERE a.MACHINE_ID = ?
        AND a.IS_ANOMALY = TRUE
        ${dateFilter}
      ORDER BY a.TIMESTAMP DESC
      LIMIT ?
    `, binds);

    return NextResponse.json(events);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

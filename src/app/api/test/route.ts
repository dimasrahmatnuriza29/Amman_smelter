import { NextResponse } from "next/server";
import { querySnowflake } from "@/lib/snowflake";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const version = await querySnowflake<{ VERSION: string }>(
      "SELECT CURRENT_VERSION() AS VERSION"
    );

    const machines = await querySnowflake<{
      MACHINE_ID: string;
      MACHINE_TYPE: string;
      ROW_COUNT: number;
    }>(
      `SELECT MACHINE_ID, MACHINE_TYPE, COUNT(*) AS ROW_COUNT
       FROM POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA
       GROUP BY MACHINE_ID, MACHINE_TYPE
       ORDER BY MACHINE_ID`
    );

    return NextResponse.json({
      status: "ok",
      snowflakeVersion: version[0]?.VERSION,
      machines,
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: (error as Error).message },
      { status: 500 }
    );
  }
}

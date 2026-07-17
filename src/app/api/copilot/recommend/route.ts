import { NextResponse } from "next/server";
import { querySnowflake } from "@/lib/snowflake";
import { getKnowledgeByMachineType } from "@/lib/knowledge";
import { callDeepSeek } from "@/lib/huggingface";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface SensorRow {
  MACHINE_ID: string;
  MACHINE_TYPE: string;
  TEMPERATURE: number;
  VIBRATION: number;
  PRESSURE: number;
  HEALTH_PCT: number;
  HEALTH_STATUS: string;
  ANOMALY_SCORE: number;
  IS_ANOMALY: boolean;
  TREND_7D: number;
  OPERATIONAL_TIME: number;
}

const SYSTEM_PROMPT = `You are a Smelter Asset Health AI Copilot — a professional maintenance engineer expert.

Your job: analyze sensor anomalies and provide structured recommendations.

RULES:
1. ONLY answer based on the provided sensor data and troubleshooting knowledge.
2. Do NOT hallucinate or invent data not provided.
3. If data is insufficient, state "data tidak tersedia untuk diagnosis lengkap".
4. Follow the output format EXACTLY.
5. Use the decision workflow from the troubleshooting guide.
6. Check safety overrides first (furnace CO spike, seal water loss, cooling water loss = URGENT).
7. Rank possible causes by confidence (single signal 40-60%, correlated 70-90%, multi+history 90%+).
8. Priority mapping: Health <30% + anomaly = Urgent, 30-54% = High, 55-79% = Medium, 80%+ = Low/Monitor.
9. Write in clear professional English with technical precision.
10. DO NOT show your reasoning/thinking process. Output ONLY the final formatted result.
11. Keep it concise — maximum 300 words total.
12. Health_pct is the asset health percentage (higher = better). HEALTH_STATUS is derived from health_pct bands: 80-100=HEALTHY, 55-79=WARNING, 30-54=BORDERLINE, 0-29=CRITICAL.
13. Anomaly score from Isolation Forest: negative = anomaly, positive = normal. IS_ANOMALY=TRUE means ML detected abnormal pattern.

OUTPUT FORMAT (follow exactly, no preamble):
📋 Summary: [1-2 sentence overview]
🔍 Possible Causes:
  1. [Cause name] — [XX]% confidence
     Signals: [which sensor values]
  2. [Cause name] — [XX]% confidence
     Signals: [which sensor values]
✅ Recommended Actions:
  □ [Action 1]
  □ [Action 2]
  □ [Action 3]
⚠ Priority: [Urgent/High/Medium/Low] | ETA: [timeframe]
   Reason: [why this priority]`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { machineId } = body as { machineId: string };

    if (!machineId) {
      return NextResponse.json(
        { error: "machineId is required" },
        { status: 400 }
      );
    }

    // 1. Get latest sensor data from GOLD
    const sensorData = await querySnowflake<SensorRow>(`
      WITH latest AS (
        SELECT
          s.MACHINE_ID,
          s.MACHINE_TYPE,
          s.TEMPERATURE,
          s.VIBRATION,
          s.PRESSURE,
          s.HEALTH_PCT,
          s.HEALTH_STATUS,
          s.OPERATIONAL_TIME,
          ROW_NUMBER() OVER (PARTITION BY s.MACHINE_ID ORDER BY s.TIMESTAMP DESC) AS rn
        FROM POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA s
        WHERE s.MACHINE_ID = ?
      ),
      anomaly_latest AS (
        SELECT ANOMALY_SCORE, IS_ANOMALY,
               ROW_NUMBER() OVER (ORDER BY TIMESTAMP DESC) AS rn
        FROM POC_AMMAN.GOLD.FACT_ANOMALY_DETECTION
        WHERE MACHINE_ID = ?
      ),
      past7d AS (
        SELECT HEALTH_PCT AS HEALTH_7D_AGO,
               ROW_NUMBER() OVER (ORDER BY TIMESTAMP DESC) AS rn
        FROM POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA
        WHERE MACHINE_ID = ?
          AND TIMESTAMP <= (SELECT MAX(TIMESTAMP) FROM POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA WHERE MACHINE_ID = ?) - INTERVAL '7 DAYS'
      )
      SELECT
        l.MACHINE_ID,
        l.MACHINE_TYPE,
        ROUND(l.TEMPERATURE, 2) AS TEMPERATURE,
        ROUND(l.VIBRATION, 4) AS VIBRATION,
        ROUND(l.PRESSURE, 4) AS PRESSURE,
        ROUND(l.HEALTH_PCT, 1) AS HEALTH_PCT,
        l.HEALTH_STATUS,
        l.OPERATIONAL_TIME,
        ROUND(a.ANOMALY_SCORE, 4) AS ANOMALY_SCORE,
        a.IS_ANOMALY,
        ROUND(l.HEALTH_PCT - p.HEALTH_7D_AGO, 1) AS TREND_7D
      FROM latest l
      LEFT JOIN past7d p ON p.rn = 1
      LEFT JOIN anomaly_latest a ON a.rn = 1
      WHERE l.rn = 1
    `, [machineId, machineId, machineId, machineId]);

    if (sensorData.length === 0) {
      return NextResponse.json(
        { error: `Machine ${machineId} not found` },
        { status: 404 }
      );
    }

    const s = sensorData[0];

    // 2. Get knowledge from PDF
    const knowledge = getKnowledgeByMachineType(s.MACHINE_TYPE);

    // 3. Build user prompt
    const userPrompt = `SENSOR DATA (from Snowflake GOLD — real-time):
  Machine: ${s.MACHINE_ID}
  Type: ${s.MACHINE_TYPE}
  Temperature: ${s.TEMPERATURE}°C
  Vibration: ${s.VIBRATION} mm/s
  Pressure: ${s.PRESSURE} bar
  Health: ${s.HEALTH_PCT}% (${s.HEALTH_STATUS})
  Anomaly Score: ${s.ANOMALY_SCORE}
  IS_ANOMALY: ${s.IS_ANOMALY}
  7-Day Health Trend: ${s.TREND_7D > 0 ? "+" : ""}${s.TREND_7D}%
  Operational Hours: ${s.OPERATIONAL_TIME}

TROUBLESHOOTING KNOWLEDGE BASE (from Smelter Asset Health Troubleshooting Guide):
${knowledge}

TASK:
Analyze the sensor data above for anomalies. Compare actual values against normal ranges from the troubleshooting guide. Identify possible root causes, rank by confidence, and provide actionable recommendations. Follow the output format exactly.`;

    // 4. Call DeepSeek via Hugging Face
    const aiResponse = await callDeepSeek(SYSTEM_PROMPT, userPrompt, 2048);

    return NextResponse.json({
      machineId: s.MACHINE_ID,
      machineType: s.MACHINE_TYPE,
      isAnomaly: s.IS_ANOMALY,
      healthPct: s.HEALTH_PCT,
      recommendation: aiResponse,
      sensorSnapshot: {
        temperature: s.TEMPERATURE,
        vibration: s.VIBRATION,
        pressure: s.PRESSURE,
        healthPct: s.HEALTH_PCT,
        anomalyScore: s.ANOMALY_SCORE,
        trend7d: s.TREND_7D,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

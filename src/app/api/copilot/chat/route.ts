import { NextResponse } from "next/server";
import { querySnowflake } from "@/lib/snowflake";
import { getKnowledgeByMachineType } from "@/lib/knowledge";
import { callDeepSeek } from "@/lib/huggingface";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

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

const SYSTEM_PROMPT = `You are a Smelter Maintenance Copilot — a professional machine engineer AI assistant.

Your job: answer user questions about smelter asset maintenance based on real sensor data and troubleshooting knowledge.

RULES (STRICT GUARDRAILS):
1. ONLY answer based on: (a) the sensor data provided, (b) the troubleshooting knowledge provided, (c) general machine engineering expertise.
2. Do NOT hallucinate or invent data. If data is not available, say "data tidak tersedia" (data not available).
3. If the user asks about a machine, use the provided sensor data for that machine.
4. If the user asks about normal ranges, use the troubleshooting guide values.
5. Be concise but technically precise. Use bullet points for clarity.
6. You may answer in Indonesian or English, matching the user's language.
7. If recommending actions, format as a checklist.
8. Always cite which sensor values or knowledge base section your answer is based on.`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      message,
      machineId,
      history = [],
    } = body as {
      message: string;
      machineId?: string | null;
      history?: ChatMessage[];
    };

    if (!message) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    // 1. Get sensor data if machineId is provided
    let sensorContext = "No specific machine selected. Provide general guidance only.";
    let knowledge = "";

    if (machineId) {
      const sensorData = await querySnowflake<SensorRow>(`
        WITH latest AS (
          SELECT
            s.MACHINE_ID, s.MACHINE_TYPE, s.TEMPERATURE, s.VIBRATION,
            s.PRESSURE, s.HEALTH_PCT, s.HEALTH_STATUS, s.OPERATIONAL_TIME,
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
          l.MACHINE_ID, l.MACHINE_TYPE,
          ROUND(l.TEMPERATURE, 2) AS TEMPERATURE,
          ROUND(l.VIBRATION, 4) AS VIBRATION,
          ROUND(l.PRESSURE, 4) AS PRESSURE,
          ROUND(l.HEALTH_PCT, 1) AS HEALTH_PCT,
          l.HEALTH_STATUS, l.OPERATIONAL_TIME,
          ROUND(a.ANOMALY_SCORE, 4) AS ANOMALY_SCORE,
          a.IS_ANOMALY,
          ROUND(l.HEALTH_PCT - p.HEALTH_7D_AGO, 1) AS TREND_7D
        FROM latest l
        LEFT JOIN past7d p ON p.rn = 1
        LEFT JOIN anomaly_latest a ON a.rn = 1
        WHERE l.rn = 1
      `, [machineId, machineId, machineId, machineId]);

      if (sensorData.length > 0) {
        const s = sensorData[0];
        sensorContext = `CURRENT SENSOR DATA (from Snowflake GOLD):
  Machine: ${s.MACHINE_ID}
  Type: ${s.MACHINE_TYPE}
  Temperature: ${s.TEMPERATURE}°C
  Vibration: ${s.VIBRATION} mm/s
  Pressure: ${s.PRESSURE} bar
  Health: ${s.HEALTH_PCT}% (${s.HEALTH_STATUS})
  Anomaly Score: ${s.ANOMALY_SCORE}
  IS_ANOMALY: ${s.IS_ANOMALY}
  7-Day Health Trend: ${s.TREND_7D > 0 ? "+" : ""}${s.TREND_7D}%
  Operational Hours: ${s.OPERATIONAL_TIME}`;

        knowledge = getKnowledgeByMachineType(s.MACHINE_TYPE);
      } else {
        sensorContext = `Machine ${machineId} not found in GOLD data.`;
      }
    }

    // 2. Build user prompt
    const userPrompt = `${sensorContext}

${knowledge ? `TROUBLESHOOTING KNOWLEDGE BASE:\n${knowledge}` : ""}

USER QUESTION: ${message}

Answer based on the data and knowledge above. If information is not available, state "data tidak tersedia". Be concise and technically precise.`;

    // 3. Build conversation history
    const historyText = history
      .slice(-6) // last 3 exchanges
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    const fullPrompt = historyText
      ? `CONVERSATION HISTORY:\n${historyText}\n\n${userPrompt}`
      : userPrompt;

    // 4. Call DeepSeek
    const aiResponse = await callDeepSeek(SYSTEM_PROMPT, fullPrompt, 768);

    return NextResponse.json({
      response: aiResponse,
      machineId: machineId ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

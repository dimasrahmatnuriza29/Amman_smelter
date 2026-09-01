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
  IS_TEMPERATURE_ANOMALY: boolean;
  IS_VIBRATION_ANOMALY: boolean;
  IS_PRESSURE_ANOMALY: boolean;
  OPERATIONAL_TIME: number;
}

interface HistoryRow {
  ANOMALY_HISTORY_COUNT: number;
  TEMP_ANOMALY_COUNT: number;
  VIB_ANOMALY_COUNT: number;
  PRESS_ANOMALY_COUNT: number;
  FIRST_ANOMALY_TS: string | null;
  LAST_ANOMALY_TS: string | null;
  AVG_TEMP_ANOMALY: number;
  AVG_VIB_ANOMALY: number;
  AVG_PRESS_ANOMALY: number;
  AVG_HEALTH_ANOMALY: number;
}

const SYSTEM_PROMPT = `You are a Smelter Asset Health AI Copilot — a professional maintenance engineer expert.

Your job: analyze sensor anomalies and provide structured recommendations.

ANOMALY DETECTION LOGIC (CRITICAL):
- IS_ANOMALY only describes the LATEST reading. It is NOT the only trigger for a recommendation.
- Decide which of the THREE output formats to use:
  A. ANOMALY FORMAT — IS_ANOMALY=TRUE on the latest reading.
  B. DEGRADED FORMAT — IS_ANOMALY is not TRUE, BUT at least one of these holds:
     - HEALTH_PCT < 80 (HEALTH_STATUS is WARNING, BORDERLINE, or CRITICAL), OR
     - any sensor value is outside the normal range stated in the troubleshooting guide, OR
     - the anomaly history for the period shows recurring events.
  C. HEALTHY FORMAT — IS_ANOMALY is not TRUE, HEALTH_PCT >= 80, all sensors within guide ranges, and no meaningful anomaly history.
- For DEGRADED (B): the machine is NOT healthy. Diagnose the degradation using the sensor values vs the guide ranges plus the anomaly history breakdown, and give real corrective actions. Never answer "no action required" when health is below 80% or a sensor is out of range.
- Do NOT invent sensor readings or anomaly flags that are not in the provided data.
- When anomaly IS detected (IS_ANOMALY=TRUE):
  → Diagnosis MUST be based SOLELY on the specific anomaly type flags:
    - IS_TEMPERATURE_ANOMALY=TRUE → temperature sensor exceeds normal statistical bounds → check temp against normal ranges from guide.
    - IS_VIBRATION_ANOMALY=TRUE → vibration sensor exceeds normal statistical bounds → check vibration against ISO 10816 zones.
    - IS_PRESSURE_ANOMALY=TRUE → pressure sensor exceeds normal statistical bounds → check pressure against normal ranges from guide.
  → IS_ANOMALY is ONLY a general trigger flag — do NOT use it for root cause analysis.
  → ANOMALY_SCORE is a holistic Isolation Forest score — do NOT use it for diagnosis.
  → If IS_PRESSURE_ANOMALY=TRUE, focus on pressure-related causes. If IS_TEMPERATURE_ANOMALY=TRUE, focus on temperature-related causes.
  → If multiple specific flags are TRUE, correlate them for higher confidence (e.g. temp+vib anomaly = bearing wear).
  → If IS_ANOMALY=TRUE but NO specific flag is TRUE, state that the specific anomaly source cannot be determined.
  → Use the ANOMALY OUTPUT FORMAT (below).

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
13. Use markdown formatting: **bold** for key values, ## for section headers, - bullet lists for actions (do NOT use □ or other checkbox symbols, use - only), > for notes/warnings.
14. You can include a chart by outputting a fenced code block with language \`chart\` containing JSON: {"type":"bar","title":"Sensor Status","data":[{"name":"Temp","value":1013},{"name":"Vib","value":5.2},{"name":"Press","value":3.0}],"xKey":"name","yKey":"value","color":"#f59e0b"}. Supported types: bar, line, pie. Include a chart for the ANOMALY and DEGRADED formats when sensor values need visual comparison. Do NOT include a chart for the HEALTHY format. Max 1 chart. Always emit the full JSON on a single line and close the fence.

DEGRADED OUTPUT FORMAT (use for case B):
⚠ Summary: [Machine name] shows no active anomaly in [filter period], but health is [value]% ([status]). State which sensor(s) are out of range and/or the recurring anomaly pattern.
📊 Sensor Status:
  - Temperature: [value]°C — [within/above/below] normal range ([range from guide])
  - Vibration: [value] mm/s — [within/above/below] normal range ([range from guide])
  - Pressure: [value] bar — [within/above/below] normal range ([range from guide])
  - Health: [value]% ([status])
🔍 Likely Degradation Causes:
  1. [Cause name] — [XX]% confidence
     Signals: [sensor value vs guide range, anomaly history counts]
  2. [Cause name] — [XX]% confidence
     Signals: [sensor value vs guide range, anomaly history counts]
✅ Recommended Actions:
  - [Action 1]
  - [Action 2]
  - [Action 3]
⚠ Priority: [Urgent/High/Medium/Low] | ETA: [timeframe]
   Reason: [why this priority]

HEALTHY OUTPUT FORMAT (use only for case C):
✅ Summary: [Machine name] is operating normally in [filter period]. No anomalies detected.
📊 Sensor Status:
  - Temperature: [value]°C — [within/above/below] normal range ([range from guide])
  - Vibration: [value] mm/s — [within/above/below] normal range ([range from guide])
  - Pressure: [value] bar — [within/above/below] normal range ([range from guide])
  - Health: [value]% ([status])
� Recommendation: Continue routine monitoring. No immediate action required.
⚠ Priority: Low | ETA: Next scheduled inspection

ANOMALY OUTPUT FORMAT (use when IS_ANOMALY=TRUE):
�📋 Summary: [1-2 sentence overview — state WHICH specific sensor type(s) triggered the anomaly and the actual sensor value vs normal range]
🔍 Possible Causes:
  1. [Cause name] — [XX]% confidence
     Signals: [which specific anomaly flag(s) + actual sensor value + normal range from guide]
  2. [Cause name] — [XX]% confidence
     Signals: [which specific anomaly flag(s) + actual sensor value + normal range from guide]
✅ Recommended Actions:
  - [Action 1]
  - [Action 2]
  - [Action 3]
⚠ Priority: [Urgent/High/Medium/Low] | ETA: [timeframe]
   Reason: [why this priority]`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { machineId, month, year } = body as { machineId: string; month?: number; year?: number };

    if (!machineId) {
      return NextResponse.json(
        { error: "machineId is required" },
        { status: 400 }
      );
    }

    let sensorDateFilter = "";
    let anomDateFilter = "";
    const sensorBinds: (string | number)[] = [machineId];
    const anomBinds: (string | number)[] = [machineId];

    if (month) {
      sensorDateFilter += " AND MONTH(s.TIMESTAMP) = ?";
      sensorBinds.push(month);
      anomDateFilter += " AND MONTH(TO_TIMESTAMP(a.TIMESTAMP / 1000000000)) = ?";
      anomBinds.push(month);
    }
    if (year) {
      sensorDateFilter += " AND YEAR(s.TIMESTAMP) = ?";
      sensorBinds.push(year);
      anomDateFilter += " AND YEAR(TO_TIMESTAMP(a.TIMESTAMP / 1000000000)) = ?";
      anomBinds.push(year);
    }

    // 1. Get latest sensor data from GOLD (within filter period)
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
        WHERE s.MACHINE_ID = ?${sensorDateFilter}
      ),
      anomaly_latest AS (
        SELECT ANOMALY_SCORE, IS_ANOMALY,
               IS_TEMPERATURE_ANOMALY, IS_VIBRATION_ANOMALY, IS_PRESSURE_ANOMALY,
               ROW_NUMBER() OVER (ORDER BY TIMESTAMP DESC) AS rn
        FROM POC_AMMAN.GOLD.FACT_ANOMALY_DETECTION a
        WHERE a.MACHINE_ID = ?${anomDateFilter}
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
        a.IS_TEMPERATURE_ANOMALY,
        a.IS_VIBRATION_ANOMALY,
        a.IS_PRESSURE_ANOMALY
      FROM latest l
      LEFT JOIN anomaly_latest a ON a.rn = 1
      WHERE l.rn = 1
    `, [...sensorBinds, ...anomBinds]);

    // 1b. Get anomaly history stats within filter period
    const historyData = await querySnowflake<HistoryRow>(`
      SELECT
        COUNT_IF(a.IS_ANOMALY = TRUE) AS ANOMALY_HISTORY_COUNT,
        COUNT_IF(a.IS_TEMPERATURE_ANOMALY = TRUE) AS TEMP_ANOMALY_COUNT,
        COUNT_IF(a.IS_VIBRATION_ANOMALY = TRUE) AS VIB_ANOMALY_COUNT,
        COUNT_IF(a.IS_PRESSURE_ANOMALY = TRUE) AS PRESS_ANOMALY_COUNT,
        MIN(CASE WHEN a.IS_ANOMALY = TRUE THEN TO_TIMESTAMP(a.TIMESTAMP / 1000000000) END) AS FIRST_ANOMALY_TS,
        MAX(CASE WHEN a.IS_ANOMALY = TRUE THEN TO_TIMESTAMP(a.TIMESTAMP / 1000000000) END) AS LAST_ANOMALY_TS,
        ROUND(AVG(CASE WHEN a.IS_ANOMALY = TRUE THEN s.TEMPERATURE END), 2) AS AVG_TEMP_ANOMALY,
        ROUND(AVG(CASE WHEN a.IS_ANOMALY = TRUE THEN s.VIBRATION END), 4) AS AVG_VIB_ANOMALY,
        ROUND(AVG(CASE WHEN a.IS_ANOMALY = TRUE THEN s.PRESSURE END), 4) AS AVG_PRESS_ANOMALY,
        ROUND(AVG(CASE WHEN a.IS_ANOMALY = TRUE THEN s.HEALTH_PCT END), 1) AS AVG_HEALTH_ANOMALY
      FROM POC_AMMAN.GOLD.FACT_ANOMALY_DETECTION a
      JOIN POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA s
        ON a.MACHINE_ID = s.MACHINE_ID AND TO_TIMESTAMP(a.TIMESTAMP / 1000000000) = s.TIMESTAMP
      WHERE a.MACHINE_ID = ?${anomDateFilter}
    `, anomBinds);

    if (sensorData.length === 0) {
      return NextResponse.json(
        { error: `Machine ${machineId} not found` },
        { status: 404 }
      );
    }

    const s = sensorData[0];
    const h = historyData[0];

    // 2. Get knowledge from PDF
    const knowledge = getKnowledgeByMachineType(s.MACHINE_TYPE);

    // 2b. Build anomaly history context
    const filterLabel = month && year
      ? `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month-1]} ${year}`
      : year ? `Year ${year}` : 'All time';

    let historyContext = '';
    if (h && h.ANOMALY_HISTORY_COUNT > 0) {
      historyContext = `

ANOMALY HISTORY (within selected filter: ${filterLabel}):
  Total anomaly events: ${h.ANOMALY_HISTORY_COUNT}
  Temperature anomalies: ${h.TEMP_ANOMALY_COUNT}
  Vibration anomalies: ${h.VIB_ANOMALY_COUNT}
  Pressure anomalies: ${h.PRESS_ANOMALY_COUNT}
  First anomaly: ${h.FIRST_ANOMALY_TS}
  Last anomaly: ${h.LAST_ANOMALY_TS}
  Avg sensor values during anomalies:
    Temperature: ${h.AVG_TEMP_ANOMALY}°C
    Vibration: ${h.AVG_VIB_ANOMALY} mm/s
    Pressure: ${h.AVG_PRESS_ANOMALY} bar
    Health: ${h.AVG_HEALTH_ANOMALY}%
  This machine has experienced ${h.ANOMALY_HISTORY_COUNT} anomaly events in the selected period. Use this history to assess severity and recurrence patterns.`;
    } else {
      historyContext = `

ANOMALY HISTORY (within selected filter: ${filterLabel}):
  No anomaly events recorded in the selected period.`;
    }

    // 3. Build user prompt
    const userPrompt = `SENSOR DATA (from Snowflake GOLD — latest reading within ${filterLabel}):
  Machine: ${s.MACHINE_ID}
  Type: ${s.MACHINE_TYPE}
  Temperature: ${s.TEMPERATURE}°C
  Vibration: ${s.VIBRATION} mm/s
  Pressure: ${s.PRESSURE} bar
  Health: ${s.HEALTH_PCT}% (${s.HEALTH_STATUS})
  IS_ANOMALY (general flag): ${s.IS_ANOMALY}
  IS_TEMPERATURE_ANOMALY: ${s.IS_TEMPERATURE_ANOMALY}
  IS_VIBRATION_ANOMALY: ${s.IS_VIBRATION_ANOMALY}
  IS_PRESSURE_ANOMALY: ${s.IS_PRESSURE_ANOMALY}
  Operational Hours: ${s.OPERATIONAL_TIME}
${historyContext}

TROUBLESHOOTING KNOWLEDGE BASE (from Smelter Asset Health Troubleshooting Guide):
${knowledge}

TASK:
${s.IS_ANOMALY === true
  ? 'IS_ANOMALY=TRUE — anomaly detected. Use the ANOMALY OUTPUT FORMAT. Diagnose based on the specific anomaly flags, compare sensor values against the guide ranges, and use the anomaly history for severity assessment.'
  : s.HEALTH_PCT < 80 || (h?.ANOMALY_HISTORY_COUNT ?? 0) > 0
    ? `IS_ANOMALY is not TRUE, but health is ${s.HEALTH_PCT}% (${s.HEALTH_STATUS}) and the period recorded ${h?.ANOMALY_HISTORY_COUNT ?? 0} anomaly events. This is case B — use the DEGRADED OUTPUT FORMAT. Compare every sensor value against the guide ranges, identify which are out of range, diagnose the degradation, and give concrete corrective actions. Do NOT say "no action required".`
    : 'IS_ANOMALY is not TRUE, health is at or above 80%, and there is no anomaly history. Verify every sensor against the guide ranges first. If all are within range use the HEALTHY OUTPUT FORMAT; if any sensor is out of range use the DEGRADED OUTPUT FORMAT instead.'}
Follow the chosen output format exactly.`;

    // 4. Call DeepSeek via Hugging Face
    const aiResponse = await callDeepSeek(SYSTEM_PROMPT, userPrompt, 3000);

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
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

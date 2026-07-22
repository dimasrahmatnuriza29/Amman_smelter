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

interface KpiRow {
  AVG_HEALTH: number;
  HEALTHY_COUNT: number;
  WARNING_COUNT: number;
  CRITICAL_COUNT: number;
  TOTAL_MACHINES: number;
}

interface AnomalyCountRow {
  CNT: number;
}

interface MachineOverviewRow {
  MACHINE_ID: string;
  MACHINE_TYPE: string;
  HEALTH_PCT: number;
  HEALTH_STATUS: string;
  TEMPERATURE: number;
  VIBRATION: number;
  PRESSURE: number;
  IS_ANOMALY: boolean;
  IS_TEMPERATURE_ANOMALY: boolean;
  IS_VIBRATION_ANOMALY: boolean;
  IS_PRESSURE_ANOMALY: boolean;
  ANOMALY_HISTORY_COUNT: number;
}

const SYSTEM_PROMPT = `You are a Smelter Maintenance Copilot — a professional machine engineer AI assistant for a gold smelter facility.

You are a conversational AI assistant (like ChatGPT/Gemini) specialized in smelter maintenance. You can:
- Summarize and analyze overall smelter conditions from dashboard data
- Diagnose specific machine issues using real sensor data from Snowflake
- Recommend repairs, maintenance schedules, and spare parts
- Consult on best practices for furnace, conveyor, motor, and slurry pump maintenance
- Answer general engineering questions about smelter operations
- Compare machine conditions and prioritize maintenance actions
- Provide troubleshooting guidance based on the knowledge base

DATA SOURCES (always available in context):
1. DASHBOARD SUMMARY — KPI overview + all machine statuses within the selected time filter
2. SENSOR DATA — latest reading + anomaly history for the selected machine (if any machine is selected)
3. TROUBLESHOOTING KNOWLEDGE BASE — maintenance guide with normal ranges, symptom tables, and decision workflows
4. Your own professional machine engineering expertise

ANOMALY DETECTION LOGIC (when discussing anomalies):
- Always check IS_ANOMALY flag first. If NOT TRUE → no anomaly in the selected period. Do NOT fabricate anomalies.
- If IS_ANOMALY=TRUE, diagnose based on specific flags:
  - IS_TEMPERATURE_ANOMALY=TRUE → temperature exceeds statistical bounds
  - IS_VIBRATION_ANOMALY=TRUE → vibration exceeds statistical bounds
  - IS_PRESSURE_ANOMALY=TRUE → pressure exceeds statistical bounds
- IS_ANOMALY is only a general trigger — do NOT use it for root cause analysis.
- ANOMALY_SCORE is a holistic Isolation Forest score — do NOT use it for diagnosis.
- If no specific flag is TRUE but IS_ANOMALY=TRUE, state the anomaly source cannot be determined.

GUARDRAILS:
1. Use dashboard data and sensor data when available. If data is not available, say "data tidak tersedia".
2. Do NOT hallucinate sensor values or anomaly readings that are not in the provided data.
3. For general engineering questions (e.g. "apa itu bearing wear?"), use your expertise freely — no data needed.
4. For normal operating ranges, use the troubleshooting guide values.
5. Match the user's language (Indonesian or English).
6. Be conversational, professional, and technically precise. Use bullet points when appropriate.
7. When recommending actions, format as markdown bullet lists (- ) with priority levels. Do NOT use checkbox symbols like □.
8. Cite which data source or knowledge section your answer is based on when relevant.
9. Use markdown formatting for nice readability: **bold** for emphasis, ## headers for sections, - bullet lists, numbered lists for steps, | tables | for comparisons, > blockquotes for notes.
10. You can include charts by outputting a fenced code block with language "chart" containing JSON in this format:
    \`\`\`chart
    {"type":"bar","title":"Machine Health","data":[{"name":"Furnace_01","health":52.6},{"name":"Motor_02","health":68.3}],"xKey":"name","yKey":"health","color":"#6366f1"}
    \`\`\`
    Supported types: "bar", "line", "pie". ONLY include charts when:
    - User explicitly asks for a chart/visualization
    - User asks to compare machines or summarize overall conditions
    - User asks for trends or distributions
    Do NOT include charts for simple Q&A, definitions, or single-machine diagnosis. Max 1-2 charts per response.`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      message,
      machineId,
      month,
      year,
      history = [],
    } = body as {
      message: string;
      machineId?: string | null;
      month?: number;
      year?: number;
      history?: ChatMessage[];
    };

    if (!message) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    // 1. Get sensor data if machineId is provided
    let sensorContext = "";
    let knowledge = "";

    // Always build dashboard summary context
    let dashboardSummary = "";
    {
      let kpiDateFilter = "";
      let kpiBinds: (string | number)[] = [];
      let anomFilter = "";
      let anomBinds: (string | number)[] = [];
      let anomAliasFilter = "";

      if (month) {
        kpiDateFilter += " AND MONTH(TIMESTAMP) = ?";
        kpiBinds.push(month);
        anomFilter += " AND MONTH(TO_TIMESTAMP(TIMESTAMP / 1000000000)) = ?";
        anomBinds.push(month);
        anomAliasFilter += " AND MONTH(TO_TIMESTAMP(a.TIMESTAMP / 1000000000)) = ?";
      }
      if (year) {
        kpiDateFilter += " AND YEAR(TIMESTAMP) = ?";
        kpiBinds.push(year);
        anomFilter += " AND YEAR(TO_TIMESTAMP(TIMESTAMP / 1000000000)) = ?";
        anomBinds.push(year);
        anomAliasFilter += " AND YEAR(TO_TIMESTAMP(a.TIMESTAMP / 1000000000)) = ?";
      }

      const filterLabel = month && year
        ? `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month-1]} ${year}`
        : year ? `Year ${year}` : 'All time';

      // KPI summary
      const kpiData = await querySnowflake<KpiRow>(`
        WITH latest AS (
          SELECT MACHINE_ID, MACHINE_TYPE, HEALTH_PCT, HEALTH_STATUS,
            ROW_NUMBER() OVER (PARTITION BY MACHINE_ID ORDER BY TIMESTAMP DESC) AS rn
          FROM POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA
          WHERE 1=1 ${kpiDateFilter}
        )
        SELECT
          ROUND(AVG(HEALTH_PCT), 1) AS AVG_HEALTH,
          COUNT_IF(HEALTH_STATUS = 'HEALTHY') AS HEALTHY_COUNT,
          COUNT_IF(HEALTH_STATUS = 'WARNING') AS WARNING_COUNT,
          COUNT_IF(HEALTH_STATUS = 'CRITICAL') AS CRITICAL_COUNT,
          COUNT(*) AS TOTAL_MACHINES
        FROM latest WHERE rn = 1
      `, kpiBinds);

      const anomalyCount = await querySnowflake<AnomalyCountRow>(`
        SELECT COUNT(*) AS CNT
        FROM POC_AMMAN.GOLD.FACT_ANOMALY_DETECTION
        WHERE IS_ANOMALY = TRUE ${anomFilter}
      `, anomBinds);

      // Machine overview (all machines)
      const machineBinds: (string | number)[] = [];
      let machineFilter = "";
      if (month) {
        machineFilter += " AND MONTH(s.TIMESTAMP) = ?";
        machineBinds.push(month);
      }
      if (year) {
        machineFilter += " AND YEAR(s.TIMESTAMP) = ?";
        machineBinds.push(year);
      }

      const machines = await querySnowflake<MachineOverviewRow>(`
        WITH latest AS (
          SELECT s.MACHINE_ID, s.MACHINE_TYPE, s.HEALTH_PCT, s.HEALTH_STATUS,
            s.TEMPERATURE, s.VIBRATION, s.PRESSURE,
            ROW_NUMBER() OVER (PARTITION BY s.MACHINE_ID ORDER BY s.TIMESTAMP DESC) AS rn
          FROM POC_AMMAN.GOLD.FACT_SMELTER_SENSOR_DATA s
          WHERE 1=1 ${machineFilter}
        ),
        anomaly_latest AS (
          SELECT MACHINE_ID, IS_ANOMALY,
            IS_TEMPERATURE_ANOMALY, IS_VIBRATION_ANOMALY, IS_PRESSURE_ANOMALY,
            ROW_NUMBER() OVER (PARTITION BY MACHINE_ID ORDER BY TIMESTAMP DESC) AS rn
          FROM POC_AMMAN.GOLD.FACT_ANOMALY_DETECTION a
          WHERE 1=1 ${anomAliasFilter}
        ),
        anomaly_counts AS (
          SELECT a.MACHINE_ID, COUNT_IF(a.IS_ANOMALY = TRUE) AS ANOMALY_HISTORY_COUNT
          FROM POC_AMMAN.GOLD.FACT_ANOMALY_DETECTION a
          WHERE a.IS_ANOMALY = TRUE ${anomAliasFilter}
          GROUP BY a.MACHINE_ID
        )
        SELECT
          l.MACHINE_ID, l.MACHINE_TYPE,
          ROUND(l.HEALTH_PCT, 1) AS HEALTH_PCT,
          l.HEALTH_STATUS,
          ROUND(l.TEMPERATURE, 2) AS TEMPERATURE,
          ROUND(l.VIBRATION, 4) AS VIBRATION,
          ROUND(l.PRESSURE, 4) AS PRESSURE,
          COALESCE(al.IS_ANOMALY, FALSE) AS IS_ANOMALY,
          COALESCE(al.IS_TEMPERATURE_ANOMALY, FALSE) AS IS_TEMPERATURE_ANOMALY,
          COALESCE(al.IS_VIBRATION_ANOMALY, FALSE) AS IS_VIBRATION_ANOMALY,
          COALESCE(al.IS_PRESSURE_ANOMALY, FALSE) AS IS_PRESSURE_ANOMALY,
          COALESCE(ac.ANOMALY_HISTORY_COUNT, 0) AS ANOMALY_HISTORY_COUNT
        FROM latest l
        LEFT JOIN anomaly_latest al ON al.MACHINE_ID = l.MACHINE_ID AND al.rn = 1
        LEFT JOIN anomaly_counts ac ON ac.MACHINE_ID = l.MACHINE_ID
        WHERE l.rn = 1
        ORDER BY l.HEALTH_PCT ASC
      `, [...machineBinds, ...anomBinds, ...anomBinds]);

      const k = kpiData[0];
      const anomTotal = anomalyCount[0]?.CNT ?? 0;

      const machineLines = machines.map(m =>
        `  ${m.MACHINE_ID} (${m.MACHINE_TYPE}): Health=${m.HEALTH_PCT}% (${m.HEALTH_STATUS}), Temp=${m.TEMPERATURE}°C, Vib=${m.VIBRATION}, Press=${m.PRESSURE}, Anomaly=${m.IS_ANOMALY}, AnomalyEvents=${m.ANOMALY_HISTORY_COUNT}`
      ).join('\n');

      dashboardSummary = `DASHBOARD SUMMARY (within selected filter: ${filterLabel}):
  Total Machines: ${k?.TOTAL_MACHINES ?? 0}
  Average Health: ${k?.AVG_HEALTH ?? 0}%
  Healthy: ${k?.HEALTHY_COUNT ?? 0} | Warning: ${k?.WARNING_COUNT ?? 0} | Critical: ${k?.CRITICAL_COUNT ?? 0}
  Total Anomaly Events: ${anomTotal}

MACHINE OVERVIEW (sorted by health, lowest first):
${machineLines}`;
    }

    if (machineId) {
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

      const sensorData = await querySnowflake<SensorRow>(`
        WITH latest AS (
          SELECT
            s.MACHINE_ID, s.MACHINE_TYPE, s.TEMPERATURE, s.VIBRATION,
            s.PRESSURE, s.HEALTH_PCT, s.HEALTH_STATUS, s.OPERATIONAL_TIME,
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
          l.MACHINE_ID, l.MACHINE_TYPE,
          ROUND(l.TEMPERATURE, 2) AS TEMPERATURE,
          ROUND(l.VIBRATION, 4) AS VIBRATION,
          ROUND(l.PRESSURE, 4) AS PRESSURE,
          ROUND(l.HEALTH_PCT, 1) AS HEALTH_PCT,
          l.HEALTH_STATUS, l.OPERATIONAL_TIME,
          ROUND(a.ANOMALY_SCORE, 4) AS ANOMALY_SCORE,
          a.IS_ANOMALY,
          a.IS_TEMPERATURE_ANOMALY,
          a.IS_VIBRATION_ANOMALY,
          a.IS_PRESSURE_ANOMALY
        FROM latest l
        LEFT JOIN anomaly_latest a ON a.rn = 1
        WHERE l.rn = 1
      `, [...sensorBinds, ...anomBinds]);

      // Get anomaly history stats within filter period
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

      if (sensorData.length > 0) {
        const s = sensorData[0];
        const h = historyData[0];
        const filterLabel = month && year
          ? `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month-1]} ${year}`
          : year ? `Year ${year}` : 'All time';

        let historyContext = '';
        if (h && h.ANOMALY_HISTORY_COUNT > 0) {
          historyContext = `\n\nANOMALY HISTORY (within selected filter: ${filterLabel}):
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
    Health: ${h.AVG_HEALTH_ANOMALY}%`;
        } else {
          historyContext = `\n\nANOMALY HISTORY (within selected filter: ${filterLabel}):
  No anomaly events recorded in the selected period.`;
        }

        sensorContext = `CURRENT SENSOR DATA (from Snowflake GOLD — latest reading within ${filterLabel}):
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
  Operational Hours: ${s.OPERATIONAL_TIME}${historyContext}`;

        knowledge = getKnowledgeByMachineType(s.MACHINE_TYPE);
      } else {
        sensorContext = `Machine ${machineId} not found in GOLD data.`;
      }
    }

    // Build combined context
    const contextParts = [dashboardSummary];
    if (sensorContext) contextParts.push(sensorContext);
    const fullContext = contextParts.join('\n\n');

    // 2. Build user prompt
    const userPrompt = `${fullContext}

${knowledge ? `TROUBLESHOOTING KNOWLEDGE BASE:\n${knowledge}` : ""}

USER QUESTION: ${message}

Answer based on the data and knowledge above. If the user asks for a dashboard summary or overall status, use the DASHBOARD SUMMARY section. If information is not available, state "data tidak tersedia". Be concise and technically precise.`;

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

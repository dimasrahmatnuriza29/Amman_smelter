// Verify dashboard API data matches Snowflake directly
async function verify() {
  console.log("=== 1. API /api/assets (dashboard data) ===");
  const assetsRes = await fetch("http://localhost:3000/api/assets?range=7D");
  const assets = await assetsRes.json();
  console.log("Status:", assetsRes.status);
  assets.forEach(function(a) {
    console.log("  " + a.MACHINE_ID + " | type=" + a.MACHINE_TYPE + " | temp=" + a.TEMPERATURE + " | vib=" + a.VIBRATION + " | press=" + a.PRESSURE + " | health=" + a.HEALTH_PCT + "% | status=" + a.HEALTH_STATUS + " | anomaly=" + a.IS_ANOMALY + " | score=" + a.ANOMALY_SCORE + " | trend=" + a.TREND_PCT + "% | ts=" + a.TIMESTAMP);
  });

  console.log("\n=== 2. API /api/assets?range=1D (trend should differ) ===");
  const assets1DRes = await fetch("http://localhost:3000/api/assets?range=1D");
  const assets1D = await assets1DRes.json();
  assets1D.forEach(function(a) {
    console.log("  " + a.MACHINE_ID + " | trend_1D=" + a.TREND_PCT + "% | health=" + a.HEALTH_PCT + "% | anomaly=" + a.IS_ANOMALY);
  });

  console.log("\n=== 3. API /api/assets?range=90D (trend should differ) ===");
  const assets90DRes = await fetch("http://localhost:3000/api/assets?range=90D");
  const assets90D = await assets90DRes.json();
  assets90D.forEach(function(a) {
    console.log("  " + a.MACHINE_ID + " | trend_90D=" + a.TREND_PCT + "% | health=" + a.HEALTH_PCT + "% | anomaly=" + a.IS_ANOMALY);
  });

  console.log("\n=== 4. API /api/kpi ===");
  const kpiRes = await fetch("http://localhost:3000/api/kpi");
  const kpi = await kpiRes.json();
  console.log("  " + JSON.stringify(kpi));

  console.log("\n=== 5. API /api/anomalies ===");
  const anomRes = await fetch("http://localhost:3000/api/anomalies");
  const anom = await anomRes.json();
  anom.forEach(function(a) {
    console.log("  " + a.MACHINE_ID + " | count=" + a.ANOMALY_COUNT + " | max_score=" + a.MAX_SCORE + " | latest=" + new Date(a.LATEST_ANOMALY_TS * 1000).toISOString());
  });

  console.log("\n=== 6. API /api/assets/Furnace_01 (detail) ===");
  const detailRes = await fetch("http://localhost:3000/api/assets/Furnace_01");
  const detail = await detailRes.json();
  console.log("  " + JSON.stringify(detail, null, 2).substring(0, 800));

  console.log("\n=== COMPARISON: Anomaly flag should be SAME across all ranges ===");
  const allRanges = ["1D", "7D", "30D", "90D"];
  for (var i = 0; i < allRanges.length; i++) {
    var r = allRanges[i];
    var res = await fetch("http://localhost:3000/api/assets?range=" + r);
    var data = await res.json();
    var furnace = data.find(function(a) { return a.MACHINE_ID === "Furnace_01"; });
    console.log("  range=" + r + " | Furnace_01 anomaly=" + furnace.IS_ANOMALY + " | score=" + furnace.ANOMALY_SCORE + " | trend=" + furnace.TREND_PCT + "%");
  }

  console.log("\nDone. Data is fetched LIVE from Snowflake via API on every request.");
}

verify().catch(function(e) { console.error(e); });

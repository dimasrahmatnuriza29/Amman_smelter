const body = JSON.stringify({ machineId: "Furnace_01" });

fetch("http://localhost:3000/api/copilot/recommend", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body,
})
  .then(async (r) => {
    const text = await r.text();
    console.log("Status:", r.status);
    console.log("Body:", text);
  })
  .catch((e) => console.error("Error:", e.message));

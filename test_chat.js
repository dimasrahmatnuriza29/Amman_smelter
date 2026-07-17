const body = JSON.stringify({
  message: "Kenapa Furnace_01 health turun?",
  machineId: "Furnace_01",
});

fetch("http://localhost:3000/api/copilot/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body,
})
  .then(async (r) => {
    const text = await r.text();
    console.log("Status:", r.status);
    console.log("Body:", text.substring(0, 1000));
  })
  .catch((e) => console.error("Error:", e.message));

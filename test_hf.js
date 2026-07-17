// Test HF API connectivity
const API_KEY = process.env.HF_API_KEY || "YOUR_HF_API_KEY";

async function testModels() {
  console.log("=== Testing HF Router /v1/models ===");
  try {
    const r = await fetch("https://router.huggingface.co/v1/models", {
      headers: { Authorization: `Bearer ${API_KEY}` },
      signal: AbortSignal.timeout(15000),
    });
    console.log("Status:", r.status);
    if (r.ok) {
      const data = await r.json();
      const models = (data.data || []).map(function(m) { return m.id }).slice(0, 20);
      console.log("Available models (first 20):");
      models.forEach(function(m) { console.log("  -", m); });
    } else {
      const text = await r.text();
      console.log("Error body:", text.substring(0, 300));
    }
  } catch (e) {
    console.log("Fetch error:", e.message);
  }
}

async function testChat() {
  console.log("\n=== Testing Chat Completion (Qwen2.5-7B) ===");
  try {
    const r = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "Qwen/Qwen2.5-7B-Instruct",
        messages: [{ role: "user", content: "Say hello in 5 words" }],
        max_tokens: 50,
      }),
      signal: AbortSignal.timeout(30000),
    });
    console.log("Status:", r.status);
    if (r.ok) {
      const data = await r.json();
      console.log("Response:", data.choices?.[0]?.message?.content);
    } else {
      const text = await r.text();
      console.log("Error body:", text.substring(0, 500));
    }
  } catch (e) {
    console.log("Fetch error:", e.message);
  }
}

async function testDeepSeek() {
  console.log("\n=== Testing Chat Completion (DeepSeek-V3) ===");
  try {
    const r = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-ai/DeepSeek-V3",
        messages: [{ role: "user", content: "Say hello in 5 words" }],
        max_tokens: 50,
      }),
      signal: AbortSignal.timeout(30000),
    });
    console.log("Status:", r.status);
    if (r.ok) {
      const data = await r.json();
      console.log("Response:", data.choices?.[0]?.message?.content);
    } else {
      const text = await r.text();
      console.log("Error body:", text.substring(0, 500));
    }
  } catch (e) {
    console.log("Fetch error:", e.message);
  }
}

(async () => {
  await testModels();
  await testChat();
  await testDeepSeek();
})();

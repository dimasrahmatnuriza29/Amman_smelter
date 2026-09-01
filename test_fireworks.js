// Test Fireworks AI API connectivity
const API_KEY = process.env.FIREWORKS_API_KEY || "YOUR_FIREWORKS_API_KEY";
const API_URL = "https://api.fireworks.ai/inference/v1/chat/completions";
const MODEL = "accounts/fireworks/models/deepseek-v4-flash-0731";

async function testChat() {
  console.log("=== Testing Fireworks Chat Completion (DeepSeek V4 Flash) ===");
  try {
    const r = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: "Hello, how are you?" }],
        max_tokens: 100,
        top_k: 40,
        presence_penalty: 0,
        frequency_penalty: 0,
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

testChat();

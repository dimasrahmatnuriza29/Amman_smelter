interface HFChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface HFResponse {
  choices?: Array<{ message: { content: string } }>;
  error?: string;
  generated_text?: string;
}

const HF_API_URL =
  "https://router.huggingface.co/v1/chat/completions";

export async function callDeepSeek(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 1024
): Promise<string> {
  const apiKey = process.env.HF_API_KEY;

  if (!apiKey) {
    throw new Error("HF_API_KEY not configured in environment");
  }

  const messages: HFChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const body = JSON.stringify({
    model: "deepseek-ai/DeepSeek-V4-Flash",
    messages,
    max_tokens: maxTokens,
    temperature: 0.3,
    top_p: 0.9,
  });

  const MAX_RETRIES = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(HF_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body,
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        const errText = await response.text();
        if (response.status >= 500 && attempt < MAX_RETRIES) {
          lastError = new Error(`HF API ${response.status}: server error, retrying...`);
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        throw new Error(`HF API error ${response.status}: ${errText.substring(0, 200)}`);
      }

      const data: HFResponse = await response.json();

      if (data.error) {
        throw new Error(`HF API: ${data.error}`);
      }

      if (data.choices && data.choices[0]?.message?.content) {
        return data.choices[0].message.content;
      }

      if (data.generated_text) {
        return data.generated_text;
      }

      throw new Error("HF API: unexpected response format");
    } catch (e) {
      lastError = e as Error;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
    }
  }

  throw lastError ?? new Error("HF API: request failed after retries");
}

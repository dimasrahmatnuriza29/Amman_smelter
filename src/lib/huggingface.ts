interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionResponse {
  choices?: Array<{ message: { content: string } }>;
  error?: string;
}

const OPENROUTER_API_URL =
  "https://openrouter.ai/api/v1/chat/completions";

const OPENROUTER_MODEL = "deepseek/deepseek-v3.2";

export async function callDeepSeek(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 1024
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not configured in environment");
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const body = JSON.stringify({
    model: OPENROUTER_MODEL,
    messages,
    max_tokens: maxTokens,
    temperature: 0.3,
    top_p: 0.9,
    presence_penalty: 0,
    frequency_penalty: 0,
  });

  const MAX_RETRIES = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "Smelter Asset Health Copilot",
        },
        body,
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        const errText = await response.text();
        if (response.status >= 500 && attempt < MAX_RETRIES) {
          lastError = new Error(`OpenRouter API ${response.status}: server error, retrying...`);
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        throw new Error(`OpenRouter API error ${response.status}: ${errText.substring(0, 200)}`);
      }

      const data: ChatCompletionResponse = await response.json();

      if (data.error) {
        throw new Error(`OpenRouter API: ${data.error}`);
      }

      if (data.choices && data.choices[0]?.message?.content) {
        return data.choices[0].message.content;
      }

      throw new Error("OpenRouter API: unexpected response format");
    } catch (e) {
      lastError = e as Error;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
    }
  }

  throw lastError ?? new Error("OpenRouter API: request failed after retries");
}

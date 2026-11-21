/** AI providers: Anthropic (Claude) and OpenAI behind one interface, with a deterministic mock for tests/dev. */
import { env, isConfigured } from "../env";
import { callJson, recordMock } from "./http";

export type AiProvider = "anthropic" | "openai" | "mock";
export interface AiRequest {
  system?: string;
  prompt: string;
  maxTokens?: number;
  provider?: AiProvider | "auto";
  json?: boolean;
}
export interface AiResult {
  text: string;
  provider: AiProvider;
  inputTokens: number;
  outputTokens: number;
}

export function availableProviders(): AiProvider[] {
  const p: AiProvider[] = [];
  if (isConfigured.anthropic()) p.push("anthropic");
  if (isConfigured.openai()) p.push("openai");
  return p.length ? p : ["mock"];
}

export async function complete(r: AiRequest): Promise<AiResult> {
  const provider =
    r.provider && r.provider !== "auto" && availableProviders().includes(r.provider)
      ? r.provider
      : availableProviders()[0];
  if (provider === "anthropic") {
    const res = await callJson<{
      content: { type: string; text: string }[];
      usage: { input_tokens: number; output_tokens: number };
    }>("https://api.anthropic.com/v1/messages", {
      method: "POST",
      timeoutMs: 120_000,
      headers: {
        "x-api-key": env.anthropic.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: env.anthropic.model,
        max_tokens: r.maxTokens ?? 1500,
        system: r.system,
        messages: [{ role: "user", content: r.prompt }],
      }),
    });
    return {
      text: res.content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join(""),
      provider,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
    };
  }
  if (provider === "openai") {
    const res = await callJson<{
      choices: { message: { content: string } }[];
      usage: { prompt_tokens: number; completion_tokens: number };
    }>("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      timeoutMs: 120_000,
      headers: { Authorization: `Bearer ${env.openai.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.openai.model,
        max_tokens: r.maxTokens ?? 1500,
        messages: [
          ...(r.system ? [{ role: "system", content: r.system }] : []),
          { role: "user", content: r.prompt },
        ],
        ...(r.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    return {
      text: res.choices[0].message.content,
      provider,
      inputTokens: res.usage.prompt_tokens,
      outputTokens: res.usage.completion_tokens,
    };
  }
  recordMock("ai", "complete", { prompt: r.prompt.slice(0, 200) });
  const topic = r.prompt.split("\n")[0].slice(0, 80);
  const text = r.json
    ? JSON.stringify({ title: `Draft: ${topic}`, items: ["Point one", "Point two", "Point three"] })
    : `[Mock AI draft] ${topic}\n\nThis is placeholder text generated without an AI key. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to generate real content.`;
  return {
    text,
    provider: "mock",
    inputTokens: Math.ceil(r.prompt.length / 4),
    outputTokens: Math.ceil(text.length / 4),
  };
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (isConfigured.openai()) {
    const r = await callJson<{ data: { embedding: number[] }[] }>(
      "https://api.openai.com/v1/embeddings",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.openai.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: env.openai.embeddingModel, input: texts }),
      },
    );
    return r.data.map((d) => d.embedding);
  }
  // Mock: bag-of-words hashing into 64 dims — good enough for local relevance ranking in development.
  return texts.map((t) => {
    const v = new Array(64).fill(0);
    for (const w of t
      .toLowerCase()
      .split(/\W+/)
      .filter((x) => x.length > 2)) {
      let h = 0;
      for (const c of w) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      v[h % 64] += 1;
    }
    const n = Math.hypot(...v) || 1;
    return v.map((x) => x / n);
  });
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    na += a[i] ** 2;
    nb += b[i] ** 2;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

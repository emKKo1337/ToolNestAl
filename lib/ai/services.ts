import {
  generateText as aiGenerateText,
  streamText as aiStreamText,
} from "ai";
import { GoogleGenAI } from "@google/genai";
import type { Content, Part } from "@google/genai";
import { getAIModel } from "./client";
import { getModelForTask, AI_CONFIG } from "./config";
import { normalizeError, AIErrors } from "./errors";
import {
  SYSTEM_PROMPTS,
  buildTranslatePrompt,
  buildSummarizePrompt,
  buildEmailPrompt,
  buildResumePrompt,
  buildParaphrasePrompt,
  buildChatMessages,
} from "./prompts";
import type {
  AIModelId,
  AIResponse,
  AIRequestOptions,
  TranslatePayload,
  SummarizePayload,
  GenerateEmailPayload,
  GenerateResumePayload,
  ParaphrasePayload,
  ChatPayload,
} from "@/types/ai";

// ── Routing helpers ───────────────────────────────────────────────────────────
// Gemini direct-API model IDs never contain "/".
// OpenRouter model IDs always contain "/" (e.g. "deepseek/deepseek-chat").

function isGeminiModel(modelId: string): boolean {
  return !modelId.includes("/") || modelId.startsWith("models/");
}

function resolveModel(task: string, opts?: AIRequestOptions): AIModelId {
  return opts?.model ?? getModelForTask(task);
}

function commonParams(opts?: AIRequestOptions) {
  return {
    temperature: opts?.temperature ?? 0.7,
    maxOutputTokens: opts?.maxTokens ?? 1024,
  };
}

// ── Gemini client ─────────────────────────────────────────────────────────────

function getGeminiClient(): GoogleGenAI {
  const key = AI_CONFIG.geminiApiKey;
  if (!key) throw AIErrors.missingApiKey();
  return new GoogleGenAI({ apiKey: key });
}

// ── Gemini: single-turn text ──────────────────────────────────────────────────

async function geminiGenerateText(
  prompt: string,
  systemPrompt: string,
  modelId: string,
  opts?: AIRequestOptions
): Promise<AIResponse> {
  const client = getGeminiClient();
  const response = await client.models.generateContent({
    model: modelId,
    contents: prompt,
    config: {
      systemInstruction: systemPrompt,
      ...commonParams(opts),
    },
  });
  const usage = response.usageMetadata;
  return {
    text: response.text ?? "",
    model: modelId,
    usage: usage
      ? {
          inputTokens: usage.promptTokenCount ?? 0,
          outputTokens: usage.candidatesTokenCount ?? 0,
          totalTokens: usage.totalTokenCount ?? 0,
        }
      : undefined,
  };
}

function geminiStreamText(
  prompt: string,
  systemPrompt: string,
  modelId: string,
  opts?: AIRequestOptions
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const client = getGeminiClient();
        const result = await client.models.generateContentStream({
          model: modelId,
          contents: prompt,
          config: {
            systemInstruction: systemPrompt,
            ...commonParams(opts),
          },
        });
        for await (const chunk of result) {
          const text = chunk.text;
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      } catch (err) {
        controller.error(normalizeError(err));
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

// ── Gemini: multi-turn chat ───────────────────────────────────────────────────

function toGeminiContents(
  messages: Array<{ role: string; content: string }>
): Content[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content } as Part],
    }));
}

async function geminiChat(
  payload: ChatPayload,
  modelId: string,
  opts?: AIRequestOptions
): Promise<AIResponse> {
  const client = getGeminiClient();
  const { system, messages } = buildChatMessages(
    payload.messages,
    payload.systemPrompt
  );
  const response = await client.models.generateContent({
    model: modelId,
    contents: toGeminiContents(messages),
    config: {
      systemInstruction: system,
      temperature: opts?.temperature ?? 0.7,
      maxOutputTokens: opts?.maxTokens ?? 2048,
    },
  });
  const usage = response.usageMetadata;
  return {
    text: response.text ?? "",
    model: modelId,
    usage: usage
      ? {
          inputTokens: usage.promptTokenCount ?? 0,
          outputTokens: usage.candidatesTokenCount ?? 0,
          totalTokens: usage.totalTokenCount ?? 0,
        }
      : undefined,
  };
}

function geminiChatStream(
  payload: ChatPayload,
  modelId: string,
  opts?: AIRequestOptions
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const client = getGeminiClient();
        const { system, messages } = buildChatMessages(
          payload.messages,
          payload.systemPrompt
        );
        const result = await client.models.generateContentStream({
          model: modelId,
          contents: toGeminiContents(messages),
          config: {
            systemInstruction: system,
            temperature: opts?.temperature ?? 0.7,
            maxOutputTokens: opts?.maxTokens ?? 2048,
          },
        });
        for await (const chunk of result) {
          const text = chunk.text;
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      } catch (err) {
        controller.error(normalizeError(err));
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

// ── generateText (public) ─────────────────────────────────────────────────────

export async function generateText(
  prompt: string,
  systemPrompt: string,
  task: string,
  opts?: AIRequestOptions
): Promise<AIResponse> {
  const model = resolveModel(task, opts);
  if (isGeminiModel(model)) {
    try {
      return await geminiGenerateText(prompt, systemPrompt, model, opts);
    } catch (err) {
      throw normalizeError(err);
    }
  }
  // OpenRouter / Vercel AI SDK path
  try {
    const result = await aiGenerateText({
      model: getAIModel(model),
      system: opts?.systemPrompt ?? systemPrompt,
      prompt,
      ...commonParams(opts),
    });
    return {
      text: result.text,
      model,
      usage: result.usage
        ? {
            inputTokens: result.usage.inputTokens ?? 0,
            outputTokens: result.usage.outputTokens ?? 0,
            totalTokens:
              (result.usage.inputTokens ?? 0) +
              (result.usage.outputTokens ?? 0),
          }
        : undefined,
    };
  } catch (err) {
    throw normalizeError(err);
  }
}

// ── streamText (public) ───────────────────────────────────────────────────────

export function streamText(
  prompt: string,
  systemPrompt: string,
  task: string,
  opts?: AIRequestOptions
): Response {
  const model = resolveModel(task, opts);
  if (isGeminiModel(model)) {
    return geminiStreamText(prompt, systemPrompt, model, opts);
  }
  // OpenRouter / Vercel AI SDK path
  try {
    const result = aiStreamText({
      model: getAIModel(model),
      system: opts?.systemPrompt ?? systemPrompt,
      prompt,
      ...commonParams(opts),
    });
    return result.toTextStreamResponse();
  } catch (err) {
    throw normalizeError(err);
  }
}

// ── translate ─────────────────────────────────────────────────────────────────

export async function translate(
  payload: TranslatePayload,
  opts?: AIRequestOptions
): Promise<AIResponse> {
  return generateText(
    buildTranslatePrompt(payload),
    SYSTEM_PROMPTS.translate,
    "translate",
    { maxTokens: 2048, ...opts }
  );
}

export function translateStream(
  payload: TranslatePayload,
  opts?: AIRequestOptions
): Response {
  return streamText(
    buildTranslatePrompt(payload),
    SYSTEM_PROMPTS.translate,
    "translate",
    { maxTokens: 2048, ...opts }
  );
}

// ── summarize ─────────────────────────────────────────────────────────────────

export async function summarize(
  payload: SummarizePayload,
  opts?: AIRequestOptions
): Promise<AIResponse> {
  return generateText(
    buildSummarizePrompt(payload),
    SYSTEM_PROMPTS.summarize,
    "summarize",
    { maxTokens: 1024, ...opts }
  );
}

export function summarizeStream(
  payload: SummarizePayload,
  opts?: AIRequestOptions
): Response {
  return streamText(
    buildSummarizePrompt(payload),
    SYSTEM_PROMPTS.summarize,
    "summarize",
    { maxTokens: 1024, ...opts }
  );
}

// ── generateEmail ─────────────────────────────────────────────────────────────

export async function generateEmail(
  payload: GenerateEmailPayload,
  opts?: AIRequestOptions
): Promise<AIResponse> {
  return generateText(
    buildEmailPrompt(payload),
    SYSTEM_PROMPTS.generateEmail,
    "generateEmail",
    { maxTokens: 1024, ...opts }
  );
}

export function generateEmailStream(
  payload: GenerateEmailPayload,
  opts?: AIRequestOptions
): Response {
  return streamText(
    buildEmailPrompt(payload),
    SYSTEM_PROMPTS.generateEmail,
    "generateEmail",
    { maxTokens: 1024, ...opts }
  );
}

// ── generateResume ────────────────────────────────────────────────────────────

export async function generateResume(
  payload: GenerateResumePayload,
  opts?: AIRequestOptions
): Promise<AIResponse> {
  return generateText(
    buildResumePrompt(payload),
    SYSTEM_PROMPTS.generateResume,
    "generateResume",
    { maxTokens: 2048, ...opts }
  );
}

export function generateResumeStream(
  payload: GenerateResumePayload,
  opts?: AIRequestOptions
): Response {
  return streamText(
    buildResumePrompt(payload),
    SYSTEM_PROMPTS.generateResume,
    "generateResume",
    { maxTokens: 2048, ...opts }
  );
}

// ── paraphrase ────────────────────────────────────────────────────────────────

export async function paraphrase(
  payload: ParaphrasePayload,
  opts?: AIRequestOptions
): Promise<AIResponse> {
  return generateText(
    buildParaphrasePrompt(payload),
    SYSTEM_PROMPTS.paraphrase,
    "paraphrase",
    { maxTokens: 2048, ...opts }
  );
}

export function paraphraseStream(
  payload: ParaphrasePayload,
  opts?: AIRequestOptions
): Response {
  return streamText(
    buildParaphrasePrompt(payload),
    SYSTEM_PROMPTS.paraphrase,
    "paraphrase",
    { maxTokens: 2048, ...opts }
  );
}

// ── chat ──────────────────────────────────────────────────────────────────────

export async function chat(
  payload: ChatPayload,
  opts?: AIRequestOptions
): Promise<AIResponse> {
  const model = resolveModel("chat", opts);
  if (isGeminiModel(model)) {
    try {
      return await geminiChat(payload, model, opts);
    } catch (err) {
      throw normalizeError(err);
    }
  }
  // OpenRouter / Vercel AI SDK path
  try {
    const { system, messages } = buildChatMessages(
      payload.messages,
      payload.systemPrompt
    );
    const result = await aiGenerateText({
      model: getAIModel(model),
      system,
      messages,
      temperature: opts?.temperature ?? 0.7,
      maxOutputTokens: opts?.maxTokens ?? 2048,
    });
    return {
      text: result.text,
      model,
      usage: result.usage
        ? {
            inputTokens: result.usage.inputTokens ?? 0,
            outputTokens: result.usage.outputTokens ?? 0,
            totalTokens:
              (result.usage.inputTokens ?? 0) +
              (result.usage.outputTokens ?? 0),
          }
        : undefined,
    };
  } catch (err) {
    throw normalizeError(err);
  }
}

export function chatStream(
  payload: ChatPayload,
  opts?: AIRequestOptions
): Response {
  const model = resolveModel("chat", opts);
  if (isGeminiModel(model)) {
    return geminiChatStream(payload, model, opts);
  }
  // OpenRouter / Vercel AI SDK path
  try {
    const { system, messages } = buildChatMessages(
      payload.messages,
      payload.systemPrompt
    );
    const result = aiStreamText({
      model: getAIModel(model),
      system,
      messages,
      temperature: opts?.temperature ?? 0.7,
      maxOutputTokens: opts?.maxTokens ?? 2048,
    });
    return result.toTextStreamResponse();
  } catch (err) {
    throw normalizeError(err);
  }
}

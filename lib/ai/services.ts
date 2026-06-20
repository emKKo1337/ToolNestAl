import {
  generateText as aiGenerateText,
  streamText as aiStreamText,
} from "ai";
import { getAIModel } from "./client";
import { getModelForTask } from "./config";
import { normalizeError } from "./errors";
import {
  SYSTEM_PROMPTS,
  buildTranslatePrompt,
  buildSummarizePrompt,
  buildEmailPrompt,
  buildResumePrompt,
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
  ChatPayload,
} from "@/types/ai";

// ── Internal helpers ──────────────────────────────────────────────────────────

function resolveModel(task: string, opts?: AIRequestOptions): AIModelId {
  return opts?.model ?? getModelForTask(task);
}

function commonParams(opts?: AIRequestOptions) {
  return {
    temperature: opts?.temperature ?? 0.7,
    maxOutputTokens: opts?.maxTokens ?? 1024,
  };
}

// ── generateText ──────────────────────────────────────────────────────────────
// Generic single-turn text generation. Other services delegate here.

export async function generateText(
  prompt: string,
  systemPrompt: string,
  task: string,
  opts?: AIRequestOptions
): Promise<AIResponse> {
  try {
    const model = resolveModel(task, opts);
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
            totalTokens: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
          }
        : undefined,
    };
  } catch (err) {
    throw normalizeError(err);
  }
}

// ── streamText ────────────────────────────────────────────────────────────────
// Returns a streaming Response ready to send directly from an API route.

export function streamText(
  prompt: string,
  systemPrompt: string,
  task: string,
  opts?: AIRequestOptions
): Response {
  try {
    const model = resolveModel(task, opts);
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

// ── chat ──────────────────────────────────────────────────────────────────────

export async function chat(
  payload: ChatPayload,
  opts?: AIRequestOptions
): Promise<AIResponse> {
  try {
    const model = resolveModel("chat", opts);
    const { system, messages } = buildChatMessages(
      payload.messages,
      payload.systemPrompt
    );
    const result = await aiGenerateText({
      model: getAIModel(model),
      system,
      messages,
      ...commonParams(opts),
    });
    return {
      text: result.text,
      model,
      usage: result.usage
        ? {
            inputTokens: result.usage.inputTokens ?? 0,
            outputTokens: result.usage.outputTokens ?? 0,
            totalTokens: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
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
  try {
    const model = resolveModel("chat", opts);
    const { system, messages } = buildChatMessages(
      payload.messages,
      payload.systemPrompt
    );
    const result = aiStreamText({
      model: getAIModel(model),
      system,
      messages,
      ...commonParams(opts),
    });
    return result.toTextStreamResponse();
  } catch (err) {
    throw normalizeError(err);
  }
}

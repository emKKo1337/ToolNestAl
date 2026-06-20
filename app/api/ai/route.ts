import { AIErrors, errorResponse } from "@/lib/ai/errors";
import { checkRateLimit, getRateLimitKey } from "@/lib/ai/rate-limit";
import {
  chat,
  chatStream,
  generateEmail,
  generateEmailStream,
  generateResume,
  generateResumeStream,
  summarize,
  summarizeStream,
  translate,
  translateStream,
  generateText,
} from "@/lib/ai/services";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";
import type { AIRequest } from "@/types/ai";

export const maxDuration = 60;

export async function POST(req: Request) {
  // ── Rate limiting ──────────────────────────────────────────────────────────
  const rlKey = getRateLimitKey(req);
  const rl = checkRateLimit(rlKey);
  if (!rl.allowed) {
    return AIErrors.rateLimited().toResponse();
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: AIRequest;
  try {
    body = await req.json();
  } catch {
    return AIErrors.invalidRequest("Request body must be valid JSON.").toResponse();
  }

  const { task, prompt, messages, payload = {}, options } = body;

  if (!task) {
    return AIErrors.invalidRequest('Missing required field: "task".').toResponse();
  }

  const stream = options?.stream ?? false;

  // ── Route by task ──────────────────────────────────────────────────────────
  try {
    switch (task) {
      // ── chat ──────────────────────────────────────────────────────────────
      case "chat": {
        if (!messages?.length) {
          return AIErrors.invalidRequest(
            "chat task requires a non-empty messages array."
          ).toResponse();
        }
        const chatPayload = {
          messages,
          systemPrompt: (payload as { systemPrompt?: string }).systemPrompt,
        };
        if (stream) return chatStream(chatPayload, options);
        return Response.json(await chat(chatPayload, options));
      }

      // ── translate ─────────────────────────────────────────────────────────
      case "translate": {
        const { text, targetLanguage, sourceLanguage, style, preserveFormatting } = payload as {
          text?: string;
          targetLanguage?: string;
          sourceLanguage?: string;
          style?: import("@/types/ai").TranslationStyle;
          preserveFormatting?: boolean;
        };
        if (!text?.trim()) {
          return AIErrors.invalidRequest("translate task requires payload.text.").toResponse();
        }
        if (!targetLanguage) {
          return AIErrors.invalidRequest(
            "translate task requires payload.targetLanguage."
          ).toResponse();
        }
        const translatePayload = { text, targetLanguage, sourceLanguage, style, preserveFormatting };
        if (stream) return translateStream(translatePayload, options);
        return Response.json(await translate(translatePayload, options));
      }

      // ── summarize ─────────────────────────────────────────────────────────
      case "summarize": {
        const { text, style, length, language } = payload as {
          text?: string;
          style?: "bullet" | "paragraph" | "executive" | "key-takeaways";
          length?: "short" | "medium" | "long";
          language?: string;
        };
        if (!text?.trim()) {
          return AIErrors.invalidRequest("summarize task requires payload.text.").toResponse();
        }
        const summarizePayload = { text, style, length, language };
        if (stream) return summarizeStream(summarizePayload, options);
        return Response.json(await summarize(summarizePayload, options));
      }

      // ── generateEmail ─────────────────────────────────────────────────────
      case "generateEmail": {
        const emailPayload = payload as {
          purpose?: string;
          recipient?: string;
          tone?: string;
          length?: "short" | "medium" | "long";
          language?: string;
          additionalInstructions?: string;
        };
        if (!emailPayload.purpose?.trim()) {
          return AIErrors.invalidRequest(
            "generateEmail task requires payload.purpose."
          ).toResponse();
        }
        if (stream) return generateEmailStream(emailPayload as Parameters<typeof generateEmailStream>[0], options);
        return Response.json(await generateEmail(emailPayload as Parameters<typeof generateEmail>[0], options));
      }

      // ── generateResume ────────────────────────────────────────────────────
      case "generateResume": {
        const resumePayload = payload as unknown as import("@/types/ai").GenerateResumePayload;
        if (!resumePayload.name?.trim()) {
          return AIErrors.invalidRequest(
            "generateResume task requires payload.name."
          ).toResponse();
        }
        if (stream) return generateResumeStream(resumePayload, options);
        return Response.json(await generateResume(resumePayload, options));
      }

      // ── generateText (generic) ────────────────────────────────────────────
      case "generateText": {
        if (!prompt?.trim()) {
          return AIErrors.invalidRequest(
            "generateText task requires a prompt string."
          ).toResponse();
        }
        const systemPrompt = options?.systemPrompt ?? SYSTEM_PROMPTS.generateText;
        if (stream) {
          const { streamText: streamTextService } = await import("@/lib/ai/services");
          return streamTextService(prompt, systemPrompt, "generateText", options);
        }
        return Response.json(
          await generateText(prompt, systemPrompt, "generateText", options)
        );
      }

      default:
        return AIErrors.invalidRequest(
          `Unknown task type: "${task}". Supported tasks: chat, translate, summarize, generateEmail, generateResume, generateText.`
        ).toResponse();
    }
  } catch (err) {
    return errorResponse(err);
  }
}

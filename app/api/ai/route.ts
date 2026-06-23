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
  paraphrase,
  paraphraseStream,
  grammarCheck,
  grammarCheckStream,
  humanize,
  humanizeStream,
  coverLetter,
  coverLetterStream,
  generatePrompt,
  generatePromptStream,
  generateBusinessNames,
  generateBusinessNamesStream,
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

      // ── grammarCheck ──────────────────────────────────────────────────────
      case "grammarCheck": {
        const { text, explainCorrections } = payload as {
          text?: string;
          explainCorrections?: boolean;
        };
        if (!text?.trim()) {
          return AIErrors.invalidRequest("grammarCheck task requires payload.text.").toResponse();
        }
        const gcPayload = { text, explainCorrections: explainCorrections ?? false };
        if (stream) return grammarCheckStream(gcPayload, options);
        return Response.json(await grammarCheck(gcPayload, options));
      }

      // ── paraphrase ────────────────────────────────────────────────────────
      case "paraphrase": {
        const { text, mode } = payload as {
          text?: string;
          mode?: import("@/types/ai").ParaphraseMode;
        };
        if (!text?.trim()) {
          return AIErrors.invalidRequest("paraphrase task requires payload.text.").toResponse();
        }
        if (!mode) {
          return AIErrors.invalidRequest("paraphrase task requires payload.mode.").toResponse();
        }
        const paraphrasePayload = { text, mode };
        if (stream) return paraphraseStream(paraphrasePayload, options);
        return Response.json(await paraphrase(paraphrasePayload, options));
      }

      // ── humanize ──────────────────────────────────────────────────────────
      case "humanize": {
        const { text, strength } = payload as {
          text?: string;
          strength?: import("@/types/ai").HumanizeStrength;
        };
        if (!text?.trim()) {
          return AIErrors.invalidRequest("humanize task requires payload.text.").toResponse();
        }
        if (!strength) {
          return AIErrors.invalidRequest("humanize task requires payload.strength.").toResponse();
        }
        const humanizePayload = { text, strength };
        if (stream) return humanizeStream(humanizePayload, options);
        return Response.json(await humanize(humanizePayload, options));
      }

      // ── coverLetter ───────────────────────────────────────────────────────
      case "coverLetter": {
        const {
          jobTitle,
          companyName,
          applicantName,
          yearsOfExperience,
          skills,
          tone,
          additionalInfo,
        } = payload as {
          jobTitle?: string;
          companyName?: string;
          applicantName?: string;
          yearsOfExperience?: string;
          skills?: string;
          tone?: import("@/types/ai").CoverLetterTone;
          additionalInfo?: string;
        };
        if (!jobTitle?.trim())
          return AIErrors.invalidRequest("coverLetter task requires payload.jobTitle.").toResponse();
        if (!companyName?.trim())
          return AIErrors.invalidRequest("coverLetter task requires payload.companyName.").toResponse();
        if (!applicantName?.trim())
          return AIErrors.invalidRequest("coverLetter task requires payload.applicantName.").toResponse();
        const coverLetterPayload = {
          jobTitle,
          companyName,
          applicantName,
          yearsOfExperience: yearsOfExperience ?? "Not specified",
          skills: skills ?? "",
          tone: tone ?? "professional" as import("@/types/ai").CoverLetterTone,
          additionalInfo,
        };
        if (stream) return coverLetterStream(coverLetterPayload, options);
        return Response.json(await coverLetter(coverLetterPayload, options));
      }

      // ── generatePrompt ────────────────────────────────────────────────────
      case "generatePrompt": {
        const {
          goal,
          category,
          model: aiModel,
          tone: promptTone,
          length: promptLength,
          existingPrompt,
        } = payload as {
          goal?: string;
          category?: import("@/types/ai").PromptCategory;
          model?: import("@/types/ai").PromptAIModel;
          tone?: import("@/types/ai").PromptTone;
          length?: import("@/types/ai").PromptLength;
          existingPrompt?: string;
        };
        if (!goal?.trim())
          return AIErrors.invalidRequest("generatePrompt task requires payload.goal.").toResponse();
        const generatePromptPayload = {
          goal,
          category: category ?? "writing" as import("@/types/ai").PromptCategory,
          model: aiModel ?? "any" as import("@/types/ai").PromptAIModel,
          tone: promptTone ?? "professional" as import("@/types/ai").PromptTone,
          length: promptLength ?? "medium" as import("@/types/ai").PromptLength,
          existingPrompt,
        };
        if (stream) return generatePromptStream(generatePromptPayload, options);
        return Response.json(await generatePrompt(generatePromptPayload, options));
      }

      // ── generateBusinessNames ─────────────────────────────────────────────
      case "generateBusinessNames": {
        const {
          description,
          industry,
          keywords,
          style: nameStyle,
          length: nameLength,
          count,
        } = payload as {
          description?: string;
          industry?: string;
          keywords?: string;
          style?: import("@/types/ai").BusinessNameStyle;
          length?: import("@/types/ai").BusinessNameLength;
          count?: number;
        };
        if (!description?.trim())
          return AIErrors.invalidRequest("generateBusinessNames task requires payload.description.").toResponse();
        if (!industry?.trim())
          return AIErrors.invalidRequest("generateBusinessNames task requires payload.industry.").toResponse();
        const namesPayload = {
          description,
          industry,
          keywords,
          style: nameStyle ?? "modern" as import("@/types/ai").BusinessNameStyle,
          length: nameLength ?? "medium" as import("@/types/ai").BusinessNameLength,
          count: count ?? 6,
        };
        if (stream) return generateBusinessNamesStream(namesPayload, options);
        return Response.json(await generateBusinessNames(namesPayload, options));
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
          `Unknown task type: "${task}". Supported tasks: chat, translate, summarize, generateEmail, generateResume, generateText, paraphrase, grammarCheck.`
        ).toResponse();
    }
  } catch (err) {
    return errorResponse(err);
  }
}

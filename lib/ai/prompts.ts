import type {
  TranslatePayload,
  SummarizePayload,
  GenerateEmailPayload,
  GenerateResumePayload,
  AIMessage,
} from "@/types/ai";

// ── System prompts ────────────────────────────────────────────────────────────
// Each tool has a dedicated system prompt stored here.
// Service functions build the user prompt; system prompts live here.

export const SYSTEM_PROMPTS = {
  chat: `You are a helpful, knowledgeable, and friendly AI assistant on ToolNest AI.
Answer questions clearly and concisely. If you don't know something, say so honestly.
Format your responses using plain text unless the user specifically asks for code or lists.`,

  translate: `You are a professional translator with expertise in all major world languages.
Translate the provided text accurately, preserving tone, meaning, and nuance.
Output ONLY the translated text — no explanations, no labels, no commentary.`,

  summarize: `You are an expert at distilling long texts into clear, accurate summaries.
Preserve all key facts and main ideas. Never add information that isn't in the source.
Output only the summary — no preamble, no commentary.`,

  generateEmail: `You are a professional email writing assistant.
Write polished, effective emails based on the user's specifications.
Output only plain text — no Markdown, no asterisks, no bullet symbols, no # headers.
Always begin with a SUBJECT: line, then a blank line, then the email body.`,

  generateResume: `You are an expert resume and career coach.
Write compelling, ATS-optimized resume content based on the information provided.
Use clean plain text with clear section headers. No Markdown. No asterisks.`,

  generateText: `You are a skilled professional writer.
Generate high-quality text based on the user's instructions.
Match the requested tone and style precisely.`,
} as const;

// ── User prompt builders ──────────────────────────────────────────────────────

export function buildTranslatePrompt(payload: TranslatePayload): string {
  const from =
    payload.sourceLanguage && payload.sourceLanguage !== "Auto Detect"
      ? `from ${payload.sourceLanguage} `
      : "";
  return `Translate the following text ${from}to ${payload.targetLanguage}:\n\n${payload.text}`;
}

export function buildSummarizePrompt(payload: SummarizePayload): string {
  const styleGuide =
    payload.style === "bullet"
      ? "Write the summary as a concise bullet-point list."
      : payload.style === "tldr"
      ? "Write a single-sentence TL;DR summary."
      : "Write the summary as flowing paragraphs.";

  const lengthGuide =
    payload.length === "short"
      ? "Keep it very brief — 2 to 3 points or sentences maximum."
      : payload.length === "long"
      ? "Provide a thorough summary covering all major points."
      : "Keep it moderately concise — cover the main ideas without excessive detail.";

  return `${styleGuide} ${lengthGuide}\n\nText to summarize:\n\n${payload.text}`;
}

export function buildEmailPrompt(payload: GenerateEmailPayload): string {
  const recipientLine = payload.recipient?.trim()
    ? `The recipient is: ${payload.recipient}.`
    : "No specific recipient — use a generic appropriate greeting.";

  const lengthGuide =
    payload.length === "short"
      ? "Keep the email concise — 3 to 5 short paragraphs maximum."
      : payload.length === "long"
      ? "Write a comprehensive email with full context — 6 to 10 paragraphs."
      : "Write a well-structured email of moderate length — 4 to 6 paragraphs.";

  const langLine =
    !payload.language ||
    payload.language === "Auto Detect" ||
    payload.language === "English"
      ? "Write in English."
      : `Write the entire email in ${payload.language}.`;

  const extra = payload.additionalInstructions?.trim()
    ? `Additional instructions: ${payload.additionalInstructions}`
    : "";

  return `${recipientLine}
Email purpose: ${payload.purpose}
Tone: ${payload.tone ?? "Professional"}
Length: ${lengthGuide}
${langLine}
${extra}

OUTPUT FORMAT — follow this EXACTLY:
SUBJECT: [subject line]

[Greeting]

[Email body — clear paragraphs, natural language, call-to-action where appropriate]

[Professional closing]

[Signature Placeholder]`;
}

export function buildResumePrompt(payload: GenerateResumePayload): string {
  return `Create a professional, ATS-optimized resume for the following person.

Name: ${payload.name}
Target Job Title: ${payload.jobTitle}
Work Experience:
${payload.experience}

Skills: ${payload.skills}
${payload.education ? `Education: ${payload.education}` : ""}
${payload.additionalInfo ? `Additional Information: ${payload.additionalInfo}` : ""}

Write all sections clearly. Use plain text with section headers in ALL CAPS (e.g. WORK EXPERIENCE, SKILLS, EDUCATION). No Markdown. No asterisks. No bullet symbols — use plain dashes (-) for lists.`;
}

export function buildChatMessages(
  messages: AIMessage[],
  systemPrompt?: string
): { system: string; messages: AIMessage[] } {
  return {
    system: systemPrompt ?? SYSTEM_PROMPTS.chat,
    messages,
  };
}

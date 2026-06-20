import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";

export const runtime = "edge";
export const maxDuration = 30;

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
});

function buildPrompt(params: {
  recipient: string;
  purpose: string;
  tone: string;
  length: string;
  language: string;
  additionalInstructions: string;
}) {
  const { recipient, purpose, tone, length, language, additionalInstructions } = params;

  const lengthGuide =
    length === "Short"
      ? "Keep the email concise — 3 to 5 short paragraphs maximum."
      : length === "Long"
      ? "Write a comprehensive email with full context and detail — 6 to 10 paragraphs."
      : "Write a well-structured email of moderate length — 4 to 6 paragraphs.";

  const langInstruction =
    language === "Auto Detect" || language === "English"
      ? "Write in English."
      : `Write the entire email in ${language}.`;

  const recipientLine = recipient.trim()
    ? `The recipient is: ${recipient.trim()}.`
    : "No specific recipient was provided — use a generic appropriate greeting.";

  return `You are a professional email writing assistant. Generate a polished, professional email based on the following details.

${recipientLine}
Email purpose: ${purpose}
Tone: ${tone}
Length: ${lengthGuide}
${langInstruction}
${additionalInstructions.trim() ? `Additional instructions: ${additionalInstructions}` : ""}

OUTPUT FORMAT — follow this EXACTLY, no deviations:
Output only plain text. No Markdown. No asterisks. No bullet symbols. No headers with # symbols.

Structure your response in this exact order:

SUBJECT: [write the subject line here]

[Write the greeting here, e.g. "Dear [Name]," or "Hello,"]

[Write the email body here — well-structured paragraphs with proper grammar and natural language. Include a clear call-to-action where appropriate.]

[Write the professional closing here, e.g. "Best regards," or "Sincerely,"]

[Signature Placeholder]

Do not add any explanation, preamble, or commentary. Output the email only.`;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "AI service is not configured. Please set ANTHROPIC_API_KEY." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { recipient = "", purpose, tone, length, language, additionalInstructions = "" } = body;

  if (!purpose?.trim()) {
    return new Response(JSON.stringify({ error: "Email purpose is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    prompt: buildPrompt({ recipient, purpose, tone, length, language, additionalInstructions }),
    maxOutputTokens: 1024,
    temperature: 0.7,
  });

  return result.toTextStreamResponse();
}

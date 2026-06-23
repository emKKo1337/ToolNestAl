import type {
  TranslatePayload,
  SummarizePayload,
  GenerateEmailPayload,
  GenerateResumePayload,
  ParaphrasePayload,
  GrammarCheckPayload,
  HumanizePayload,
  WorkExperience,
  EducationEntry,
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

  grammarCheck: `You are a professional proofreader and writing coach.
Fix all grammar, spelling, punctuation and clarity issues in the provided text.
Preserve the author's original meaning, voice, and intent throughout.`,

  paraphrase: `You are an expert writing assistant specialised in paraphrasing.
Rewrite the provided text according to the requested mode while preserving the original meaning.
Output ONLY the rewritten text — no preamble, no commentary, no labels.`,

  humanize: `You are an expert editor who transforms AI-generated text into authentic, natural human writing.
Remove robotic patterns, overused AI phrases, and unnatural sentence structures.
Preserve the original meaning and key information completely.
Output ONLY the humanized text — no preamble, no commentary, no labels.`,
} as const;

// ── User prompt builders ──────────────────────────────────────────────────────

export function buildTranslatePrompt(payload: TranslatePayload): string {
  const from =
    payload.sourceLanguage && payload.sourceLanguage !== "Auto Detect"
      ? `from ${payload.sourceLanguage} `
      : "";

  const styleGuide =
    payload.style === "professional"
      ? "Use professional, polished language suitable for business communication."
      : payload.style === "formal"
      ? "Use formal, elevated language appropriate for official documents or correspondence."
      : payload.style === "casual"
      ? "Use casual, conversational language — natural and relaxed in tone."
      : payload.style === "natural"
      ? "Prioritise natural, fluent phrasing over literal accuracy. The result should read as if written natively in the target language."
      : payload.style === "academic"
      ? "Use precise, academic language appropriate for scholarly writing. Maintain technical terminology."
      : "Produce a standard, accurate translation that closely follows the source text.";

  const formatNote = payload.preserveFormatting
    ? "Preserve the original text structure, paragraph breaks, and any numbered or bulleted lists."
    : "";

  return `Translate the following text ${from}to ${payload.targetLanguage}.

Style: ${styleGuide}${formatNote ? `\n${formatNote}` : ""}

RULES — follow exactly:
- Preserve the original meaning completely. Never add or remove information.
- Maintain correct grammar, punctuation, and natural sentence flow in the target language.
- Output ONLY the translated text. No explanations, no labels, no commentary.
- Never output Markdown.

Text to translate:

${payload.text}`;
}

export function buildSummarizePrompt(payload: SummarizePayload): string {
  const styleGuide =
    payload.style === "bullet"
      ? "Write the summary as a clear bullet-point list. Use plain dashes (-) for each bullet. No Markdown, no asterisks."
      : payload.style === "executive"
      ? "Write an executive summary: begin with a one-sentence overview, then cover the key findings, implications, and recommended actions in concise paragraphs."
      : payload.style === "key-takeaways"
      ? "Extract and list the key takeaways. Use plain numbered points (1. 2. 3. ...). Focus on the most important insights, facts, and conclusions. No Markdown."
      : "Write the summary as well-structured flowing paragraphs. No lists, no headers.";

  const lengthGuide =
    payload.length === "short"
      ? "Keep it brief — 3 to 5 sentences or points maximum."
      : payload.length === "long"
      ? "Be thorough — cover all major points, supporting details, and conclusions."
      : "Be moderately concise — cover the main ideas and key supporting points without excessive detail.";

  const langLine =
    !payload.language ||
    payload.language === "Auto Detect" ||
    payload.language === "English"
      ? "Write in English."
      : `Write the summary in ${payload.language}.`;

  return `${styleGuide} ${lengthGuide} ${langLine}

IMPORTANT RULES:
- Preserve the original meaning exactly. Never invent or add facts not present in the source.
- Never output Markdown formatting (no **, no ##, no __).
- Output only the summary — no preamble, no labels, no commentary.

Text to summarize:

${payload.text}`;
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

function formatExperience(entries: WorkExperience[]): string {
  if (!entries.length) return "None provided.";
  return entries
    .map((e, i) => {
      const dates = e.current
        ? `${e.startDate} - Present`
        : `${e.startDate}${e.endDate ? ` - ${e.endDate}` : ""}`;
      const location = e.location ? ` | ${e.location}` : "";
      return [
        `[${i + 1}] ${e.jobTitle} at ${e.company}${location}`,
        `Dates: ${dates}`,
        `Responsibilities: ${e.responsibilities}`,
      ].join("\n");
    })
    .join("\n\n");
}

function formatEducation(entries: EducationEntry[]): string {
  if (!entries.length) return "None provided.";
  return entries
    .map((e) => {
      const field = e.fieldOfStudy ? ` in ${e.fieldOfStudy}` : "";
      const location = e.location ? `, ${e.location}` : "";
      const year = e.year ? ` (${e.year})` : "";
      return `${e.degree}${field} - ${e.school}${location}${year}`;
    })
    .join("\n");
}

export function buildResumePrompt(payload: GenerateResumePayload): string {
  const contact = [
    payload.email,
    payload.phone,
    payload.address,
    payload.linkedin,
    payload.portfolio,
  ]
    .filter(Boolean)
    .join(" | ");

  const jobDescSection = payload.jobDescription?.trim()
    ? `\nTARGET JOB DESCRIPTION (use this to tailor keywords and emphasis — do NOT invent experience):\n${payload.jobDescription}\n`
    : "";

  const summarySection = payload.summary?.trim()
    ? `\nPROFESSIONAL SUMMARY PROVIDED BY CANDIDATE (refine wording, keep meaning exactly):\n${payload.summary}\n`
    : "";

  const skillsSection = [
    payload.technicalSkills ? `Technical Skills: ${payload.technicalSkills}` : "",
    payload.softSkills ? `Soft Skills: ${payload.softSkills}` : "",
    payload.languages ? `Languages: ${payload.languages}` : "",
    payload.certificates ? `Certifications: ${payload.certificates}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `Create a professional, ATS-optimized resume for the following candidate.

CANDIDATE INFORMATION:
Name: ${payload.name}
Contact: ${contact || "Not provided"}
${summarySection}
WORK EXPERIENCE:
${formatExperience(payload.experience)}

EDUCATION:
${formatEducation(payload.education)}

SKILLS & QUALIFICATIONS:
${skillsSection || "Not provided"}
${jobDescSection}
OUTPUT RULES — follow exactly:
- Output plain text only. No Markdown. No asterisks, no **, no ##, no __.
- Use ALL CAPS for section headers (PROFESSIONAL SUMMARY, WORK EXPERIENCE, EDUCATION, SKILLS, CERTIFICATIONS).
- Use plain dashes (-) for bullet points under each role.
- Improve and professionalize wording but NEVER invent, exaggerate, or add experience not in the source data.
- If a job description was provided, incorporate relevant keywords naturally throughout.
- Begin with the candidate's name and contact information on separate lines.
- Keep the resume ATS-friendly: clean structure, consistent formatting, no tables or columns.`;
}

export function buildSummaryPrompt(payload: {
  name: string;
  experience: WorkExperience[];
  technicalSkills?: string;
  softSkills?: string;
  jobDescription?: string;
}): string {
  const topRole = payload.experience[0];
  const roleContext = topRole
    ? `Most recent role: ${topRole.jobTitle} at ${topRole.company}.`
    : "";
  const jobTarget = payload.jobDescription?.trim()
    ? `Target position context: ${payload.jobDescription.slice(0, 300)}`
    : "";

  return `Write a concise 3-sentence professional summary for a resume.

Candidate name: ${payload.name}
${roleContext}
Technical skills: ${payload.technicalSkills || "Not specified"}
Soft skills: ${payload.softSkills || "Not specified"}
${jobTarget}

RULES:
- 3 sentences only. Impactful, professional, first-person perspective.
- Highlight value and expertise. Do not mention specific employers by name.
- Plain text only. No Markdown. No labels. Output only the summary paragraph.`;
}

export function buildGrammarCheckPrompt(payload: GrammarCheckPayload): string {
  const explainSection = payload.explainCorrections
    ? `After the corrected text, add a blank line then write "CORRECTIONS:" followed by a concise numbered list of the changes you made and why. Keep each explanation brief (one sentence).`
    : `Output ONLY the corrected text — no labels, no explanations, no commentary.`;

  return `Proofread and correct the following text. Fix all:
- Grammar errors
- Spelling mistakes
- Punctuation issues
- Clarity and readability problems
- Awkward phrasing

RULES — follow exactly:
- Preserve the original meaning, tone, and intent completely.
- Keep changes minimal — only fix genuine errors and unclear phrasing.
- Do NOT rewrite sentences that are already correct.
- Do NOT change the author's style or voice unnecessarily.
- Never output Markdown formatting (no **, no ##, no __).
- ${explainSection}

Text to check:

${payload.text}`;
}

export function buildParaphrasePrompt(payload: ParaphrasePayload): string {
  const modeGuide =
    payload.mode === "fluent"
      ? "Rewrite with smooth, natural-flowing language. Improve readability and sentence flow without changing the meaning."
      : payload.mode === "creative"
      ? "Rewrite with creative flair and varied sentence structures. Use vivid language while preserving the core meaning."
      : payload.mode === "academic"
      ? "Rewrite using formal, academic language with precise vocabulary and scholarly tone. Maintain all facts and arguments."
      : payload.mode === "shorten"
      ? "Rewrite as a shorter, more concise version. Remove redundancy and filler while keeping all essential information."
      : payload.mode === "expand"
      ? "Rewrite as a longer, more detailed version. Elaborate on the ideas, add context and depth while staying faithful to the original meaning."
      : "Rewrite in different words while preserving the original meaning, tone, and intent. Avoid copying sentences verbatim.";

  return `Mode: ${modeGuide}

RULES — follow exactly:
- Preserve the original meaning completely. Never add, remove, or distort facts.
- Do NOT copy sentences verbatim from the source.
- Output ONLY the rewritten text. No explanations, no labels, no commentary.
- Never output Markdown formatting (no **, no ##, no __).

Text to paraphrase:

${payload.text}`;
}

export function buildHumanizePrompt(payload: HumanizePayload): string {
  const strengthGuide =
    payload.strength === "light"
      ? "Make subtle adjustments: vary sentence rhythm, replace overused AI phrases, and add minor natural imperfections. Keep the structure largely intact."
      : payload.strength === "strong"
      ? "Deeply rewrite the text: restructure sentences, add natural conversational flow, inject personality and warmth, eliminate all AI patterns, and make it sound like a confident human author wrote it from scratch."
      : "Balance naturalness with faithfulness: rewrite sentences for flow, remove AI clichés, add human-sounding transitions, and vary sentence lengths naturally.";

  return `Strength: ${strengthGuide}

RULES — follow exactly:
- Preserve ALL original facts, data, and meaning. Never add or remove information.
- Remove robotic AI patterns: overuse of "Furthermore", "In conclusion", "It is important to note", "Delve into", "Embark on", etc.
- Vary sentence length and structure naturally — mix short punchy sentences with longer ones.
- Use contractions where appropriate (it's, you'll, we've) for a more human voice.
- Output ONLY the humanized text. No explanations, no labels, no commentary.
- Never output Markdown formatting (no **, no ##, no __).

Text to humanize:

${payload.text}`;
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

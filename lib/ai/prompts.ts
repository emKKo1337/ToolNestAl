import type {
  TranslatePayload,
  SummarizePayload,
  GenerateEmailPayload,
  GenerateResumePayload,
  ParaphrasePayload,
  GrammarCheckPayload,
  HumanizePayload,
  CoverLetterPayload,
  GeneratePromptPayload,
  GenerateBusinessNamesPayload,
  GenerateSlogansPayload,
  GenerateUsernamesPayload,
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

  coverLetter: `You are an expert career coach and professional writer specialising in cover letters.
Write compelling, ATS-friendly cover letters that are tailored to the role and company.
Output only plain text — no Markdown, no asterisks, no bullet symbols, no # headers.
The letter should have a proper greeting, 3-4 focused paragraphs, and a professional closing.`,

  generatePrompt: `You are a world-class prompt engineer who creates highly effective, optimised prompts for AI models.
You deeply understand what makes prompts clear, specific, and effective for each AI system.
Output ONLY the ready-to-use prompt — no explanations, no preamble, no labels, no surrounding quotes.
The prompt must be immediately usable: copy and paste it straight into the target AI model.`,

  generateBusinessNames: `You are a world-class branding expert and creative naming strategist.
You specialise in creating memorable, distinctive, and brandable business names.
You always follow the exact output format specified — never deviate, never add extra commentary.`,

  generateSlogans: `You are a world-class copywriter and brand strategist who creates iconic, memorable slogans and taglines.
You deeply understand how great slogans distill a brand's essence into a few powerful words.
You always follow the exact output format specified — never deviate, never add extra commentary.`,

  generateUsernames: `You are a creative naming expert specialising in catchy, memorable usernames for social media and online platforms.
You understand platform conventions, character limits, and what makes a username stand out.
You always follow the exact output format specified — never deviate, never add extra commentary.`,
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

export function buildCoverLetterPrompt(payload: CoverLetterPayload): string {
  const toneGuide =
    payload.tone === "friendly"
      ? "Write in a warm, approachable, and personable tone while remaining professional."
      : payload.tone === "confident"
      ? "Write in a bold, assertive, and self-assured tone that highlights achievements with conviction."
      : "Write in a polished, formal, and professional tone appropriate for corporate environments.";

  const additionalSection = payload.additionalInfo?.trim()
    ? `\nAdditional context: ${payload.additionalInfo.trim()}`
    : "";

  return `Write a complete cover letter for the following applicant and role.

Applicant details:
- Name: ${payload.applicantName}
- Years of experience: ${payload.yearsOfExperience}
- Key skills: ${payload.skills}

Role details:
- Job title: ${payload.jobTitle}
- Company: ${payload.companyName}${additionalSection}

Tone: ${toneGuide}

RULES — follow exactly:
- Open with the applicant's name and a strong opening line referencing the role.
- Paragraph 1: Express genuine interest in the role and company.
- Paragraph 2: Highlight 2-3 relevant skills or achievements aligned with the job title.
- Paragraph 3: Explain why this company specifically and what value the applicant brings.
- Close with a confident call to action and professional sign-off.
- Output plain text only — no Markdown, no asterisks, no bullet points in the body.
- Do NOT include placeholders like [Your Address] or [Date].`;
}

export function buildGeneratePromptPrompt(payload: GeneratePromptPayload): string {
  const modelLabel: Record<string, string> = {
    chatgpt: "ChatGPT (OpenAI GPT-4o)",
    claude: "Claude (Anthropic)",
    gemini: "Gemini (Google)",
    grok: "Grok (xAI)",
    midjourney: "Midjourney",
    "stable-diffusion": "Stable Diffusion",
    any: "any general-purpose AI model",
  };

  const toneGuide: Record<string, string> = {
    professional: "Use formal, precise, and authoritative language.",
    casual: "Use conversational, friendly, and approachable language.",
    creative: "Use imaginative, expressive, and inventive language.",
    technical: "Use specific, detailed, and domain-accurate terminology.",
    persuasive: "Use compelling, motivating, and convincing language.",
  };

  const lengthGuide: Record<string, string> = {
    short: "Keep the prompt concise — 1 to 3 sentences. Get straight to the point.",
    medium: "Write a moderately detailed prompt — 4 to 8 sentences with clear context and instructions.",
    detailed: "Write a comprehensive, highly detailed prompt — include role assignment, detailed context, step-by-step instructions, constraints, output format guidance, and examples where helpful.",
  };

  const categoryContext: Record<string, string> = {
    writing: "creative or professional writing",
    coding: "software development and programming",
    marketing: "marketing campaigns and brand messaging",
    seo: "search engine optimisation and content strategy",
    business: "business strategy and operations",
    education: "teaching, learning, and educational content",
    "social-media": "social media content and engagement",
    "image-generation": "AI image and visual content generation",
  };

  const improvingSection = payload.existingPrompt?.trim()
    ? `\n\nExisting prompt to improve:\n"""\n${payload.existingPrompt.trim()}\n"""\n\nTask: Rewrite and significantly improve the above prompt. Fix vagueness, add specificity, improve structure, and optimise it for the target model while preserving the original intent.`
    : `\n\nTask: Write a brand-new, highly optimised prompt for the goal described above.`;

  return `Create an optimised prompt for the following request.

Target AI model: ${modelLabel[payload.model] ?? payload.model}
Category: ${categoryContext[payload.category] ?? payload.category}
Tone: ${toneGuide[payload.tone] ?? payload.tone}
Length: ${lengthGuide[payload.length] ?? payload.length}

Goal / what the prompt should achieve:
${payload.goal}${improvingSection}

RULES — follow exactly:
- Output ONLY the final prompt text. Nothing else.
- Do not wrap the prompt in quotes.
- Do not add any explanation, commentary, or labels before or after.
- The prompt must be immediately usable — copy-paste ready.
- For image-generation models, include style, lighting, composition, and mood descriptors.
- For coding models, specify language, framework, and output format where relevant.
- For writing/content models, assign a clear role, context, and output instructions.`;
}

export function buildGenerateBusinessNamesPrompt(payload: GenerateBusinessNamesPayload): string {
  const count = payload.count ?? 6;

  const styleGuide: Record<string, string> = {
    modern: "Sleek, forward-thinking, tech-inspired — names that feel fresh and current.",
    professional: "Trustworthy, established, credible — names that inspire confidence.",
    luxury: "Premium, exclusive, sophisticated — names that feel high-end and aspirational.",
    creative: "Imaginative, playful, unexpected — names with personality and originality.",
    minimal: "Clean, simple, one or two syllables — names that are easy to say and remember.",
  };

  const lengthGuide: Record<string, string> = {
    short: "1–5 characters or one very short word (e.g. Uber, Lyft, Zip).",
    medium: "6–10 characters or one to two words (e.g. Shopify, Notion, Stripe).",
    long: "11–20 characters or two to three words (e.g. SalesForce, MailChimp, HubSpot).",
  };

  const keywordsSection = payload.keywords?.trim()
    ? `\nKeywords to incorporate or draw inspiration from: ${payload.keywords.trim()}`
    : "";

  return `Generate exactly ${count} unique business names for the following brief.

Business description: ${payload.description}
Industry: ${payload.industry}${keywordsSection}
Brand style: ${styleGuide[payload.style] ?? payload.style}
Name length: ${lengthGuide[payload.length] ?? payload.length}

Output EXACTLY this format for each name — no extra text before, between, or after the blocks:

NAME: [Business name]
EXPLANATION: [One sentence explaining the name's meaning, feel, and why it fits the brand — max 20 words]
TAGLINE: [A short, punchy tagline for this name — max 8 words]
STYLE: [${payload.style}]
---

RULES:
- Output exactly ${count} blocks separated by ---
- Each block must have NAME, EXPLANATION, TAGLINE, and STYLE lines in that order
- Names must be original, pronounceable, and not obvious trademarks
- Do not number the blocks
- Do not add any text outside the blocks
- The last block must also end with ---`;
}

export function buildGenerateSlogansPrompt(payload: GenerateSlogansPayload): string {
  const count = payload.count ?? 6;

  const toneGuide: Record<string, string> = {
    professional: "Authoritative, polished, and trustworthy — clear and confident language that inspires credibility.",
    creative: "Imaginative, unexpected, and original — wordplay, metaphors, and clever twists welcome.",
    luxury: "Refined, exclusive, and aspirational — evoke prestige, quality, and sophistication.",
    fun: "Playful, witty, and energetic — light-hearted with personality, humour, and warmth.",
    modern: "Sleek, forward-thinking, and minimal — contemporary language that feels fresh and current.",
  };

  const lengthGuide: Record<string, string> = {
    short: "2–4 words maximum. Ultra-punchy and instantly memorable (e.g. 'Just Do It', 'Think Different').",
    medium: "5–8 words. Balanced and clear, says something meaningful without being long-winded.",
    long: "9–14 words. A complete thought with impact — tells a mini story or makes a bold promise.",
  };

  const keywordsSection = payload.keywords?.trim()
    ? `\nKeywords to weave in: ${payload.keywords.trim()}`
    : "";

  return `Generate exactly ${count} unique slogans for the following brand.

Business name: ${payload.businessName}
Business description: ${payload.description}
Industry: ${payload.industry}${keywordsSection}
Tone: ${toneGuide[payload.tone] ?? payload.tone}
Length: ${lengthGuide[payload.length] ?? payload.length}

Output EXACTLY this format for each slogan — no extra text before, between, or after the blocks:

SLOGAN: [The slogan]
EXPLANATION: [One sentence on why this slogan works for this brand — max 20 words]
TONE: [${payload.tone}]
ALTERNATIVES: [Two shorter alternative versions, separated by | ]
---

RULES:
- Output exactly ${count} blocks separated by ---
- Each block must have SLOGAN, EXPLANATION, TONE, and ALTERNATIVES lines in that order
- Slogans must be original, punchy, and on-brand
- Do not number the blocks
- Do not add any text outside the blocks
- The last block must also end with ---`;
}

export function buildGenerateUsernamesPrompt(payload: GenerateUsernamesPayload): string {
  const count = payload.count ?? 10;

  const platformRules: Record<string, string> = {
    instagram: "Instagram: 1–30 chars, letters, numbers, periods, underscores only.",
    tiktok:    "TikTok: 2–24 chars, letters, numbers, underscores, periods only.",
    youtube:   "YouTube: 3–30 chars, letters, numbers, hyphens, underscores.",
    x:         "X (Twitter): 1–15 chars, letters, numbers, underscores only — no spaces.",
    twitch:    "Twitch: 4–25 chars, letters, numbers, underscores only.",
    steam:     "Steam: 3–32 chars, letters, numbers, underscores, hyphens.",
    discord:   "Discord: 2–32 chars, letters, numbers, underscores, hyphens, periods.",
    github:    "GitHub: 1–39 chars, letters, numbers, hyphens only — no underscores.",
  };

  const styleGuide: Record<string, string> = {
    professional: "Clean, credible, and polished — suitable for a professional personal brand or creator.",
    gaming:       "Bold, edgy, and memorable — sounds powerful and stands out in gaming lobbies.",
    minimal:      "Ultra-clean, short, and elegant — one word or a simple compound with no extra characters.",
    funny:        "Witty, playful, and humorous — clever wordplay, puns, or absurd combinations.",
    tech:         "Technical, clever, and nerdy — references to code, data, science, or tech culture.",
    luxury:       "Sophisticated, premium, and aspirational — feels exclusive and high-status.",
  };

  const lengthGuide: Record<string, string> = {
    short:  "Under 8 characters — ultra-punchy and easy to remember.",
    medium: "8–15 characters — balanced and readable.",
    long:   "15–25 characters — descriptive and distinctive.",
  };

  const numbersRule  = payload.allowNumbers    ? "Numbers ARE allowed." : "Do NOT include any numbers.";
  const specialRule  = payload.allowSpecialChars ? "Underscores and periods ARE allowed where the platform permits." : "Do NOT include underscores, periods, or any special characters — letters only.";
  const interestsSection = payload.interests?.trim()
    ? `\nInterests / themes to draw from: ${payload.interests.trim()}`
    : "";

  return `Generate exactly ${count} unique usernames for the following brief.

Keyword / name to base usernames on: ${payload.keyword}${interestsSection}
Target platform: ${platformRules[payload.platform] ?? payload.platform}
Style: ${styleGuide[payload.style] ?? payload.style}
Length: ${lengthGuide[payload.length] ?? payload.length}
${numbersRule}
${specialRule}

Output EXACTLY this format for each username — no extra text before, between, or after the blocks:

USERNAME: [The username]
STYLE: [${payload.style}]
ALTERNATIVES: [Two alternative variations of this username, separated by | ]
---

RULES:
- Output exactly ${count} blocks separated by ---
- Each block must have USERNAME, STYLE, and ALTERNATIVES lines in that order
- All usernames must respect the platform's character limits and allowed characters
- Every username must be unique — no duplicates
- Do not number the blocks
- Do not add any text outside the blocks
- The last block must also end with ---`;
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

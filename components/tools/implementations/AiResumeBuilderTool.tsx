"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { WorkExperience, EducationEntry } from "@/types/ai";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormData {
  // Step 1 — Personal
  name: string;
  email: string;
  phone: string;
  address: string;
  linkedin: string;
  portfolio: string;
  // Step 2 — Summary
  summary: string;
  // Step 3 — Experience
  experience: WorkExperience[];
  // Step 4 — Education
  education: EducationEntry[];
  // Step 5 — Skills
  technicalSkills: string;
  softSkills: string;
  languages: string;
  certificates: string;
  // Step 6 — Target job
  jobDescription: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "toolnest-resume-form";

const STEPS = [
  { id: 1, label: "Personal",    icon: "person" },
  { id: 2, label: "Summary",     icon: "description" },
  { id: 3, label: "Experience",  icon: "work" },
  { id: 4, label: "Education",   icon: "school" },
  { id: 5, label: "Skills",      icon: "psychology" },
  { id: 6, label: "Generate",    icon: "auto_awesome" },
] as const;

const EMPTY_EXPERIENCE: WorkExperience = {
  jobTitle: "", company: "", location: "",
  startDate: "", endDate: "", current: false, responsibilities: "",
};

const EMPTY_EDUCATION: EducationEntry = {
  degree: "", fieldOfStudy: "", school: "", location: "", year: "",
};

const EMPTY_FORM: FormData = {
  name: "", email: "", phone: "", address: "", linkedin: "", portfolio: "",
  summary: "",
  experience: [{ ...EMPTY_EXPERIENCE }],
  education: [{ ...EMPTY_EDUCATION }],
  technicalSkills: "", softSkills: "", languages: "", certificates: "",
  jobDescription: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadSaved(): FormData {
  if (typeof window === "undefined") return EMPTY_FORM;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_FORM;
    return { ...EMPTY_FORM, ...JSON.parse(raw) };
  } catch {
    return EMPTY_FORM;
  }
}

function save(data: FormData) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

function printResume(text: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>Resume</title><style>
    body{font-family:Arial,sans-serif;font-size:12px;line-height:1.6;margin:40px;color:#111;}
    pre{white-space:pre-wrap;font-family:inherit;font-size:12px;}
    @media print{body{margin:20px;}}
  </style></head><body><pre>${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></body></html>`);
  win.document.close();
  setTimeout(() => { win.print(); }, 300);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({
  label, id, required, children,
}: { label: string; id?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.06em]">
        {label}{required && <span className="text-[#ef4444] ml-1 normal-case font-normal tracking-normal">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ id, value, onChange, placeholder, type = "text" }: {
  id?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <input
      id={id} type={type} value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.09)] rounded-xl px-4 py-3 text-[14px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#ddb7ff] transition-colors"
    />
  );
}

function Textarea({ id, value, onChange, placeholder, rows = 4 }: {
  id?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      id={id} value={value} rows={rows}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.09)] rounded-xl px-4 py-3 text-[14px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#ddb7ff] transition-colors resize-y leading-relaxed"
    />
  );
}

function ActionButton({
  onClick, disabled, icon, label, active, activeIcon, activeLabel, activeColor = "#22c55e",
}: {
  onClick: () => void; disabled?: boolean; icon: string; label: string;
  active?: boolean; activeIcon?: string; activeLabel?: string; activeColor?: string;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled} aria-label={label}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: active ? `${activeColor}22` : "rgba(255,255,255,0.06)",
        color: active ? activeColor : "#988d9f",
        border: `1px solid ${active ? `${activeColor}44` : "rgba(255,255,255,0.08)"}`,
      }}
    >
      <span className="material-symbols-outlined text-[14px]">{active && activeIcon ? activeIcon : icon}</span>
      {active && activeLabel ? activeLabel : label}
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AiResumeBuilderTool() {
  const [form, setFormRaw]     = useState<FormData>(EMPTY_FORM);
  const [step, setStep]        = useState(1);
  const [resume, setResume]    = useState("");
  const [isLoading, setIsLoading]       = useState(false);
  const [isSummaryLoading, setSummaryLoading] = useState(false);
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);
  const [copied, setCopied]             = useState(false);
  const [downloaded, setDownloaded]     = useState(false);
  const [nameError, setNameError]       = useState(false);

  const outputRef = useRef<HTMLDivElement>(null);
  const abortRef  = useRef<AbortController | null>(null);
  const hasOutput = resume.trim().length > 0;

  // Load from localStorage on mount
  useEffect(() => { setFormRaw(loadSaved()); }, []);

  const setForm = useCallback((updater: (prev: FormData) => FormData) => {
    setFormRaw((prev) => {
      const next = updater(prev);
      save(next);
      return next;
    });
  }, []);

  const set = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, [setForm]);

  // ── Experience helpers ───────────────────────────────────────────────────

  const updateExp = useCallback((i: number, field: keyof WorkExperience, value: string | boolean) => {
    setForm((prev) => {
      const exp = [...prev.experience];
      exp[i] = { ...exp[i], [field]: value };
      return { ...prev, experience: exp };
    });
  }, [setForm]);

  const addExp = useCallback(() => {
    setForm((prev) => ({ ...prev, experience: [...prev.experience, { ...EMPTY_EXPERIENCE }] }));
  }, [setForm]);

  const removeExp = useCallback((i: number) => {
    setForm((prev) => ({ ...prev, experience: prev.experience.filter((_, idx) => idx !== i) }));
  }, [setForm]);

  // ── Education helpers ────────────────────────────────────────────────────

  const updateEdu = useCallback((i: number, field: keyof EducationEntry, value: string) => {
    setForm((prev) => {
      const edu = [...prev.education];
      edu[i] = { ...edu[i], [field]: value };
      return { ...prev, education: edu };
    });
  }, [setForm]);

  const addEdu = useCallback(() => {
    setForm((prev) => ({ ...prev, education: [...prev.education, { ...EMPTY_EDUCATION }] }));
  }, [setForm]);

  const removeEdu = useCallback((i: number) => {
    setForm((prev) => ({ ...prev, education: prev.education.filter((_, idx) => idx !== i) }));
  }, [setForm]);

  // ── AI summary generation ────────────────────────────────────────────────

  const handleGenerateSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "generateText",
          prompt: `Write a concise 3-sentence professional resume summary.
Name: ${form.name || "Candidate"}
Most recent role: ${form.experience[0]?.jobTitle || "N/A"} at ${form.experience[0]?.company || "N/A"}
Technical skills: ${form.technicalSkills || "Not specified"}
Soft skills: ${form.softSkills || "Not specified"}
${form.jobDescription ? `Target job context: ${form.jobDescription.slice(0, 300)}` : ""}

Rules: 3 sentences only. Professional, first-person. No labels. No Markdown. Output only the summary paragraph.`,
          options: { stream: false, maxTokens: 200 },
        }),
      });
      if (!res.ok) throw new Error("Failed to generate summary.");
      const json = await res.json() as { text?: string };
      if (json.text) set("summary", json.text.trim());
    } catch {
      // silently fail — user can write manually
    } finally {
      setSummaryLoading(false);
    }
  }, [form, set]);

  // ── Resume generation ────────────────────────────────────────────────────

  const generate = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setIsLoading(true);
    setErrorMsg(null);
    setResume("");

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "generateResume",
          payload: {
            name: form.name,
            email: form.email || undefined,
            phone: form.phone || undefined,
            address: form.address || undefined,
            linkedin: form.linkedin || undefined,
            portfolio: form.portfolio || undefined,
            summary: form.summary || undefined,
            experience: form.experience.filter((e) => e.jobTitle && e.company),
            education: form.education.filter((e) => e.degree && e.school),
            technicalSkills: form.technicalSkills || undefined,
            softSkills: form.softSkills || undefined,
            languages: form.languages || undefined,
            certificates: form.certificates || undefined,
            jobDescription: form.jobDescription || undefined,
          },
          options: { stream: true, maxTokens: 3000 },
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { message?: string }).message ?? `Server error ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream.");

      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setResume(accumulated);
      }

      setTimeout(() => {
        outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [form]);

  const handleGenerate = useCallback(async () => {
    if (!form.name.trim()) { setNameError(true); setStep(1); return; }
    setNameError(false);
    await generate();
  }, [form.name, generate]);

  const handleCopy = useCallback(async () => {
    if (!resume) return;
    await navigator.clipboard.writeText(resume);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [resume]);

  const handleDownloadTxt = useCallback(() => {
    if (!resume) return;
    const blob = new Blob([resume], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form.name.replace(/\s+/g, "_") || "resume"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  }, [resume, form.name]);

  const handleDownloadPdf = useCallback(() => {
    if (!resume) return;
    printResume(resume);
  }, [resume]);

  const handleStartOver = useCallback(() => {
    abortRef.current?.abort();
    setFormRaw(EMPTY_FORM);
    save(EMPTY_FORM);
    setResume("");
    setErrorMsg(null);
    setStep(1);
    setNameError(false);
  }, []);

  // ── Step content ──────────────────────────────────────────────────────────

  const stepContent: Record<number, React.ReactNode> = {
    // ── Step 1: Personal Info ────────────────────────────────────────────
    1: (
      <div className="flex flex-col gap-5">
        <p className="text-[15px] font-bold text-[#e2e2e2]">Personal Information</p>
        <Field label="Full Name" id="name" required>
          <input
            id="name" type="text" value={form.name}
            onChange={(e) => { set("name", e.target.value); if (e.target.value.trim()) setNameError(false); }}
            placeholder="Jane Smith"
            aria-invalid={nameError}
            className="bg-[rgba(0,0,0,0.25)] rounded-xl px-4 py-3 text-[14px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none transition-colors"
            style={{ border: `1px solid ${nameError ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.09)"}` }}
          />
          {nameError && <p role="alert" className="text-[12px] text-[#ef4444]">Full name is required.</p>}
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Email" id="email">
            <Input id="email" value={form.email} onChange={(v) => set("email", v)} placeholder="jane@example.com" type="email" />
          </Field>
          <Field label="Phone" id="phone">
            <Input id="phone" value={form.phone} onChange={(v) => set("phone", v)} placeholder="+1 555 000 0000" />
          </Field>
        </div>
        <Field label="Address" id="address">
          <Input id="address" value={form.address} onChange={(v) => set("address", v)} placeholder="City, State / Country" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="LinkedIn" id="linkedin">
            <Input id="linkedin" value={form.linkedin} onChange={(v) => set("linkedin", v)} placeholder="linkedin.com/in/janesmith" />
          </Field>
          <Field label="Portfolio / Website" id="portfolio">
            <Input id="portfolio" value={form.portfolio} onChange={(v) => set("portfolio", v)} placeholder="janesmith.com" />
          </Field>
        </div>
      </div>
    ),

    // ── Step 2: Professional Summary ─────────────────────────────────────
    2: (
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-[15px] font-bold text-[#e2e2e2]">Professional Summary</p>
          <button
            onClick={handleGenerateSummary}
            disabled={isSummaryLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-60"
            style={{
              background: "rgba(221,183,255,0.1)",
              border: "1px solid rgba(221,183,255,0.25)",
              color: "#ddb7ff",
            }}
          >
            {isSummaryLoading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-[#ddb7ff] border-t-transparent rounded-full animate-spin inline-block" />
                Generating…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                Generate with AI
              </>
            )}
          </button>
        </div>
        <p className="text-[13px] text-[#6b5b7a] -mt-2">
          Write your own summary or click <strong className="text-[#9b8da8]">Generate with AI</strong> to draft one based on your information.
        </p>
        <Field label="Summary" id="summary">
          <Textarea
            id="summary" value={form.summary}
            onChange={(v) => set("summary", v)} rows={6}
            placeholder="Results-driven software engineer with 5+ years of experience building scalable web applications…"
          />
        </Field>
      </div>
    ),

    // ── Step 3: Work Experience ───────────────────────────────────────────
    3: (
      <div className="flex flex-col gap-6">
        <p className="text-[15px] font-bold text-[#e2e2e2]">Work Experience</p>
        {form.experience.map((exp, i) => (
          <div key={i} className="flex flex-col gap-4 p-5 rounded-xl" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-bold text-[#ddb7ff]">Position {i + 1}</p>
              {form.experience.length > 1 && (
                <button onClick={() => removeExp(i)} aria-label="Remove position"
                  className="flex items-center gap-1 text-[12px] text-[#6b5b7a] hover:text-[#ef4444] transition-colors">
                  <span className="material-symbols-outlined text-[14px]">delete</span> Remove
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Job Title" id={`exp-title-${i}`}>
                <Input id={`exp-title-${i}`} value={exp.jobTitle} onChange={(v) => updateExp(i, "jobTitle", v)} placeholder="Software Engineer" />
              </Field>
              <Field label="Company" id={`exp-company-${i}`}>
                <Input id={`exp-company-${i}`} value={exp.company} onChange={(v) => updateExp(i, "company", v)} placeholder="Acme Corp" />
              </Field>
            </div>
            <Field label="Location" id={`exp-loc-${i}`}>
              <Input id={`exp-loc-${i}`} value={exp.location ?? ""} onChange={(v) => updateExp(i, "location", v)} placeholder="New York, NY (or Remote)" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Start Date" id={`exp-start-${i}`}>
                <Input id={`exp-start-${i}`} value={exp.startDate} onChange={(v) => updateExp(i, "startDate", v)} placeholder="Jan 2022" />
              </Field>
              <Field label="End Date" id={`exp-end-${i}`}>
                <input
                  id={`exp-end-${i}`} type="text" value={exp.current ? "" : (exp.endDate ?? "")}
                  onChange={(e) => updateExp(i, "endDate", e.target.value)}
                  placeholder={exp.current ? "Present" : "Dec 2024"}
                  disabled={exp.current}
                  className="bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.09)] rounded-xl px-4 py-3 text-[14px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#ddb7ff] transition-colors disabled:opacity-40"
                />
              </Field>
            </div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox" checked={exp.current}
                onChange={(e) => updateExp(i, "current", e.target.checked)}
                className="w-4 h-4 rounded accent-[#ddb7ff]"
              />
              <span className="text-[13px] text-[#988d9f]">I currently work here</span>
            </label>
            <Field label="Key Responsibilities & Achievements" id={`exp-resp-${i}`}>
              <Textarea
                id={`exp-resp-${i}`} value={exp.responsibilities}
                onChange={(v) => updateExp(i, "responsibilities", v)} rows={5}
                placeholder="Describe your main responsibilities, achievements, and impact. The AI will improve and professionalize the wording while keeping all information truthful."
              />
            </Field>
          </div>
        ))}
        <button
          onClick={addExp}
          className="flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.12)", color: "#6b5b7a" }}
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          Add Another Position
        </button>
      </div>
    ),

    // ── Step 4: Education ────────────────────────────────────────────────
    4: (
      <div className="flex flex-col gap-6">
        <p className="text-[15px] font-bold text-[#e2e2e2]">Education</p>
        {form.education.map((edu, i) => (
          <div key={i} className="flex flex-col gap-4 p-5 rounded-xl" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-bold text-[#ddb7ff]">Degree {i + 1}</p>
              {form.education.length > 1 && (
                <button onClick={() => removeEdu(i)} aria-label="Remove education"
                  className="flex items-center gap-1 text-[12px] text-[#6b5b7a] hover:text-[#ef4444] transition-colors">
                  <span className="material-symbols-outlined text-[14px]">delete</span> Remove
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Degree / Qualification" id={`edu-degree-${i}`}>
                <Input id={`edu-degree-${i}`} value={edu.degree} onChange={(v) => updateEdu(i, "degree", v)} placeholder="Bachelor of Science" />
              </Field>
              <Field label="Field of Study" id={`edu-field-${i}`}>
                <Input id={`edu-field-${i}`} value={edu.fieldOfStudy ?? ""} onChange={(v) => updateEdu(i, "fieldOfStudy", v)} placeholder="Computer Science" />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="School / University" id={`edu-school-${i}`}>
                <Input id={`edu-school-${i}`} value={edu.school} onChange={(v) => updateEdu(i, "school", v)} placeholder="MIT" />
              </Field>
              <Field label="Graduation Year" id={`edu-year-${i}`}>
                <Input id={`edu-year-${i}`} value={edu.year ?? ""} onChange={(v) => updateEdu(i, "year", v)} placeholder="2020" />
              </Field>
            </div>
            <Field label="Location" id={`edu-loc-${i}`}>
              <Input id={`edu-loc-${i}`} value={edu.location ?? ""} onChange={(v) => updateEdu(i, "location", v)} placeholder="Cambridge, MA" />
            </Field>
          </div>
        ))}
        <button
          onClick={addEdu}
          className="flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.12)", color: "#6b5b7a" }}
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          Add Another Degree
        </button>
      </div>
    ),

    // ── Step 5: Skills ───────────────────────────────────────────────────
    5: (
      <div className="flex flex-col gap-5">
        <p className="text-[15px] font-bold text-[#e2e2e2]">Skills & Qualifications</p>
        <Field label="Technical Skills" id="tech-skills">
          <Textarea id="tech-skills" value={form.technicalSkills} onChange={(v) => set("technicalSkills", v)} rows={3}
            placeholder="React, TypeScript, Node.js, PostgreSQL, AWS, Docker…" />
        </Field>
        <Field label="Soft Skills" id="soft-skills">
          <Textarea id="soft-skills" value={form.softSkills} onChange={(v) => set("softSkills", v)} rows={3}
            placeholder="Leadership, problem-solving, communication, project management…" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Languages" id="lang-skills">
            <Textarea id="lang-skills" value={form.languages} onChange={(v) => set("languages", v)} rows={3}
              placeholder="English (native), Spanish (fluent), German (basic)…" />
          </Field>
          <Field label="Certificates & Awards" id="certificates">
            <Textarea id="certificates" value={form.certificates} onChange={(v) => set("certificates", v)} rows={3}
              placeholder="AWS Certified Solutions Architect, Google Cloud Professional…" />
          </Field>
        </div>
      </div>
    ),

    // ── Step 6: Generate ─────────────────────────────────────────────────
    6: (
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-[15px] font-bold text-[#e2e2e2] mb-1">Target Job Description</p>
          <p className="text-[13px] text-[#6b5b7a]">
            Optional. Paste the job description to let the AI optimize keywords and emphasis for ATS matching.
          </p>
        </div>
        <Field label="Job Description (optional)" id="job-desc">
          <Textarea id="job-desc" value={form.jobDescription} onChange={(v) => set("jobDescription", v)} rows={8}
            placeholder="Paste the full job description here. The AI will tailor your resume to match the requirements — without inventing experience." />
        </Field>

        {/* Summary card */}
        <div className="p-4 rounded-xl flex flex-col gap-2" style={{ background: "rgba(221,183,255,0.06)", border: "1px solid rgba(221,183,255,0.15)" }}>
          <p className="text-[13px] font-bold text-[#ddb7ff]">Ready to generate</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {[
              ["Name", form.name || "—"],
              ["Experience", `${form.experience.filter((e) => e.jobTitle && e.company).length} position(s)`],
              ["Education", `${form.education.filter((e) => e.degree && e.school).length} degree(s)`],
              ["Job target", form.jobDescription ? "Provided ✓" : "Not provided"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 text-[12px]">
                <span className="text-[#6b5b7a]">{k}:</span>
                <span className="text-[#988d9f] font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={isLoading}
          aria-label="Generate resume"
          className="w-full py-4 rounded-xl text-[15px] font-bold tracking-[0.02em] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
          style={{
            background: isLoading ? "rgba(221,183,255,0.12)" : "linear-gradient(135deg, #ddb7ff 0%, #4cd7f6 100%)",
            color: isLoading ? "#ddb7ff" : "#131313",
            boxShadow: isLoading ? "none" : "0 0 24px rgba(221,183,255,0.2)",
          }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-3">
              <span className="inline-block w-4 h-4 border-2 border-[#ddb7ff] border-t-transparent rounded-full animate-spin" />
              Building your resume…
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">auto_awesome</span>
              Generate Resume
            </span>
          )}
        </button>
      </div>
    ),
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mb-12 flex flex-col gap-8">

      {/* ── Progress bar ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          {STEPS.map((s) => {
            const isActive = step === s.id;
            const isDone   = step > s.id;
            return (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                aria-label={`Go to step ${s.id}: ${s.label}`}
                aria-current={isActive ? "step" : undefined}
                className="flex flex-col items-center gap-1.5 flex-1 transition-all"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200"
                  style={{
                    background: isDone
                      ? "rgba(76,215,246,0.15)"
                      : isActive
                      ? "rgba(221,183,255,0.2)"
                      : "rgba(255,255,255,0.05)",
                    border: `2px solid ${isDone ? "#4cd7f6" : isActive ? "#ddb7ff" : "rgba(255,255,255,0.1)"}`,
                  }}
                >
                  {isDone ? (
                    <span className="material-symbols-outlined text-[14px] text-[#4cd7f6]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                  ) : (
                    <span
                      className="material-symbols-outlined text-[14px]"
                      style={{ color: isActive ? "#ddb7ff" : "#4d4354", fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                    >
                      {s.icon}
                    </span>
                  )}
                </div>
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider hidden sm:block"
                  style={{ color: isDone ? "#4cd7f6" : isActive ? "#ddb7ff" : "#4d4354" }}
                >
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
        {/* Progress line */}
        <div className="h-1 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${((step - 1) / (STEPS.length - 1)) * 100}%`,
              background: "linear-gradient(90deg, #ddb7ff, #4cd7f6)",
            }}
          />
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid lg:grid-cols-2 gap-6 items-start">

        {/* ── LEFT: Form ── */}
        <div className="glass-panel rounded-2xl p-6">
          {stepContent[step]}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-6 pt-5 border-t border-[rgba(255,255,255,0.06)]">
            <button
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: "rgba(255,255,255,0.06)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span className="material-symbols-outlined text-[14px]">arrow_back</span>
              Back
            </button>
            {step < STEPS.length ? (
              <button
                onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-semibold transition-all"
                style={{ background: "rgba(221,183,255,0.12)", color: "#ddb7ff", border: "1px solid rgba(221,183,255,0.2)" }}
              >
                Next
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* ── RIGHT: Output ── */}
        <div ref={outputRef} className="flex flex-col gap-4">
          {!hasOutput && !isLoading && !errorMsg && (
            <div
              className="glass-panel rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-4"
              style={{ minHeight: "480px" }}
              aria-live="polite"
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(221,183,255,0.08)" }}>
                <span className="material-symbols-outlined text-[32px] text-[#ddb7ff]" style={{ fontVariationSettings: "'FILL' 0" }} aria-hidden="true">description</span>
              </div>
              <div>
                <p className="text-[16px] font-semibold text-[#e2e2e2] mb-1">Your resume will appear here</p>
                <p className="text-[13px] text-[#6b5b7a] max-w-[260px] leading-relaxed">
                  Fill in your details and click <strong className="text-[#9b8da8]">Generate Resume</strong> on the last step.
                </p>
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {isLoading && !hasOutput && (
            <div className="glass-panel rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.06)]" style={{ background: "rgba(0,0,0,0.2)" }}>
                <div className="h-4 w-40 rounded animate-pulse bg-[rgba(255,255,255,0.07)]" />
              </div>
              <div className="px-6 py-5 flex flex-col gap-3">
                {[100, 60, 90, 75, 85, 55, 80, 70, 90, 65].map((w, i) => (
                  <div key={i} className="h-3 rounded animate-pulse"
                    style={{ width: `${w}%`, background: "rgba(255,255,255,0.06)", animationDelay: `${i * 55}ms` }} />
                ))}
              </div>
            </div>
          )}

          {/* Output card */}
          {(hasOutput || (isLoading && resume)) && (
            <>
              <div className="glass-panel rounded-2xl overflow-hidden" aria-live="polite" aria-label="Generated resume">
                <div className="px-6 py-4 flex items-center gap-3 border-b border-[rgba(255,255,255,0.06)]" style={{ background: "rgba(0,0,0,0.2)" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(221,183,255,0.1)" }}>
                    <span className="material-symbols-outlined text-[16px] text-[#ddb7ff]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">description</span>
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#e2e2e2]">{form.name || "Resume"}</p>
                    <p className="text-[12px] text-[#6b5b7a] mt-0.5">ATS-optimized · Plain text</p>
                  </div>
                </div>
                <div className="px-6 py-5 max-h-[600px] overflow-y-auto">
                  <pre className="text-[13px] text-[#cfc2d6] leading-[1.8] whitespace-pre-wrap font-mono">
                    {resume}
                    {isLoading && (
                      <span className="inline-block w-0.5 h-4 bg-[#ddb7ff] ml-0.5 align-middle animate-pulse" aria-hidden="true" />
                    )}
                  </pre>
                </div>
              </div>

              {hasOutput && !isLoading && (
                <div className="flex flex-wrap gap-2">
                  <ActionButton onClick={handleCopy} icon="content_copy" label="Copy" active={copied} activeIcon="check" activeLabel="Copied!" />
                  <ActionButton onClick={handleDownloadTxt} icon="download" label="Download TXT" active={downloaded} activeIcon="check" activeLabel="Saved!" />
                  <ActionButton onClick={handleDownloadPdf} icon="picture_as_pdf" label="Download PDF" />
                  <ActionButton onClick={generate} icon="refresh" label="Regenerate" />
                  <ActionButton onClick={handleStartOver} icon="restart_alt" label="Start Over" />
                </div>
              )}
            </>
          )}

          {errorMsg && !isLoading && (
            <div className="glass-panel rounded-2xl p-6 flex flex-col gap-3" role="alert" style={{ border: "1px solid rgba(239,68,68,0.3)" }}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#ef4444]" aria-hidden="true">error</span>
                <p className="text-[14px] font-semibold text-[#ef4444]">Generation failed</p>
              </div>
              <p className="text-[13px] text-[#9b8da8]">{errorMsg}</p>
              <button onClick={generate} className="self-start flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold"
                style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                <span className="material-symbols-outlined text-[14px]">refresh</span> Try again
              </button>
            </div>
          )}

          <p className="text-[12px] text-[#4d4354] px-1">
            Your data is auto-saved locally. It is never sent to any server until you click Generate.
          </p>
        </div>
      </div>
    </div>
  );
}

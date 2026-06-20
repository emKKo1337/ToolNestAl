"use client";

import { useState, useCallback } from "react";

type Status = "idle" | "sending" | "success" | "error";

const SUBJECTS = [
  "General Inquiry",
  "Bug Report",
  "Feature Request",
  "Business / Partnership",
  "Press & Media",
  "Other",
];

export default function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", subject: SUBJECTS[0], message: "" });
  const [errors, setErrors] = useState<Partial<typeof form>>({});
  const [status, setStatus] = useState<Status>("idle");

  const validate = useCallback(() => {
    const e: Partial<typeof form> = {};
    if (!form.name.trim()) e.name = "Name is required.";
    if (!form.email.trim()) {
      e.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = "Enter a valid email address.";
    }
    if (!form.message.trim()) e.message = "Message is required.";
    else if (form.message.trim().length < 20) e.message = "Message must be at least 20 characters.";
    return e;
  }, [form]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setForm((prev) => ({ ...prev, [name]: value }));
      if (errors[name as keyof typeof errors]) {
        setErrors((prev) => ({ ...prev, [name]: undefined }));
      }
    },
    [errors]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const errs = validate();
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        return;
      }
      setStatus("sending");
      // Simulate async send (replace with real API call)
      await new Promise((r) => setTimeout(r, 1200));
      // For demo purposes always succeed — swap for real fetch() to your endpoint
      setStatus("success");
    },
    [validate]
  );

  const handleReset = () => {
    setForm({ name: "", email: "", subject: SUBJECTS[0], message: "" });
    setErrors({});
    setStatus("idle");
  };

  if (status === "success") {
    return (
      <div className="glass-panel rounded-3xl p-10 flex flex-col items-center text-center gap-6">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(76,215,246,0.1)" }}
        >
          <span
            className="material-symbols-outlined text-[32px] text-[#4cd7f6]"
            style={{ fontVariationSettings: "'FILL' 1" }}
            aria-hidden="true"
          >
            check_circle
          </span>
        </div>
        <div>
          <p className="text-[20px] font-bold text-[#e2e2e2] mb-2">Message sent!</p>
          <p className="text-[14px] text-[#7a6d84] max-w-xs">
            Thanks for reaching out. We&apos;ll get back to you at{" "}
            <span className="text-[#ddb7ff]">{form.email}</span> within 1–2 business days.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="glass-panel px-6 py-2.5 rounded-xl text-[14px] font-semibold text-[#cfc2d6] hover:text-[#ddb7ff] transition-colors"
        >
          Send another message
        </button>
      </div>
    );
  }

  const field =
    "bg-transparent w-full text-[14px] text-[#e2e2e2] placeholder:text-[#4d4354] outline-none";

  const wrap = (hasError?: string) =>
    `glass-panel rounded-xl px-4 py-3 flex items-start gap-3 transition-colors ${
      hasError ? "border-[rgba(255,100,130,0.4)]" : ""
    }`;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {/* Name */}
      <div>
        <div className={wrap(errors.name)}>
          <span
            className="material-symbols-outlined text-[18px] text-[#5a4d63] mt-0.5 flex-shrink-0"
            aria-hidden="true"
          >
            person
          </span>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Your name"
            autoComplete="name"
            aria-label="Your name"
            aria-invalid={!!errors.name}
            className={field}
          />
        </div>
        {errors.name && <p className="text-[12px] text-[#ff6482] mt-1.5 ml-1">{errors.name}</p>}
      </div>

      {/* Email */}
      <div>
        <div className={wrap(errors.email)}>
          <span
            className="material-symbols-outlined text-[18px] text-[#5a4d63] mt-0.5 flex-shrink-0"
            aria-hidden="true"
          >
            mail
          </span>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="your@email.com"
            autoComplete="email"
            aria-label="Email address"
            aria-invalid={!!errors.email}
            className={field}
          />
        </div>
        {errors.email && <p className="text-[12px] text-[#ff6482] mt-1.5 ml-1">{errors.email}</p>}
      </div>

      {/* Subject */}
      <div className={wrap()}>
        <span
          className="material-symbols-outlined text-[18px] text-[#5a4d63] mt-0.5 flex-shrink-0"
          aria-hidden="true"
        >
          label
        </span>
        <select
          name="subject"
          value={form.subject}
          onChange={handleChange}
          aria-label="Subject"
          className={`${field} cursor-pointer`}
          style={{ background: "transparent" }}
        >
          {SUBJECTS.map((s) => (
            <option key={s} value={s} style={{ background: "#1a1320", color: "#e2e2e2" }}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Message */}
      <div>
        <div className={`${wrap(errors.message)} items-start`}>
          <span
            className="material-symbols-outlined text-[18px] text-[#5a4d63] mt-0.5 flex-shrink-0"
            aria-hidden="true"
          >
            chat
          </span>
          <textarea
            name="message"
            value={form.message}
            onChange={handleChange}
            placeholder="Tell us how we can help…"
            rows={5}
            aria-label="Message"
            aria-invalid={!!errors.message}
            className={`${field} resize-none`}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5 ml-1">
          {errors.message ? (
            <p className="text-[12px] text-[#ff6482]">{errors.message}</p>
          ) : (
            <span />
          )}
          <p className="text-[11px] text-[#4d4354]">{form.message.length} / 2000</p>
        </div>
      </div>

      {/* Error banner */}
      {status === "error" && (
        <div
          className="rounded-xl px-4 py-3 text-[13px] text-[#ff6482]"
          style={{ background: "rgba(255,100,130,0.08)", border: "1px solid rgba(255,100,130,0.2)" }}
        >
          Something went wrong. Please try again or email us directly at{" "}
          <a href="mailto:contact@toolnestai.net" className="underline">
            contact@toolnestai.net
          </a>
          .
        </div>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="btn-primary text-white font-semibold px-6 py-3 rounded-xl text-[14px] flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {status === "sending" ? (
          <>
            <span
              className="material-symbols-outlined text-[16px] animate-spin"
              aria-hidden="true"
            >
              progress_activity
            </span>
            Sending…
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              send
            </span>
            Send Message
          </>
        )}
      </button>
    </form>
  );
}

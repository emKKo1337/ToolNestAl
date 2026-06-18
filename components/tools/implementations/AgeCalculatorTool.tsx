"use client";

import { useState, useMemo } from "react";

function calcAge(dob: Date, target: Date) {
  let years = target.getFullYear() - dob.getFullYear();
  let months = target.getMonth() - dob.getMonth();
  let days = target.getDate() - dob.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(target.getFullYear(), target.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) { years--; months += 12; }

  const totalDays = Math.floor((target.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24));
  const totalMonths = years * 12 + months;
  const totalWeeks = Math.floor(totalDays / 7);
  const totalHours = totalDays * 24;
  const totalMinutes = totalHours * 60;

  return { years, months, days, totalDays, totalMonths, totalWeeks, totalHours, totalMinutes };
}

function nextBirthday(dob: Date, from: Date) {
  const next = new Date(from.getFullYear(), dob.getMonth(), dob.getDate());
  if (next <= from) next.setFullYear(next.getFullYear() + 1);
  const diff = Math.ceil((next.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  return { date: next, daysUntil: diff };
}

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const ZODIAC = [
  { name: "Capricorn", emoji: "♑", start: [12, 22], end: [1, 19] },
  { name: "Aquarius", emoji: "♒", start: [1, 20], end: [2, 18] },
  { name: "Pisces", emoji: "♓", start: [2, 19], end: [3, 20] },
  { name: "Aries", emoji: "♈", start: [3, 21], end: [4, 19] },
  { name: "Taurus", emoji: "♉", start: [4, 20], end: [5, 20] },
  { name: "Gemini", emoji: "♊", start: [5, 21], end: [6, 20] },
  { name: "Cancer", emoji: "♋", start: [6, 21], end: [7, 22] },
  { name: "Leo", emoji: "♌", start: [7, 23], end: [8, 22] },
  { name: "Virgo", emoji: "♍", start: [8, 23], end: [9, 22] },
  { name: "Libra", emoji: "♎", start: [9, 23], end: [10, 22] },
  { name: "Scorpio", emoji: "♏", start: [10, 23], end: [11, 21] },
  { name: "Sagittarius", emoji: "♐", start: [11, 22], end: [12, 21] },
];

function getZodiac(dob: Date) {
  const m = dob.getMonth() + 1;
  const d = dob.getDate();
  for (const z of ZODIAC) {
    const [sm, sd] = z.start;
    const [em, ed] = z.end;
    if ((m === sm && d >= sd) || (m === em && d <= ed)) return z;
  }
  return ZODIAC[0];
}

interface StatRowProps { label: string; value: string; icon: string; color: string; }
function StatRow({ label, value, icon, color }: StatRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[rgba(255,255,255,0.05)] last:border-0">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-[18px]" style={{ color }} aria-hidden="true">{icon}</span>
        <span className="text-[15px] text-[#cfc2d6]">{label}</span>
      </div>
      <span className="text-[15px] font-bold text-[#e2e2e2]">{value}</span>
    </div>
  );
}

export default function AgeCalculatorTool() {
  const today = new Date();
  const [dob, setDob] = useState("");
  const [targetDate, setTargetDate] = useState(toDateInputValue(today));

  // Derive both result and error message from state — never call setState inside useMemo
  const { result, errorMsg } = useMemo(() => {
    if (!dob || !targetDate) return { result: null, errorMsg: "" };
    const dobDate = new Date(dob + "T00:00:00");
    const targetDt = new Date(targetDate + "T00:00:00");
    if (isNaN(dobDate.getTime()) || isNaN(targetDt.getTime())) return { result: null, errorMsg: "" };
    if (dobDate > targetDt) return { result: null, errorMsg: "Date of birth cannot be after the target date." };
    const age = calcAge(dobDate, targetDt);
    const bday = nextBirthday(dobDate, targetDt);
    const zodiac = getZodiac(dobDate);
    return { result: { age, bday, zodiac, dobDate }, errorMsg: "" };
  }, [dob, targetDate]);

  return (
    <div className="mb-12 flex flex-col gap-6">
      {/* Inputs */}
      <div className="glass-panel rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="dob" className="text-[14px] font-semibold text-[#e2e2e2]">Date of Birth</label>
          <input
            id="dob"
            type="date"
            value={dob}
            max={toDateInputValue(today)}
            onChange={(e) => setDob(e.target.value)}
            className="bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-[15px] text-[#e2e2e2] focus:outline-none focus:border-[#ddb7ff] transition-colors"
            style={{ colorScheme: "dark" }}
            aria-required="true"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="target" className="text-[14px] font-semibold text-[#e2e2e2]">Age At Date</label>
          <input
            id="target"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-[15px] text-[#e2e2e2] focus:outline-none focus:border-[#ddb7ff] transition-colors"
            style={{ colorScheme: "dark" }}
          />
        </div>
        {errorMsg && (
          <p className="col-span-full text-[13px] text-[#ef4444] flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error</span>{errorMsg}
          </p>
        )}
      </div>

      {result ? (
        <>
          {/* Primary result */}
          <div className="glass-panel rounded-2xl p-6 md:p-8">
            <p className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.08em] mb-5">Your Age</p>
            <div className="grid grid-cols-3 gap-4 mb-2">
              {[
                { value: result.age.years, label: "Years", color: "#ddb7ff" },
                { value: result.age.months, label: "Months", color: "#4cd7f6" },
                { value: result.age.days, label: "Days", color: "#adc6ff" },
              ].map(({ value, label, color }) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <span className="text-[40px] md:text-[56px] font-extrabold tracking-tight leading-none" style={{ color }}>
                    {value}
                  </span>
                  <span className="text-[13px] text-[#988d9f] font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Extended stats */}
          <div className="glass-panel rounded-2xl p-6">
            <p className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.08em] mb-2">Breakdown</p>
            <StatRow label="Total days lived" value={result.age.totalDays.toLocaleString()} icon="calendar_today" color="#ddb7ff" />
            <StatRow label="Total weeks" value={result.age.totalWeeks.toLocaleString()} icon="date_range" color="#4cd7f6" />
            <StatRow label="Total months" value={result.age.totalMonths.toLocaleString()} icon="event" color="#adc6ff" />
            <StatRow label="Total hours" value={result.age.totalHours.toLocaleString()} icon="schedule" color="#ffb4ab" />
            <StatRow label="Total minutes" value={result.age.totalMinutes.toLocaleString()} icon="timer" color="#988d9f" />
          </div>

          {/* Next birthday + zodiac */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-[20px] text-[#ddb7ff]">cake</span>
                <span className="text-[14px] font-semibold text-[#e2e2e2]">Next Birthday</span>
              </div>
              <span className="text-[28px] font-extrabold text-[#ddb7ff]">
                {result.bday.daysUntil === 0 ? "Today! 🎉" : `${result.bday.daysUntil} days`}
              </span>
              <span className="text-[13px] text-[#988d9f]">
                {result.bday.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </span>
            </div>
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[20px]">{result.zodiac.emoji}</span>
                <span className="text-[14px] font-semibold text-[#e2e2e2]">Zodiac Sign</span>
              </div>
              <span className="text-[28px] font-extrabold text-[#4cd7f6]">{result.zodiac.name}</span>
              <span className="text-[13px] text-[#988d9f]">
                Born on {result.dobDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="glass-panel rounded-2xl p-10 flex flex-col items-center justify-center gap-3 text-center">
          <span className="material-symbols-outlined text-[48px] text-[#4d4354]">cake</span>
          <p className="text-[16px] text-[#4d4354]">Enter your date of birth to see your age breakdown</p>
        </div>
      )}
    </div>
  );
}

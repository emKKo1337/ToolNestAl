"use client";

import { useState, useMemo } from "react";

type Unit = "metric" | "imperial";

interface BMIResult {
  bmi: number;
  category: string;
  color: string;
  min: number;
  max: number;
  advice: string;
}

function calcBMI(weight: number, height: number): number {
  if (!weight || !height) return 0;
  return weight / (height / 100) ** 2;
}

function categorize(bmi: number): BMIResult {
  const base = { bmi, min: 0, max: 0, color: "", category: "", advice: "" };
  if (bmi < 18.5) return { ...base, category: "Underweight", color: "#3b82f6", min: 0, max: 18.5, advice: "You may benefit from increased caloric intake. Consult a healthcare provider for personalized guidance." };
  if (bmi < 25) return { ...base, category: "Normal weight", color: "#22c55e", min: 18.5, max: 24.9, advice: "Great work! Your BMI is in the healthy range. Maintain a balanced diet and regular physical activity." };
  if (bmi < 30) return { ...base, category: "Overweight", color: "#f59e0b", min: 25, max: 29.9, advice: "Small lifestyle adjustments — more movement and mindful eating — can make a significant difference." };
  return { ...base, category: "Obese", color: "#ef4444", min: 30, max: 40, advice: "Consult a healthcare provider to discuss a healthy weight-loss plan tailored to your needs." };
}

// Gauge needle position: BMI 15–40 maps to 0–180 degrees
function bmiToDeg(bmi: number): number {
  const clamped = Math.min(40, Math.max(15, bmi));
  return ((clamped - 15) / 25) * 180;
}

const GAUGE_SEGMENTS = [
  { color: "#3b82f6", label: "Under", sweep: 43 },  // <18.5
  { color: "#22c55e", label: "Normal", sweep: 46 }, // 18.5–24.9
  { color: "#f59e0b", label: "Over", sweep: 40 },   // 25–29.9
  { color: "#ef4444", label: "Obese", sweep: 51 },  // 30–40
];

function GaugeSVG({ bmi }: { bmi: number }) {
  const deg = bmiToDeg(bmi);
  const rad = ((deg - 180) * Math.PI) / 180;
  const cx = 110, cy = 110, r = 85;
  const nx = cx + r * 0.7 * Math.cos(rad);
  const ny = cy + r * 0.7 * Math.sin(rad);

  // Draw arcs for each segment
  function arcPath(startDeg: number, endDeg: number) {
    const toRad = (d: number) => ((d - 180) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startDeg));
    const y1 = cy + r * Math.sin(toRad(startDeg));
    const x2 = cx + r * Math.cos(toRad(endDeg));
    const y2 = cy + r * Math.sin(toRad(endDeg));
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  }

  const { segPaths } = GAUGE_SEGMENTS.reduce<{
    segPaths: Array<typeof GAUGE_SEGMENTS[number] & { path: string }>;
    deg: number;
  }>(
    ({ segPaths: paths, deg }, seg) => {
      const end = deg + seg.sweep;
      return { segPaths: [...paths, { ...seg, path: arcPath(deg, end) }], deg: end };
    },
    { segPaths: [], deg: 0 }
  );

  return (
    <svg viewBox="0 0 220 120" className="w-full max-w-[280px]" aria-hidden="true">
      {/* Background track */}
      <path d={arcPath(0, 180)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={18} strokeLinecap="round" />
      {/* Coloured segments */}
      {segPaths.map((s) => (
        <path key={s.label} d={s.path} fill="none" stroke={s.color} strokeWidth={14} strokeLinecap="butt" opacity={0.85} />
      ))}
      {/* Needle */}
      {bmi > 0 && (
        <>
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#e2e2e2" strokeWidth={3} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={6} fill="#e2e2e2" />
        </>
      )}
    </svg>
  );
}

export default function BmiCalculatorTool() {
  const [unit, setUnit] = useState<Unit>("metric");
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightLbs, setWeightLbs] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const { result, errorMsg } = useMemo<{ result: BMIResult | null; errorMsg: string }>(() => {
    let weight = 0, height = 0;
    if (unit === "metric") {
      weight = parseFloat(weightKg);
      height = parseFloat(heightCm);
    } else {
      const lbs = parseFloat(weightLbs);
      const ft = parseFloat(heightFt) || 0;
      const inches = parseFloat(heightIn) || 0;
      weight = lbs * 0.453592;
      height = (ft * 12 + inches) * 2.54;
    }

    if (!weight || !height) return { result: null, errorMsg: "" };
    if (weight <= 0 || height <= 0) return { result: null, errorMsg: "Values must be greater than zero." };
    if (weight > 500 || height > 300) return { result: null, errorMsg: "Please enter realistic values." };
    const bmi = calcBMI(weight, height);
    return { result: categorize(bmi), errorMsg: "" };
  }, [unit, weightKg, heightCm, weightLbs, heightFt, heightIn]);

  const bmiVal = result?.bmi ?? 0;

  // Healthy weight range for current height
  const healthyRange = useMemo(() => {
    let height = 0;
    if (unit === "metric") {
      height = parseFloat(heightCm);
    } else {
      const ft = parseFloat(heightFt) || 0;
      const inches = parseFloat(heightIn) || 0;
      height = (ft * 12 + inches) * 2.54;
    }
    if (!height) return null;
    const minKg = 18.5 * (height / 100) ** 2;
    const maxKg = 24.9 * (height / 100) ** 2;
    if (unit === "metric") return { min: minKg.toFixed(1), max: maxKg.toFixed(1), unit: "kg" };
    return { min: (minKg / 0.453592).toFixed(1), max: (maxKg / 0.453592).toFixed(1), unit: "lbs" };
  }, [unit, heightCm, heightFt, heightIn]);

  return (
    <div className="mb-12 flex flex-col gap-6">
      {/* Unit toggle */}
      <div className="glass-panel rounded-2xl p-5">
        <p className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.08em] mb-3">Unit System</p>
        <div className="flex gap-2">
          {(["metric", "imperial"] as Unit[]).map((u) => (
            <button
              key={u}
              onClick={() => setUnit(u)}
              aria-pressed={unit === u}
              className="px-5 py-2.5 rounded-xl text-[14px] font-semibold capitalize transition-all duration-200"
              style={{
                background: unit === u ? "rgba(221,183,255,0.15)" : "rgba(255,255,255,0.04)",
                color: unit === u ? "#ddb7ff" : "#988d9f",
                border: `1px solid ${unit === u ? "rgba(221,183,255,0.35)" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              {u} {u === "metric" ? "(kg / cm)" : "(lbs / ft)"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-5">
          {unit === "metric" ? (
            <>
              <div className="flex flex-col gap-2">
                <label htmlFor="height-cm" className="text-[14px] font-semibold text-[#e2e2e2]">Height (cm)</label>
                <input
                  id="height-cm"
                  type="number"
                  min={50} max={300}
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  placeholder="e.g. 175"
                  className="bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-[16px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#ddb7ff] transition-colors"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="weight-kg" className="text-[14px] font-semibold text-[#e2e2e2]">Weight (kg)</label>
                <input
                  id="weight-kg"
                  type="number"
                  min={1} max={500}
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  placeholder="e.g. 70"
                  className="bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-[16px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#ddb7ff] transition-colors"
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <label className="text-[14px] font-semibold text-[#e2e2e2]">Height</label>
                <div className="flex gap-3">
                  <input
                    type="number"
                    min={1} max={9}
                    value={heightFt}
                    onChange={(e) => setHeightFt(e.target.value)}
                    placeholder="ft"
                    className="bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-[16px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#ddb7ff] transition-colors w-full"
                    aria-label="Height in feet"
                  />
                  <input
                    type="number"
                    min={0} max={11}
                    value={heightIn}
                    onChange={(e) => setHeightIn(e.target.value)}
                    placeholder="in"
                    className="bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-[16px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#ddb7ff] transition-colors w-full"
                    aria-label="Height in inches"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="weight-lbs" className="text-[14px] font-semibold text-[#e2e2e2]">Weight (lbs)</label>
                <input
                  id="weight-lbs"
                  type="number"
                  min={1} max={1200}
                  value={weightLbs}
                  onChange={(e) => setWeightLbs(e.target.value)}
                  placeholder="e.g. 154"
                  className="bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-[16px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#ddb7ff] transition-colors"
                />
              </div>
            </>
          )}

          {errorMsg && (
            <p className="text-[13px] text-[#ef4444] flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>{errorMsg}
            </p>
          )}
        </div>

        {/* Result */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col items-center justify-center gap-4" aria-live="polite">
          <GaugeSVG bmi={bmiVal} />

          {result ? (
            <>
              <div className="text-center">
                <span className="text-[56px] font-extrabold leading-none tracking-tight" style={{ color: result.color }}>
                  {result.bmi.toFixed(1)}
                </span>
                <p className="text-[14px] text-[#988d9f] mt-1">BMI</p>
              </div>
              <span
                className="px-4 py-1.5 rounded-full text-[14px] font-bold"
                style={{ background: `${result.color}22`, color: result.color, border: `1px solid ${result.color}44` }}
              >
                {result.category}
              </span>
              {healthyRange && (
                <p className="text-[13px] text-[#988d9f] text-center">
                  Healthy range: <span className="text-[#e2e2e2] font-semibold">{healthyRange.min}–{healthyRange.max} {healthyRange.unit}</span>
                </p>
              )}
              <p className="text-[13px] text-[#988d9f] text-center max-w-xs leading-relaxed">{result.advice}</p>
            </>
          ) : (
            <div className="text-center">
              <p className="text-[15px] text-[#4d4354]">Enter your height and weight to calculate BMI</p>
            </div>
          )}
        </div>
      </div>

      {/* Category reference */}
      <div className="glass-panel rounded-2xl p-5">
        <p className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.08em] mb-4">BMI Categories</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Underweight", range: "< 18.5", color: "#3b82f6" },
            { label: "Normal", range: "18.5 – 24.9", color: "#22c55e" },
            { label: "Overweight", range: "25 – 29.9", color: "#f59e0b" },
            { label: "Obese", range: "≥ 30", color: "#ef4444" },
          ].map((cat) => (
            <div key={cat.label} className="flex flex-col gap-1 p-3 rounded-xl" style={{ background: `${cat.color}12`, border: `1px solid ${cat.color}28` }}>
              <span className="text-[12px] font-bold" style={{ color: cat.color }}>{cat.label}</span>
              <span className="text-[13px] text-[#988d9f]">{cat.range}</span>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-[#4d4354] mt-3">* BMI is a screening tool, not a diagnostic measure. Consult a healthcare professional for medical advice.</p>
      </div>
    </div>
  );
}

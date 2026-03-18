"use client";

import { useState, type FormEvent } from "react";

interface ReturnData {
  employeeSeasonId: number;
  status: string;
  alreadyResponded: boolean;
  responseDate: string | null;
  longevityYears: number;
  employeeName: string;
  email: string;
  season: {
    name: string;
    year: number;
    startDate: string;
    endDate: string;
  };
}

interface Props {
  data: ReturnData;
  token: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function ReturnForm({ data, token }: Props) {
  const [returning, setReturning] = useState<boolean | null>(null);
  const [signature, setSignature] = useState("");
  const [comments, setComments] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState("");

  if (data.alreadyResponded) {
    const accepted = data.status === "returning";
    return (
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-8 text-center">
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${accepted ? "bg-success-100" : "bg-gray-100"}`}>
          <svg className={`h-7 w-7 ${accepted ? "text-success-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={accepted ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Already Responded</h2>
        <p className="text-sm text-gray-500">
          You {accepted ? "confirmed your return" : "declined your return"} for {data.season.name}{" "}
          {data.responseDate ? `on ${fmtDate(data.responseDate)}` : ""}.
        </p>
        <p className="mt-2 text-xs text-gray-400">
          If you made a mistake, please contact your supervisor directly.
        </p>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-10 text-center">
        <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${returning ? "bg-success-100" : "bg-gray-100"}`}>
          <svg className={`h-8 w-8 ${returning ? "text-success-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={returning ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Response Recorded</h2>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">{result}</p>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (returning === null) { setErrorMsg("Please select whether you are returning."); return; }
    if (!signature.trim()) { setErrorMsg("Please type your full name as your electronic signature."); return; }

    setState("submitting");
    setErrorMsg("");

    try {
      const res = await fetch(`/api/public/return/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returning, signatureText: signature, comments }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error ?? json.message ?? "Submission failed. Please try again.");
        setState("error");
      } else {
        setResult(json.message ?? "");
        setState("success");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setState("error");
    }
  }

  const inputClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

  return (
    <div>
      {/* Greeting card */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 mb-6">
        <p className="text-lg font-semibold text-gray-900">
          Hi {data.employeeName}! 👋
        </p>
        <p className="mt-1 text-sm text-gray-600">
          You&apos;re invited to return for the <strong>{data.season.name}</strong> season.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
          <span>📅 {fmtDate(data.season.startDate)} – {fmtDate(data.season.endDate)}</span>
          {data.longevityYears > 0 && (
            <span>⭐ {data.longevityYears} year{data.longevityYears !== 1 ? "s" : ""} with us</span>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">
              Will you be returning for {data.season.name}? <span className="text-error-500">*</span>
            </p>
            <div className="flex flex-col gap-2">
              {[
                { value: true, label: "Yes, I'm returning this season! 🙌", color: "border-success-300 bg-success-50" },
                { value: false, label: "No, I won't be returning this season", color: "border-gray-200 bg-gray-50" },
              ].map(({ value, label, color }) => (
                <label
                  key={String(value)}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                    returning === value ? color : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="returning"
                    value={String(value)}
                    checked={returning === value}
                    onChange={() => setReturning(value)}
                    className="text-brand-500"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Electronic Signature <span className="text-error-500">*</span>
            </label>
            <input
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className={inputClass}
              placeholder="Type your full legal name"
            />
            <p className="mt-1 text-xs text-gray-400">
              By typing your name, you confirm this response is your own.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Comments <span className="text-xs text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Anything else you'd like us to know…"
            />
          </div>

          {(state === "error" || errorMsg) && (
            <div className="rounded-lg bg-error-50 border border-error-200 px-4 py-3 text-sm text-error-700">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={state === "submitting"}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ background: "linear-gradient(90deg, #465fff, #3641f5)" }}
          >
            {state === "submitting" ? "Submitting…" : "Submit Response"}
          </button>
        </form>
      </div>
    </div>
  );
}

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
      <div className="ap-rounded-2xl ap-bg-white ap-border ap-border-gray-100 ap-shadow-sm ap-p-8 ap-text-center">
        <div className={`ap-mx-auto ap-mb-4 ap-flex ap-h-14 ap-w-14 ap-items-center ap-justify-center ap-rounded-full ${accepted ? "ap-bg-success-100" : "ap-bg-gray-100"}`}>
          <svg className={`ap-h-7 ap-w-7 ${accepted ? "ap-text-success-600" : "ap-text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={accepted ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
          </svg>
        </div>
        <h2 className="ap-text-lg ap-font-bold ap-text-gray-900 ap-mb-1">Already Responded</h2>
        <p className="ap-text-sm ap-text-gray-500">
          You {accepted ? "confirmed your return" : "declined your return"} for {data.season.name}{" "}
          {data.responseDate ? `on ${fmtDate(data.responseDate)}` : ""}.
        </p>
        <p className="ap-mt-2 ap-text-xs ap-text-gray-400">
          If you made a mistake, please contact your supervisor directly.
        </p>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="ap-rounded-2xl ap-bg-white ap-border ap-border-gray-100 ap-shadow-sm ap-p-10 ap-text-center">
        <div className={`ap-mx-auto ap-mb-5 ap-flex ap-h-16 ap-w-16 ap-items-center ap-justify-center ap-rounded-full ${returning ? "ap-bg-success-100" : "ap-bg-gray-100"}`}>
          <svg className={`ap-h-8 ap-w-8 ${returning ? "ap-text-success-600" : "ap-text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={returning ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
          </svg>
        </div>
        <h2 className="ap-text-xl ap-font-bold ap-text-gray-900 ap-mb-2">Response Recorded</h2>
        <p className="ap-text-sm ap-text-gray-500 ap-max-w-sm ap-mx-auto">{result}</p>
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

  const inputClass = "ap-w-full ap-rounded-lg ap-border ap-border-gray-300 ap-bg-white ap-px-3 ap-py-2 ap-text-sm ap-text-gray-900 focus:ap-border-brand-500 focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-brand-500/20";

  return (
    <div>
      {/* Greeting card */}
      <div className="ap-rounded-2xl ap-bg-white ap-border ap-border-gray-100 ap-shadow-sm ap-p-6 ap-mb-6">
        <p className="ap-text-lg ap-font-semibold ap-text-gray-900">
          Hi {data.employeeName}! 👋
        </p>
        <p className="ap-mt-1 ap-text-sm ap-text-gray-600">
          You&apos;re invited to return for the <strong>{data.season.name}</strong> season.
        </p>
        <div className="ap-mt-3 ap-flex ap-flex-wrap ap-gap-3 ap-text-xs ap-text-gray-500">
          <span>📅 {fmtDate(data.season.startDate)} – {fmtDate(data.season.endDate)}</span>
          {data.longevityYears > 0 && (
            <span>⭐ {data.longevityYears} year{data.longevityYears !== 1 ? "s" : ""} with us</span>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="ap-rounded-2xl ap-bg-white ap-border ap-border-gray-100 ap-shadow-sm ap-p-8">
        <form onSubmit={handleSubmit} className="ap-space-y-6">
          <div>
            <p className="ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-3">
              Will you be returning for {data.season.name}? <span className="ap-text-error-500">*</span>
            </p>
            <div className="ap-flex ap-flex-col ap-gap-2">
              {[
                { value: true, label: "Yes, I'm returning this season! 🙌", color: "ap-border-success-300 ap-bg-success-50" },
                { value: false, label: "No, I won't be returning this season", color: "ap-border-gray-200 ap-bg-gray-50" },
              ].map(({ value, label, color }) => (
                <label
                  key={String(value)}
                  className={`ap-flex ap-items-center ap-gap-3 ap-rounded-lg ap-border ap-px-4 ap-py-3 ap-cursor-pointer ap-transition-colors ${
                    returning === value ? color : "ap-border-gray-200 hover:ap-bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="returning"
                    value={String(value)}
                    checked={returning === value}
                    onChange={() => setReturning(value)}
                    className="ap-text-brand-500"
                  />
                  <span className="ap-text-sm ap-text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
              Electronic Signature <span className="ap-text-error-500">*</span>
            </label>
            <input
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className={inputClass}
              placeholder="Type your full legal name"
            />
            <p className="ap-mt-1 ap-text-xs ap-text-gray-400">
              By typing your name, you confirm this response is your own.
            </p>
          </div>

          <div>
            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
              Additional Comments <span className="ap-text-xs ap-text-gray-400 ap-font-normal">(optional)</span>
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
            <div className="ap-rounded-lg ap-bg-error-50 ap-border ap-border-error-200 ap-px-4 ap-py-3 ap-text-sm ap-text-error-700">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={state === "submitting"}
            className="ap-w-full ap-rounded-lg ap-px-4 ap-py-2.5 ap-text-sm ap-font-semibold ap-text-white ap-transition-opacity disabled:ap-opacity-60"
            style={{ background: "linear-gradient(90deg, #465fff, #3641f5)" }}
          >
            {state === "submitting" ? "Submitting…" : "Submit Response"}
          </button>
        </form>
      </div>
    </div>
  );
}

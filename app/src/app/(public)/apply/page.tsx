"use client";

import { useState, type FormEvent } from "react";

const POSITIONS = [
  "Lifeguard",
  "Head Lifeguard",
  "Swim Instructor",
  "Head Swim Instructor / Lesson Coordinator",
  "Pool Cashier",
  "Camp Counselor",
  "Camp Director",
  "Aquatics Director",
  "Other",
];

type State = "idle" | "submitting" | "success" | "error";

const inputClass =
  "ap-w-full ap-rounded-lg ap-border ap-border-gray-300 ap-bg-white ap-px-3 ap-py-2 ap-text-sm ap-text-gray-900 ap-placeholder-gray-400 focus:ap-border-brand-500 focus:ap-outline-none focus:ap-ring-2 focus:ap-ring-brand-500/20";

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
        {label}
        {required && <span className="ap-text-error-500 ap-ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="ap-mt-1 ap-text-xs ap-text-gray-400">{hint}</p>}
    </div>
  );
}

export default function ApplyPage() {
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("submitting");
    setErrorMsg("");

    const fd = new FormData(e.currentTarget);
    const body = {
      firstName: fd.get("firstName"),
      lastName: fd.get("lastName"),
      email: fd.get("email"),
      phone: fd.get("phone"),
      dateOfBirth: fd.get("dateOfBirth"),
      address: fd.get("address"),
      position: fd.get("position"),
      needsWorkPermit: fd.get("needsWorkPermit") === "on",
    };

    try {
      const res = await fetch("/api/public/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error ?? json.message ?? "Submission failed. Please try again.");
        setState("error");
      } else {
        setState("success");
      }
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="ap-rounded-2xl ap-bg-white ap-border ap-border-gray-100 ap-shadow-sm ap-p-10 ap-text-center">
        <div className="ap-mx-auto ap-mb-5 ap-flex ap-h-16 ap-w-16 ap-items-center ap-justify-center ap-rounded-full ap-bg-success-100">
          <svg className="ap-h-8 ap-w-8 ap-text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="ap-text-xl ap-font-bold ap-text-gray-900 ap-mb-2">Application Submitted!</h2>
        <p className="ap-text-sm ap-text-gray-500 ap-max-w-sm ap-mx-auto">
          Thank you for applying. We&apos;ll review your application and reach out to you soon.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="ap-mb-8">
        <h1 className="ap-text-2xl ap-font-bold ap-tracking-tight ap-text-gray-900">Join Our Team</h1>
        <p className="ap-mt-1 ap-text-sm ap-text-gray-500">
          Fill out the form below to apply for a position with AquaticPro.
        </p>
      </div>

      <div className="ap-rounded-2xl ap-bg-white ap-border ap-border-gray-100 ap-shadow-sm ap-p-8">
        <form onSubmit={handleSubmit} className="ap-space-y-5">
          <div className="ap-grid ap-grid-cols-2 ap-gap-4">
            <Field label="First Name" required>
              <input name="firstName" type="text" required autoComplete="given-name" className={inputClass} placeholder="Jane" />
            </Field>
            <Field label="Last Name" required>
              <input name="lastName" type="text" required autoComplete="family-name" className={inputClass} placeholder="Smith" />
            </Field>
          </div>

          <Field label="Email Address" required>
            <input name="email" type="email" required autoComplete="email" className={inputClass} placeholder="you@example.com" />
          </Field>

          <Field label="Phone Number" hint="Optional — helpful for scheduling interviews.">
            <input name="phone" type="tel" autoComplete="tel" className={inputClass} placeholder="(555) 555-5555" />
          </Field>

          <Field label="Date of Birth" hint="Required for positions with age minimums (e.g. 15+ for lifeguard).">
            <input name="dateOfBirth" type="date" className={inputClass} />
          </Field>

          <Field label="Home Address">
            <textarea name="address" rows={2} className={inputClass} placeholder="123 Main St, City, State 12345" />
          </Field>

          <Field label="Position Applying For" required>
            <select name="position" required className={inputClass}>
              <option value="">Select a position…</option>
              {POSITIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>

          <div className="ap-flex ap-items-start ap-gap-3">
            <input
              id="workPermit"
              name="needsWorkPermit"
              type="checkbox"
              className="ap-mt-0.5 ap-h-4 ap-w-4 ap-rounded ap-border-gray-300 ap-accent-brand-500"
            />
            <label htmlFor="workPermit" className="ap-text-sm ap-text-gray-700">
              I am under 18 and will require a work permit
            </label>
          </div>

          {state === "error" && errorMsg && (
            <div className="ap-rounded-lg ap-bg-error-50 ap-border ap-border-error-200 ap-px-4 ap-py-3 ap-text-sm ap-text-error-700">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={state === "submitting"}
            className="ap-w-full ap-rounded-lg ap-px-4 ap-py-2.5 ap-text-sm ap-font-semibold ap-text-white ap-transition-opacity disabled:ap-opacity-60 disabled:ap-cursor-not-allowed"
            style={{ background: "linear-gradient(90deg, #465fff, #3641f5)" }}
          >
            {state === "submitting" ? "Submitting…" : "Submit Application"}
          </button>
        </form>
      </div>
    </div>
  );
}

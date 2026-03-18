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
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

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
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-error-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
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
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-10 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-success-100">
          <svg className="h-8 w-8 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Application Submitted!</h2>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Thank you for applying. We&apos;ll review your application and reach out to you soon.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Join Our Team</h1>
        <p className="mt-1 text-sm text-gray-500">
          Fill out the form below to apply for a position with AquaticPro.
        </p>
      </div>

      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
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

          <div className="flex items-start gap-3">
            <input
              id="workPermit"
              name="needsWorkPermit"
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-brand-500"
            />
            <label htmlFor="workPermit" className="text-sm text-gray-700">
              I am under 18 and will require a work permit
            </label>
          </div>

          {state === "error" && errorMsg && (
            <div className="rounded-lg bg-error-50 border border-error-200 px-4 py-3 text-sm text-error-700">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={state === "submitting"}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(90deg, #465fff, #3641f5)" }}
          >
            {state === "submitting" ? "Submitting…" : "Submit Application"}
          </button>
        </form>
      </div>
    </div>
  );
}

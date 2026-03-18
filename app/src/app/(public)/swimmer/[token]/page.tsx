import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Swimmer Progress | AquaticPro" };
export const dynamic = "force-dynamic";

function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-10 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-error-100">
        <svg className="h-7 w-7 text-error-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}

interface Props {
  params: Promise<{ token: string }>;
}

export default async function SwimmerProgressPage({ params }: Props) {
  const { token } = await params;

  const swimmer = await prisma.lmSwimmer.findFirst({
    where: { evaluationToken: token, archived: false },
  });

  if (!swimmer) {
    return <ErrorCard title="Link Not Found" message="This swimmer progress link is invalid or has expired. Please ask your instructor for a new link." />;
  }
  if (swimmer.evaluationTokenExp && swimmer.evaluationTokenExp < new Date()) {
    return <ErrorCard title="Link Expired" message="This swimmer progress link has expired. Please ask your instructor for a new one." />;
  }

  const [levels, skills] = await Promise.all([
    prisma.lmLevel.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.lmSkill.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  let skillsMastered: { skillId: number; date: string }[] = [];
  let levelsMastered: number[] = [];
  try {
    if (swimmer.skillsMastered) skillsMastered = JSON.parse(swimmer.skillsMastered);
    if (swimmer.levelsMastered) levelsMastered = JSON.parse(swimmer.levelsMastered);
  } catch { /* ignore */ }

  const masteredSkillIds = new Set(skillsMastered.map((s) => s.skillId));
  const masteredLevelIds = new Set(levelsMastered);

  const levelData = levels.map((level) => ({
    ...level,
    mastered: masteredLevelIds.has(level.id),
    skills: skills
      .filter((s) => s.levelAssociated === level.id)
      .map((skill) => ({
        ...skill,
        mastered: masteredSkillIds.has(skill.id),
        masteredDate: skillsMastered.find((s) => s.skillId === skill.id)?.date ?? null,
      })),
  })).filter((l) => l.skills.length > 0);

  const totalSkills = levelData.reduce((s, l) => s + l.skills.length, 0);
  const masteredCount = levelData.reduce((s, l) => s + l.skills.filter((sk) => sk.mastered).length, 0);
  const pct = totalSkills > 0 ? Math.round((masteredCount / totalSkills) * 100) : 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{swimmer.title}</h1>
        {swimmer.parentName && (
          <p className="mt-0.5 text-sm text-gray-500">Parent / Guardian: {swimmer.parentName}</p>
        )}
        {swimmer.dateOfBirth && (
          <p className="text-sm text-gray-500">Born: {fmtDate(swimmer.dateOfBirth.toISOString())}</p>
        )}
      </div>

      {/* Progress summary */}
      {totalSkills > 0 && (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 mb-6">
          <div className="flex items-end justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">Overall Progress</span>
            <span className="text-sm font-semibold text-brand-600">{masteredCount} / {totalSkills} skills ({pct}%)</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-gray-100">
            <div
              className="h-2.5 rounded-full transition-all"
              style={{ width: `${pct}%`, background: "linear-gradient(90deg, #465fff, #9f0fff)" }}
            />
          </div>
        </div>
      )}

      {/* Level cards */}
      {levelData.length === 0 ? (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-10 text-center">
          <p className="text-sm text-gray-500">No skill data has been recorded yet. Check back after your next lesson!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {levelData.map((level) => {
            const levelMastered = level.mastered;
            const levelPct = level.skills.length > 0
              ? Math.round((level.skills.filter((s) => s.mastered).length / level.skills.length) * 100)
              : 0;
            return (
              <div
                key={level.id}
                className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${
                  levelMastered ? "border-success-200" : "border-gray-100"
                }`}
              >
                <div className={`flex items-center justify-between px-5 py-3.5 ${
                  levelMastered ? "bg-success-50" : "bg-gray-50"
                }`}>
                  <div className="flex items-center gap-2">
                    {levelMastered && (
                      <span className="text-success-500">✓</span>
                    )}
                    <span className="font-semibold text-gray-900 text-sm">{level.title}</span>
                    {levelMastered && (
                      <span className="text-xs font-medium bg-success-100 text-success-700 rounded-full px-2 py-0.5">Mastered</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {level.skills.filter((s) => s.mastered).length}/{level.skills.length}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1 bg-gray-100">
                  <div
                    className="h-1"
                    style={{
                      width: `${levelPct}%`,
                      background: levelMastered ? "#12b76a" : "linear-gradient(90deg, #465fff, #9f0fff)",
                    }}
                  />
                </div>

                <ul className="divide-y divide-gray-50">
                  {level.skills.map((skill) => (
                    <li key={skill.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                          skill.mastered
                            ? "bg-success-500 text-white"
                            : "border border-gray-200 bg-white"
                        }`}>
                          {skill.mastered && "✓"}
                        </div>
                        <span className={`text-sm ${skill.mastered ? "text-gray-900" : "text-gray-500"}`}>
                          {skill.title}
                        </span>
                      </div>
                      {skill.masteredDate && (
                        <span className="text-xs text-gray-400 shrink-0">{fmtDate(skill.masteredDate)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

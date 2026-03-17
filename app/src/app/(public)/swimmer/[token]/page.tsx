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
    <div className="ap-rounded-2xl ap-bg-white ap-border ap-border-gray-100 ap-shadow-sm ap-p-10 ap-text-center">
      <div className="ap-mx-auto ap-mb-4 ap-flex ap-h-14 ap-w-14 ap-items-center ap-justify-center ap-rounded-full ap-bg-error-100">
        <svg className="ap-h-7 ap-w-7 ap-text-error-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="ap-text-lg ap-font-bold ap-text-gray-900 ap-mb-1">{title}</h2>
      <p className="ap-text-sm ap-text-gray-500">{message}</p>
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
      <div className="ap-mb-8">
        <h1 className="ap-text-2xl ap-font-bold ap-tracking-tight ap-text-gray-900">{swimmer.title}</h1>
        {swimmer.parentName && (
          <p className="ap-mt-0.5 ap-text-sm ap-text-gray-500">Parent / Guardian: {swimmer.parentName}</p>
        )}
        {swimmer.dateOfBirth && (
          <p className="ap-text-sm ap-text-gray-500">Born: {fmtDate(swimmer.dateOfBirth.toISOString())}</p>
        )}
      </div>

      {/* Progress summary */}
      {totalSkills > 0 && (
        <div className="ap-rounded-2xl ap-bg-white ap-border ap-border-gray-100 ap-shadow-sm ap-p-6 ap-mb-6">
          <div className="ap-flex ap-items-end ap-justify-between ap-mb-3">
            <span className="ap-text-sm ap-font-medium ap-text-gray-700">Overall Progress</span>
            <span className="ap-text-sm ap-font-semibold ap-text-brand-600">{masteredCount} / {totalSkills} skills ({pct}%)</span>
          </div>
          <div className="ap-h-2.5 ap-w-full ap-rounded-full ap-bg-gray-100">
            <div
              className="ap-h-2.5 ap-rounded-full ap-transition-all"
              style={{ width: `${pct}%`, background: "linear-gradient(90deg, #465fff, #9f0fff)" }}
            />
          </div>
        </div>
      )}

      {/* Level cards */}
      {levelData.length === 0 ? (
        <div className="ap-rounded-2xl ap-bg-white ap-border ap-border-gray-100 ap-shadow-sm ap-p-10 ap-text-center">
          <p className="ap-text-sm ap-text-gray-500">No skill data has been recorded yet. Check back after your next lesson!</p>
        </div>
      ) : (
        <div className="ap-space-y-4">
          {levelData.map((level) => {
            const levelMastered = level.mastered;
            const levelPct = level.skills.length > 0
              ? Math.round((level.skills.filter((s) => s.mastered).length / level.skills.length) * 100)
              : 0;
            return (
              <div
                key={level.id}
                className={`ap-rounded-2xl ap-border ap-bg-white ap-shadow-sm ap-overflow-hidden ${
                  levelMastered ? "ap-border-success-200" : "ap-border-gray-100"
                }`}
              >
                <div className={`ap-flex ap-items-center ap-justify-between ap-px-5 ap-py-3.5 ${
                  levelMastered ? "ap-bg-success-50" : "ap-bg-gray-50"
                }`}>
                  <div className="ap-flex ap-items-center ap-gap-2">
                    {levelMastered && (
                      <span className="ap-text-success-500">✓</span>
                    )}
                    <span className="ap-font-semibold ap-text-gray-900 ap-text-sm">{level.title}</span>
                    {levelMastered && (
                      <span className="ap-text-xs ap-font-medium ap-bg-success-100 ap-text-success-700 ap-rounded-full ap-px-2 ap-py-0.5">Mastered</span>
                    )}
                  </div>
                  <span className="ap-text-xs ap-text-gray-500">
                    {level.skills.filter((s) => s.mastered).length}/{level.skills.length}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="ap-h-1 ap-bg-gray-100">
                  <div
                    className="ap-h-1"
                    style={{
                      width: `${levelPct}%`,
                      background: levelMastered ? "#12b76a" : "linear-gradient(90deg, #465fff, #9f0fff)",
                    }}
                  />
                </div>

                <ul className="ap-divide-y ap-divide-gray-50">
                  {level.skills.map((skill) => (
                    <li key={skill.id} className="ap-flex ap-items-center ap-justify-between ap-gap-3 ap-px-5 ap-py-2.5">
                      <div className="ap-flex ap-items-center ap-gap-2.5">
                        <div className={`ap-flex ap-h-5 ap-w-5 ap-shrink-0 ap-items-center ap-justify-center ap-rounded-full ap-text-xs ${
                          skill.mastered
                            ? "ap-bg-success-500 ap-text-white"
                            : "ap-border ap-border-gray-200 ap-bg-white"
                        }`}>
                          {skill.mastered && "✓"}
                        </div>
                        <span className={`ap-text-sm ${skill.mastered ? "ap-text-gray-900" : "ap-text-gray-500"}`}>
                          {skill.title}
                        </span>
                      </div>
                      {skill.masteredDate && (
                        <span className="ap-text-xs ap-text-gray-400 ap-shrink-0">{fmtDate(skill.masteredDate)}</span>
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
